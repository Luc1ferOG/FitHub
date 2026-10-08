import { SecureSessionStorage, type AsyncKeyValueStorage } from '../secure-session-storage';

function setup() {
  const encrypted = new Map<string, string>(); const plaintext = new Map<string, string>(); let sequence = 0;
  const port = (data: Map<string, string>): AsyncKeyValueStorage => ({ getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => { data.set(key, value); }, removeItem: async (key) => { data.delete(key); } });
  const secure = port(encrypted), legacy = port(plaintext);
  const storage = new SecureSessionStorage(secure, legacy, () => `generation-${++sequence}`);
  return { encrypted, plaintext, secure, legacy, storage };
}
it('round-trips oversized native values via chunks and removes migrated plaintext', async () => {
  const f = setup(); const value = JSON.stringify({ access_token: 'x'.repeat(5000), name: '🏋️'.repeat(800) });
  f.plaintext.set('session', value);
  expect(await f.storage.getItem('session')).toBe(value); expect(f.plaintext.size).toBe(0);
  expect([...f.encrypted.values()].every((chunk) => chunk.length <= 400)).toBe(true);
});
it('preserves committed credentials when a subsequent chunk cannot be written', async () => {
  const f = setup(); await f.storage.setItem('session', 'old');
  const save = f.secure.setItem;
  f.secure.setItem = async (key, value) => { if (key.endsWith('generation-2_1')) throw new Error('disk'); await save(key, value); };
  await expect(f.storage.setItem('session', 'x'.repeat(900))).rejects.toThrow('disk');
  expect(await f.storage.getItem('session')).toBe('old');
});
it('retains a logout tombstone when cleanup fails and never restores stale legacy credentials', async () => {
  const f = setup(); await f.storage.setItem('session', 'old'); f.plaintext.set('session', 'stale');
  const remove = f.legacy.removeItem; f.legacy.removeItem = async () => { throw new Error('disk'); };
  await expect(f.storage.removeItem('session')).rejects.toThrow('disk');
  f.legacy.removeItem = remove; expect(await f.storage.getItem('session')).toBeNull();
});
it('serializes overlapping refresh and logout writes', async () => {
  const f = setup(); await Promise.all([f.storage.setItem('session', 'one'), f.storage.setItem('session', 'two'), f.storage.removeItem('session')]);
  expect(await f.storage.getItem('session')).toBeNull();
});
