export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Manifest = { version: 1; deleted: true } | { version: 1; generation: string; chunks: number };
const CHUNK_LENGTH = 400; // At most 1200 UTF-8 bytes, below historical native value limits.
const MAX_LENGTH = 64000;
const MAX_CHUNKS = Math.ceil(MAX_LENGTH / (CHUNK_LENGTH - 1));

/** SDK storage port: secrets live only in the supplied encrypted native store.
 * A manifest switches generations after all chunks are durable. Logout writes a
 * tombstone so an undeleted legacy token cannot resurrect a signed-out session.
 */
export class SecureSessionStorage implements AsyncKeyValueStorage {
  private readonly operations = new Map<string, Promise<unknown>>();
  constructor(private readonly secure: AsyncKeyValueStorage, private readonly legacy: AsyncKeyValueStorage,
    private readonly generation: () => string) {}
  getItem(key: string): Promise<string | null> {
    return this.serialize(key, async () => {
      const manifest = await this.manifest(key);
      if (manifest) {
        // Retry cleanup after a migration whose plaintext removal was interrupted.
        await this.legacy.removeItem(key);
        if ('deleted' in manifest) return null;
        const chunks: string[] = [];
        for (let index = 0; index < manifest.chunks; index++) {
          const chunk = await this.secure.getItem(this.chunkKey(key, manifest.generation, index));
          if (chunk === null) throw new Error('Encrypted session storage is incomplete. Sign in again; no legacy token was restored.');
          chunks.push(chunk);
        }
        return chunks.join('');
      }
      const previous = await this.legacy.getItem(key);
      if (previous !== null) await this.write(key, previous, null);
      return previous;
    });
  }
  setItem(key: string, value: string): Promise<void> {
    return this.serialize(key, async () => { await this.write(key, value, await this.manifest(key)); });
  }
  removeItem(key: string): Promise<void> {
    return this.serialize(key, async () => {
      let previous: Manifest | null = null;
      try { previous = await this.manifest(key); } catch { /* Logout must still revoke a corrupt stored credential. */ }
      await this.secure.setItem(this.baseKey(key), JSON.stringify({ version: 1, deleted: true }));
      await this.legacy.removeItem(key);
      await this.clean(key, previous);
    });
  }
  private async write(key: string, value: string, previous: Manifest | null): Promise<void> {
    if (value.length > MAX_LENGTH) throw new Error('Session storage exceeds the supported size.');
    const generation = this.generation();
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(generation)) throw new Error('Invalid encrypted storage generation.');
    if (previous && 'generation' in previous && generation === previous.generation) throw new Error('Encrypted storage generations must be unique.');
    const values: string[] = [];
    for (let start = 0; start < value.length;) {
      let end = Math.min(value.length, start + CHUNK_LENGTH);
      // Native UTF-8 bridges may replace a surrogate split across two values.
      if (end < value.length && /[\uD800-\uDBFF]/.test(value.charAt(end - 1)) && /[\uDC00-\uDFFF]/.test(value.charAt(end))) end--;
      values.push(value.slice(start, end)); start = end;
    }
    if (!values.length) values.push('');
    const chunks = values.length;
    for (let index = 0; index < chunks; index++) await this.secure.setItem(this.chunkKey(key, generation, index), values[index] ?? '');
    // Never delete new chunks on an uncertain manifest-write failure: it may
    // already have committed. Old generations remain valid until this switch.
    await this.secure.setItem(this.baseKey(key), JSON.stringify({ version: 1, generation, chunks }));
    await this.legacy.removeItem(key);
    await this.clean(key, previous);
  }
  private async clean(key: string, manifest: Manifest | null): Promise<void> {
    if (!manifest || 'deleted' in manifest) return;
    for (let index = 0; index < manifest.chunks; index++) {
      try { await this.secure.removeItem(this.chunkKey(key, manifest.generation, index)); }
      catch { /* Unreferenced encrypted chunks cannot restore a session. */ }
    }
  }
  private async manifest(key: string): Promise<Manifest | null> {
    const raw = await this.secure.getItem(this.baseKey(key));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1) throw new Error('Invalid encrypted session manifest.');
    if ('deleted' in value && value.deleted === true) return { version: 1, deleted: true };
    if ('generation' in value && typeof value.generation === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value.generation)
      && 'chunks' in value && typeof value.chunks === 'number' && Number.isInteger(value.chunks) && value.chunks >= 1 && value.chunks <= MAX_CHUNKS) {
      return { version: 1, generation: value.generation, chunks: value.chunks };
    }
    throw new Error('Invalid encrypted session manifest.');
  }
  private baseKey(key: string): string {
    if (!key || key.length > 256) throw new Error('Invalid session storage key.');
    // Hex encoding preserves keys without collisions or unsupported SecureStore characters.
    return `fithub_auth_${Array.from(key).map((character) => character.codePointAt(0)?.toString(16).padStart(6, '0')).join('')}`;
  }
  private chunkKey(key: string, generation: string, index: number): string { return `${this.baseKey(key)}_${generation}_${index}`; }
  private serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const next = (this.operations.get(key) ?? Promise.resolve()).catch(() => undefined).then(operation);
    this.operations.set(key, next);
    void next.finally(() => { if (this.operations.get(key) === next) this.operations.delete(key); }).catch(() => undefined);
    return next;
  }
}
