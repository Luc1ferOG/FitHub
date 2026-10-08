import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix, join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

// Execute production TS and real SQLite transactions. Native SQLite/Zustand
// containers and Zod parsing remain boundaries; Jest exercises actual Zod.
const modules = new Map();
function stub(exports) { return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }); }
const schema = stub({ sessionStorageSchema: { parse: (value) => value, safeParse: (data) => ({ success: true, data }) } });
const cachedSchema = stub({ cachedWorkoutSchema: { parse: (value) => value }, cachedWorkoutPageSchema: { parse: (value) => value } });
const zustand = stub({ createStore: (initialize) => { let state; const get = () => state; const set = (next) => { state = { ...state, ...next }; }; state = initialize(set, get); return { getState: get }; } });
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const module = source(path);
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    if (specifier === 'zustand/vanilla') return zustand;
    if (specifier.endsWith('/validation/session-schema')) return schema;
    if (specifier.endsWith('/validation/cached-workout-schema')) return cachedSchema;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  });
  if (module.status !== 'evaluated') await module.evaluate();
  return module.namespace;
}
const { initializeOfflineDatabase, SQLiteCacheStorage } = await load('src/data/local/offline-database.ts');
const { SQLiteSessionRepository } = await load('src/data/local/sqlite-session-repository.ts');
const { SQLiteSyncQueueRepository } = await load('src/data/local/sqlite-sync-queue-repository.ts');
const { OfflineWorkoutRepository } = await load('src/data/local/offline-workout-repository.ts');
const { createSessionStore } = await load('src/features/workouts/state/create-session-store.ts');
const { SessionSyncService } = await load('src/features/workouts/services/session-sync-service.ts');
const { makeSession, receipt, SESSION_OWNER } = await load('src/features/workouts/testing/session-fixtures.ts');
const { sessionPayload } = await load('src/features/workouts/services/session-payload.ts');
const { AuthSessionManager } = await load('src/features/auth/services/auth-session-manager.ts');
const { AppError } = await load('src/domain/errors/app-error.ts');

function connection(path = ':memory:') {
  const native = new DatabaseSync(path);
  const db = {
    exec: (sql) => native.exec(sql), run: (sql, ...values) => { native.prepare(sql).run(...values); },
    first: (sql, ...values) => native.prepare(sql).get(...values) ?? null,
    all: (sql, ...values) => native.prepare(sql).all(...values),
    transaction: (work) => { native.exec('BEGIN IMMEDIATE'); try { work(); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } },
  };
  initializeOfflineDatabase(db);
  return { db, close: () => native.close() };
}
function setup(db, legacy = { restore: () => [], save: () => undefined }) {
  const persistence = new SQLiteSessionRepository(db, legacy);
  const store = createSessionStore(persistence); store.getState().restore();
  const queue = new SQLiteSyncQueueRepository(db);
  return { store, queue, persistence };
}
function finish(store) {
  const session = makeSession(); store.getState().start(session);
  const dispatch = (action) => store.getState().dispatch(session.id, session.userId, action);
  dispatch({ type: 'toggle-set', exerciseId: session.exercises[0].id, setId: session.exercises[0].sets[0].id, now: session.startedAt + 1000 });
  dispatch({ type: 'review', now: session.startedAt + 60000 });
  dispatch({ type: 'submit', now: session.startedAt + 65000 });
  return store.getState().sessions[0];
}
function worker(state, remote, now = () => 0, canSync = () => true, timeoutMs = 30000) {
  return new SessionSyncService(remote, {
    sessions: () => state.store.getState().sessions,
    acknowledge: (...args) => state.store.getState().acknowledge(...args),
    fail: (...args) => state.store.getState().fail(...args),
  }, now, () => undefined, { queue: state.queue, canSync, timeoutMs });
}
const remoteReceipt = () => ({ ...receipt, achievements: [], challengeChanges: [] });

test('offline finish atomically enqueues one immutable operation with every required field', () => {
  const { db, close } = connection(); const state = setup(db); const session = finish(state.store);
  const operation = state.queue.list(SESSION_OWNER)[0];
  assert.equal(operation.localId, session.id); assert.equal(operation.type, 'complete-workout');
  assert.equal(operation.entity, 'workout-session'); assert.equal(operation.createdAt, session.submittedAt);
  assert.equal(operation.retryCount, 0); assert.equal(operation.syncStatus, 'pending');
  state.store.getState().fail(session.id, SESSION_OWNER, 'Network unavailable');
  assert.deepEqual(state.queue.list(SESSION_OWNER)[0].payload, session, 'queued payload does not change with UI sync status');
  assert.equal(db.first('SELECT COUNT(*) AS n FROM sync_queue').n, 1); close();
});
test('loss of internet mid-workout and process restart retain logged sets and pending completion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fithub-offline-')); const path = join(directory, 'offline.db');
  let instance = connection(path); let state = setup(instance.db); const session = makeSession();
  state.store.getState().start(session);
  state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'set-value', exerciseId: session.exercises[0].id, setId: session.exercises[0].sets[0].id, field: 'weight', value: '42' });
  const expected = state.store.getState().sessions[0]; instance.close();
  instance = connection(path); state = setup(instance.db);
  assert.deepEqual(state.store.getState().sessions[0], expected); assert.equal(state.queue.list(SESSION_OWNER).length, 0);
  state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'toggle-set', exerciseId: session.exercises[0].id, setId: session.exercises[0].sets[0].id, now: session.startedAt + 1000 });
  state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'review', now: session.startedAt + 60000 });
  state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'submit', now: session.startedAt + 65000 });
  instance.close(); instance = connection(path); state = setup(instance.db);
  assert.equal(state.store.getState().sessions[0].exercises[0].sets[0].weight, '42');
  assert.equal(state.queue.list(SESSION_OWNER).length, 1);
  instance.close(); unlinkSync(path); rmdirSync(directory);
});
test('an outbox insert failure rolls back completion and never publishes a finished workout', () => {
  const { db, close } = connection(); const state = setup(db); const session = makeSession();
  state.store.getState().start(session);
  state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'toggle-set', exerciseId: session.exercises[0].id, setId: session.exercises[0].sets[0].id, now: session.startedAt + 1000 });
  state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'review', now: session.startedAt + 60000 });
  db.exec("CREATE TRIGGER reject_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT,'disk failure'); END;");
  assert.throws(() => state.store.getState().dispatch(session.id, SESSION_OWNER, { type: 'submit', now: session.startedAt + 65000 }));
  assert.equal(state.store.getState().sessions[0].submittedAt, null);
  assert.equal(state.persistence.restore()[0].submittedAt, null); assert.equal(state.queue.list(SESSION_OWNER).length, 0); close();
});
test('reconnect and double reconnect sync once and acknowledge session and queue atomically', async () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store);
  let calls = 0, resolve; const request = new Promise((done) => { resolve = done; });
  const sync = worker(state, { sync: async () => { calls++; return request; } });
  const first = sync.sync(SESSION_OWNER), second = sync.sync(SESSION_OWNER);
  assert.equal(first, second); assert.equal(calls, 1); assert.equal(state.queue.list(SESSION_OWNER)[0].syncStatus, 'syncing');
  resolve(remoteReceipt()); await first; await sync.sync(SESSION_OWNER);
  assert.equal(calls, 1); assert.equal(state.queue.list(SESSION_OWNER).length, 0);
  assert.equal(db.first('SELECT sync_status FROM sync_queue').sync_status, 'synced');
  assert.equal(state.store.getState().sessions[0].syncStatus, 'synced'); close();
});
test('independent workers use an atomic claim and cannot both submit an operation', async () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store);
  let calls = 0, resolve; const request = new Promise((done) => { resolve = done; });
  const remote = { sync: async () => { calls++; return request; } };
  const first = worker(state, remote).sync(SESSION_OWNER); await worker(state, remote).sync(SESSION_OWNER);
  assert.equal(calls, 1); resolve(remoteReceipt()); await first; close();
});
test('failed transient request persists retry count and backoff across worker and store restart', async () => {
  const { db, close } = connection(); let state = setup(db); finish(state.store); let now = 100, calls = 0;
  await worker(state, { sync: async () => { calls++; throw new AppError('Offline', 'NETWORK'); } }, () => now).sync(SESSION_OWNER);
  assert.equal(state.queue.list(SESSION_OWNER)[0].retryCount, 1); assert.equal(state.queue.list(SESSION_OWNER)[0].nextAttemptAt, 5100);
  state = setup(db); const retry = worker(state, { sync: async () => { calls++; return remoteReceipt(); } }, () => now);
  await retry.sync(SESSION_OWNER); assert.equal(calls, 1); now = 5100; await retry.sync(SESSION_OWNER);
  assert.equal(calls, 2); assert.equal(state.queue.list(SESSION_OWNER).length, 0); close();
});
test('interrupted syncing entries return to pending on process initialization', () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store);
  assert.equal(state.queue.claim(state.store.getState().sessions[0].id, SESSION_OWNER, 0, false), true);
  initializeOfflineDatabase(db); assert.equal(state.queue.list(SESSION_OWNER)[0].syncStatus, 'pending'); close();
});
test('lost response retries exact ID and payload, preventing duplicate remote creation', async () => {
  const { db, close } = connection(); let state = setup(db); finish(state.store); const remoteRows = new Map(); let calls = 0;
  const remote = { sync: async (session) => {
    calls++; const payload = JSON.stringify(sessionPayload(session));
    if (remoteRows.has(session.id)) assert.equal(remoteRows.get(session.id), payload);
    remoteRows.set(session.id, payload);
    if (calls === 1) throw new AppError('Response lost', 'NETWORK');
    return remoteReceipt();
  } };
  await worker(state, remote).sync(SESSION_OWNER); state = setup(db);
  await worker(state, remote, () => 5000).sync(SESSION_OWNER);
  assert.equal(calls, 2); assert.equal(remoteRows.size, 1); assert.equal(state.queue.list(SESSION_OWNER).length, 0); close();
});
test('terminal conflicts are retained for explicit retry, never overwritten or automatically discarded', async () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store); let calls = 0;
  const sync = worker(state, { sync: async () => { calls++; throw new AppError('Payload conflict', 'CONFLICT'); } }, () => 900000);
  await sync.sync(SESSION_OWNER); await sync.sync(SESSION_OWNER);
  assert.equal(calls, 1); assert.equal(state.queue.list(SESSION_OWNER)[0].retryable, false);
  await sync.sync(SESSION_OWNER, true); assert.equal(calls, 2); assert.equal(state.store.getState().sessions.length, 1); close();
});
test('offline and account guards never submit another owner operation', async () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store); let calls = 0;
  const sync = worker(state, { sync: async () => { calls++; return remoteReceipt(); } }, () => 0, () => false);
  await sync.sync(SESSION_OWNER); await sync.sync('another-user', true);
  assert.equal(calls, 0); assert.equal(state.queue.list(SESSION_OWNER)[0].syncStatus, 'pending'); close();
});
test('legacy migration imports once, preserves source, and enqueues previously submitted workouts', () => {
  const initial = connection(); const old = setup(initial.db); const submitted = finish(old.store); initial.close();
  const { db, close } = connection(); let reads = 0;
  const legacy = { restore: () => { reads++; return [submitted]; }, save: () => { throw Error('Do not overwrite legacy'); } };
  const state = setup(db, legacy); assert.equal(state.queue.list(SESSION_OWNER).length, 1);
  setup(db, legacy); assert.equal(reads, 1); close();
});
test('corrupt legacy data never marks migration successful or overwrites recovery source', () => {
  const { db, close } = connection(); const state = setup(db, { restore: () => { throw Error('Corrupt source'); } });
  assert.equal(state.store.getState().hydrated, false); assert.equal(db.first('SELECT key FROM local_metadata'), null); close();
});

function workouts(db) {
  let offline = false, owner = SESSION_OWNER, remoteCalls = 0, missing = false, network = false;
  const template = { id: 'workout', ownerId: SESSION_OWNER, name: 'Cached template', description: '', isPublic: false, estimatedDuration: 1200, createdAt: '', updatedAt: '', exercises: [] };
  const remote = { findById: async () => { remoteCalls++; if (network) throw new AppError('Network', 'NETWORK'); return missing ? null : template; },
    listByOwner: async () => { remoteCalls++; return { items: [template], nextOffset: null }; }, save: async () => template.id, delete: async () => undefined };
  const cache = new SQLiteCacheStorage(db);
  return { repository: new OfflineWorkoutRepository(remote, cache, () => owner, () => offline), template,
    offline: () => { offline = true; }, owner: (value) => { owner = value; }, missing: () => { missing = true; }, network: () => { network = true; }, calls: () => remoteCalls, cache };
}
test('durable workout details and pages are readable offline without a network request', async () => {
  const { db, close } = connection(); const state = workouts(db);
  await state.repository.findById('workout'); await state.repository.listByOwner(SESSION_OWNER, 0); state.offline();
  assert.deepEqual(await state.repository.findById('workout'), state.template);
  assert.equal((await state.repository.listByOwner(SESSION_OWNER, 0)).items.length, 1); assert.equal(state.calls(), 2); close();
});
test('cached templates are account isolated and offline writes fail clearly without fake success', async () => {
  const { db, close } = connection(); const state = workouts(db); await state.repository.findById('workout'); state.offline();
  await assert.rejects(state.repository.save({}), { code: 'NETWORK' }); state.owner('someone-else');
  await assert.rejects(state.repository.findById('workout'), { code: 'NETWORK' });
  await assert.rejects(state.repository.listByOwner(SESSION_OWNER, 0), { code: 'AUTHORIZATION' }); close();
});
test('network failure falls back to cache but confirmed remote deletion revokes cached details', async () => {
  const first = connection(); const cached = workouts(first.db); await cached.repository.findById('workout'); cached.network();
  assert.deepEqual(await cached.repository.findById('workout'), cached.template); first.close();
  const { db, close } = connection(); const removed = workouts(db); await removed.repository.findById('workout'); removed.missing();
  assert.equal(await removed.repository.findById('workout'), null); removed.offline();
  await assert.rejects(removed.repository.findById('workout'), { code: 'NETWORK' }); close();
});

function auth(offline = true) {
  let saved = { user: { id: SESSION_OWNER, email: null }, expiresAt: 1 }, emit;
  const identity = { read: () => saved, save: (value) => { saved = value; }, clear: () => { saved = null; } };
  const repository = { getSession: async () => { throw new AppError('Network', 'NETWORK'); }, onSessionChange: (callback) => { emit = callback; return () => undefined; } };
  const updates = []; const manager = new AuthSessionManager(repository, { identity, isOffline: () => offline });
  return { manager, repository, updates, identity, emit: (...args) => emit(...args), saved: () => saved };
}
test('expired offline identity restores routing immediately without storing tokens or passwords', async () => {
  const state = auth(); const stop = state.manager.start((value) => state.updates.push(value));
  assert.equal(state.updates[0].session.user.id, SESSION_OWNER);
  state.emit(null, 'INITIAL_SESSION'); await Promise.resolve(); await Promise.resolve();
  assert.equal(state.updates.at(-1).session.user.id, SESSION_OWNER);
  assert.deepEqual(Object.keys(state.saved()), ['user', 'expiresAt']); stop();
});
test('explicit logout clears offline routing identity and cannot be overwritten by stale restoration', async () => {
  const state = auth(); state.manager.start((value) => state.updates.push(value));
  state.emit(null, 'SIGNED_OUT'); await Promise.resolve(); await Promise.resolve();
  assert.equal(state.saved(), null); assert.equal(state.updates.at(-1).session, null);
});
test('authoritative online null session clears identity; transient reconnect failure preserves local access', async () => {
  const online = auth(false); online.repository.getSession = async () => null;
  online.manager.start((value) => online.updates.push(value)); await Promise.resolve(); await Promise.resolve();
  assert.equal(online.saved(), null); assert.equal(online.updates.at(-1).session, null);
  const transient = auth(false); transient.manager.start((value) => transient.updates.push(value)); await Promise.resolve(); await Promise.resolve();
  assert.equal(transient.updates.at(-1).session.user.id, SESSION_OWNER);
});
test('authorization rejection never uses cached identity to bypass login', async () => {
  const state = auth(false); state.repository.getSession = async () => { throw new AppError('Invalid refresh token', 'AUTHENTICATION'); };
  state.manager.start((value) => state.updates.push(value)); await Promise.resolve(); await Promise.resolve();
  assert.equal(state.updates.at(-1).session, null); assert.equal(state.saved(), null);
});

test('a hung request after disconnection times out, aborts transport, and remains retryable', async () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store); let signal;
  await worker(state, { sync: (_session, abortSignal) => { signal = abortSignal; return new Promise(() => undefined); } }, () => 0, () => true, 5).sync(SESSION_OWNER);
  assert.equal(signal.aborted, true); assert.equal(state.queue.list(SESSION_OWNER)[0].syncStatus, 'failed');
  assert.equal(state.queue.list(SESSION_OWNER)[0].retryable, true); close();
});
test('SQLite rejects a queue entry whose owner differs from the local session owner', () => {
  const { db, close } = connection(); const state = setup(db); const session = makeSession(); state.store.getState().start(session);
  assert.throws(() => db.run("INSERT INTO sync_queue(local_id,user_id,type,entity,payload,created_at,sync_status) VALUES (?,?,'complete-workout','workout-session',?,0,'pending')", session.id, 'another-account', JSON.stringify(session)), /FOREIGN KEY/); close();
});
test('acknowledgment disk failure retries the remote receipt without duplicating the session', async () => {
  const { db, close } = connection(); const state = setup(db); finish(state.store); let calls = 0;
  db.exec("CREATE TRIGGER reject_ack BEFORE UPDATE OF sync_status ON sync_queue WHEN NEW.sync_status='synced' BEGIN SELECT RAISE(ABORT,'disk failure'); END;");
  const remote = { sync: async () => { calls++; return remoteReceipt(); } };
  await worker(state, remote).sync(SESSION_OWNER);
  assert.equal(state.persistence.restore()[0].receipt, null); assert.equal(state.queue.list(SESSION_OWNER)[0].syncStatus, 'failed');
  db.exec('DROP TRIGGER reject_ack'); await worker(state, remote, () => 5000).sync(SESSION_OWNER);
  assert.equal(calls, 2); assert.equal(db.first('SELECT COUNT(*) AS n FROM local_sessions').n, 1);
  assert.equal(state.queue.list(SESSION_OWNER).length, 0); close();
});
test('online deletion removes stale cached pages as well as cached details', async () => {
  const { db, close } = connection(); const state = workouts(db);
  await state.repository.findById('workout'); await state.repository.listByOwner(SESSION_OWNER, 0);
  await state.repository.delete('workout', 'version'); state.offline();
  await assert.rejects(state.repository.findById('workout'), { code: 'NETWORK' });
  await assert.rejects(state.repository.listByOwner(SESSION_OWNER, 0), { code: 'NETWORK' }); close();
});
test('a template cached from Home remains discoverable offline even without a cached owner page', async () => {
  const { db, close } = connection(); const state = workouts(db); await state.repository.findById('workout'); state.offline();
  const page = await state.repository.listByOwner(SESSION_OWNER, 0);
  assert.equal(page.items[0].id, 'workout'); assert.equal(state.calls(), 1); close();
});
test('an online INITIAL_SESSION null does not erase offline identity on a backend outage', async () => {
  const state = auth(false); state.manager.start((value) => state.updates.push(value));
  state.emit(null, 'INITIAL_SESSION'); await Promise.resolve(); await Promise.resolve();
  assert.equal(state.saved().user.id, SESSION_OWNER); assert.equal(state.updates.at(-1).session.user.id, SESSION_OWNER);
});
test('a newer SQLite schema version is rejected without overwriting data', () => {
  const { db, close } = connection(); db.exec('PRAGMA user_version = 2');
  assert.throws(() => initializeOfflineDatabase(db), /newer FitHub version/);
  assert.equal(db.first('PRAGMA user_version').user_version, 2); close();
});
