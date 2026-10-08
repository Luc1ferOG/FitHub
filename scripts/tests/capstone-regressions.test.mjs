import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { SourceTextModule } from 'node:vm';

async function load(file) {
  const module = new SourceTextModule(stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'transform' }));
  await module.link(() => { throw new Error('This regression module must have no runtime dependencies'); });
  await module.evaluate(); return module.namespace;
}
const { SecureSessionStorage } = await load('src/data/local/secure-session-storage.ts');
const { logoutWithCleanup } = await load('src/features/auth/services/logout-with-cleanup.ts');
const { shouldPersistMutation } = await load('src/services/query/persistence-policy.ts');
const { writeInvalidationKeys } = await load('src/services/query/write-invalidation.ts');
function fixture() {
  const encrypted = new Map(), plaintext = new Map(); let generation = 0;
  const secure = {
    getItem: async (key) => encrypted.get(key) ?? null,
    setItem: async (key, value) => {
      assert.match(key, /^[\w.-]+$/); assert.ok(Buffer.byteLength(value) < 2048);
      encrypted.set(key, Buffer.from(value, 'utf8').toString('utf8'));
    },
    removeItem: async (key) => { encrypted.delete(key); },
  };
  const legacy = { getItem: async (key) => plaintext.get(key) ?? null,
    setItem: async (key, value) => { plaintext.set(key, value); }, removeItem: async (key) => { plaintext.delete(key); } };
  const storage = new SecureSessionStorage(secure, legacy, () => `generation-${++generation}`);
  return { storage, secure, legacy, encrypted, plaintext, restart: () => new SecureSessionStorage(secure, legacy, () => `generation-${++generation}`) };
}
test('secure SDK storage round-trips large Unicode sessions across UTF-8 bridges and restart', async () => {
  const f = fixture(); const value = 'x'.repeat(399) + '🏋️'.repeat(900) + '終';
  await f.storage.setItem('sb-project-auth-token', value);
  assert.equal(await f.restart().getItem('sb-project-auth-token'), value);
  assert.equal(f.plaintext.size, 0);
});
test('legacy credentials migrate only after secure commit, then plaintext is removed', async () => {
  const f = fixture(); f.plaintext.set('session', 'opaque-sdk-token');
  assert.equal(await f.storage.getItem('session'), 'opaque-sdk-token');
  assert.equal(f.plaintext.size, 0); assert.ok(f.encrypted.size > 0);
});
test('failed secure migration preserves legacy session for a safe retry', async () => {
  const f = fixture(); f.plaintext.set('session', 'old'); const save = f.secure.setItem;
  f.secure.setItem = async () => { throw new Error('locked device'); };
  await assert.rejects(f.storage.getItem('session')); assert.equal(f.plaintext.get('session'), 'old');
  f.secure.setItem = save; assert.equal(await f.storage.getItem('session'), 'old');
});
test('interrupted generation write keeps previous committed session readable', async () => {
  const f = fixture(); await f.storage.setItem('session', 'old'); const save = f.secure.setItem;
  f.secure.setItem = async (key, value) => { if (key.includes('generation-2_1')) throw new Error('disk'); await save(key, value); };
  await assert.rejects(f.storage.setItem('session', 'n'.repeat(900)));
  assert.equal(await f.restart().getItem('session'), 'old');
});
test('uncertain manifest response never deletes potentially committed new session chunks', async () => {
  const f = fixture(); await f.storage.setItem('session', 'old'); const save = f.secure.setItem;
  f.secure.setItem = async (key, value) => { await save(key, value); if (value.includes('"generation":"generation-2"')) throw new Error('response lost'); };
  await assert.rejects(f.storage.setItem('session', 'new'));
  assert.equal(await f.restart().getItem('session'), 'new');
});
test('logout tombstone prevents legacy resurrection even if plaintext cleanup fails', async () => {
  const f = fixture(); await f.storage.setItem('session', 'current'); f.plaintext.set('session', 'stale'); const remove = f.legacy.removeItem;
  f.legacy.removeItem = async () => { throw new Error('disk'); };
  await assert.rejects(f.storage.removeItem('session')); await assert.rejects(f.restart().getItem('session'));
  f.legacy.removeItem = remove; assert.equal(await f.restart().getItem('session'), null); assert.equal(f.plaintext.size, 0);
});
test('missing encrypted chunks fail closed rather than restoring a legacy credential', async () => {
  const f = fixture(); await f.storage.setItem('session', 'current'); f.plaintext.set('session', 'stale');
  const chunk = [...f.encrypted.keys()].find((key) => key.endsWith('_generation-1_0')); f.encrypted.delete(chunk);
  await assert.rejects(f.storage.getItem('session'), /incomplete/); assert.equal(f.plaintext.size, 0);
});
test('corrupt encrypted manifest fails closed', async () => {
  const f = fixture(); await f.storage.setItem('session', 'current');
  const manifest = [...f.encrypted.entries()].find(([, value]) => value.includes('"chunks"')); f.encrypted.set(manifest[0], '{bad');
  f.plaintext.set('session', 'stale'); await assert.rejects(f.storage.getItem('session'));
  await f.storage.removeItem('session'); assert.equal(await f.restart().getItem('session'), null);
});
test('concurrent session operations serialize writes and logout deterministically', async () => {
  const f = fixture(); await Promise.all([f.storage.setItem('session', 'first'), f.storage.setItem('session', 'second'), f.storage.removeItem('session')]);
  assert.equal(await f.storage.getItem('session'), null);
  await f.storage.setItem('session', 'new-login'); assert.equal(await f.storage.getItem('session'), 'new-login');
});
test('rotating credentials removes previous encrypted generation', async () => {
  const f = fixture(); await f.storage.setItem('session', 'old'); await f.storage.setItem('session', 'new');
  assert.equal([...f.encrypted.keys()].some((key) => key.includes('generation-1_')), false);
  assert.equal(await f.storage.getItem('session'), 'new');
});
test('oversize credentials and invalid keys cannot overwrite a committed session', async () => {
  const f = fixture(); await f.storage.setItem('session', 'old');
  await assert.rejects(f.storage.setItem('session', 'x'.repeat(64001)), /size/);
  await assert.rejects(f.storage.setItem('', 'bad'), /key/); assert.equal(await f.storage.getItem('session'), 'old');
});
test('push unregister failure cannot prevent Auth logout attempt', async () => {
  const order = []; await logoutWithCleanup({ logout: async () => { order.push('logout'); } }, { disable: async () => { order.push('push'); throw new Error('offline'); } });
  assert.deepEqual(order, ['push', 'logout']);
});
test('Auth logout failure remains visible instead of pretending sign-out succeeded', async () => {
  await assert.rejects(logoutWithCleanup({ logout: async () => { throw new Error('Auth unavailable'); } }, { disable: async () => {} }), /Auth unavailable/);
});
test('generic query persistence excludes paused credential and media mutations', () => {
  assert.equal(shouldPersistMutation({ state: { isPaused: true, variables: { password: 'secret' } }, meta: { persist: true } }), false);
});
test('write invalidation includes dashboard, scopes account and skips absent identity', () => {
  for (const event of ['workout-template', 'workout-session', 'friendship', 'challenge', 'achievement']) {
    const keys = writeInvalidationKeys(event, 'owner'); assert.ok(keys.some(([root]) => root === 'home-dashboard'));
    assert.ok(keys.every((key) => key[1] === 'owner')); assert.deepEqual(writeInvalidationKeys(event, ''), []);
  }
  assert.ok(writeInvalidationKeys('friendship', 'owner').some(([root]) => root === 'leaderboards'));
});
