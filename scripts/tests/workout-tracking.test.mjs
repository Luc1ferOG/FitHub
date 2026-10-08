import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

// Real TS logic/adapter/persistence/sync code. Native Expo APIs, Zod parsing and
// Zustand's container are replaced at boundaries; Jest tests use real Zod/Zustand.
const modules = new Map();
function stub(exports) { return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }); }
const schemaStub = stub({ sessionStorageSchema: { safeParse: (data) => ({ success: true, data }) }, sessionReceiptSchema: { parse: (data) => data }, exerciseHistorySchema: { parse: (data) => data } });
const zustandStub = stub({ createStore: (initialize) => {
  let state;
  const set = (next) => { state = { ...state, ...next }; };
  const get = () => state;
  state = initialize(set, get); return { getState: get };
} });
const supabaseStub = stub({ supabase: {} });
let granted = true;
const scheduled = new Map();
const notificationsStub = stub({
  setNotificationHandler: () => undefined, AndroidImportance: { HIGH: 4 }, SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: async () => ({ granted }), requestPermissionsAsync: async () => ({ granted }), setNotificationChannelAsync: async () => undefined,
  getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
  cancelScheduledNotificationAsync: async (id) => scheduled.delete(id),
  scheduleNotificationAsync: async (request) => { scheduled.set(request.identifier, request); return request.identifier; },
});
const nativeStub = stub({ Platform: { OS: 'android' }, AppState: { currentState: 'active' } });
await notificationsStub.link(() => { throw new Error('Unexpected native mock import'); });
await notificationsStub.evaluate();
const notificationRuntime = stub({ getNotifications: () => notificationsStub.namespace });
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const module = source(path);
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    if (specifier.endsWith('/notification-runtime')) return notificationRuntime;
    if (specifier === 'zustand/vanilla') return zustandStub;
    if (specifier === 'expo-notifications') return notificationsStub;
    if (specifier === 'react-native') return nativeStub;
    if (specifier === '@/lib/supabase') return supabaseStub;
    if (specifier.endsWith('/validation/session-schema')) return schemaStub;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  });
  if (module.status !== 'evaluated') await module.evaluate(); return module.namespace;
}
const { updateSession, sessionTotals, sessionRecords } = await load('src/features/workouts/services/session-logic.ts');
const { makeSession, receipt, SESSION_OWNER } = await load('src/features/workouts/testing/session-fixtures.ts');
const { sessionPayload } = await load('src/features/workouts/services/session-payload.ts');
const { LocalSessionRepository, SESSION_STORAGE_KEY } = await load('src/features/workouts/repositories/local-session-repository.ts');
const { createSessionStore } = await load('src/features/workouts/state/create-session-store.ts');
const { SessionSyncService } = await load('src/features/workouts/services/session-sync-service.ts');
const { SupabaseSessionRepository } = await load('src/data/repositories/supabase/supabase-session-repository.ts');
const { RestNotifications } = await load('src/services/notifications/rest-notifications.ts');
const { AppError } = await load('src/domain/errors/app-error.ts');
function action(session, type, fields = {}) { return updateSession(session, { type, exerciseId: session.exercises[0].id, setId: session.exercises[0].sets[0]?.id, ...fields }); }
function complete(session = makeSession()) { return action(session, 'toggle-set', { now: session.startedAt + 1000 }); }
function submitted() { const session = complete(); return action(action(session, 'review', { now: session.startedAt + 60000 }), 'submit', { now: session.startedAt + 65000 }); }
function memory() { const data = new Map(); return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; }
function stateFor(session) { const storage = memory(); const repository = new LocalSessionRepository(storage); const store = createSessionStore(repository); store.getState().restore(); store.getState().start(session); return { store, storage, repository }; }
function syncState(store) { return { sessions: () => store.getState().sessions,
  acknowledge: (...args) => store.getState().acknowledge(...args), fail: (...args) => store.getState().fail(...args) }; }

test('add/remove set preserve independent logged values and original session', () => {
  const session = makeSession();
  const added = action(session, 'add-set', { id: 'new-set' });
  assert.equal(added.exercises[0].sets.length, 4); assert.equal(session.exercises[0].sets.length, 3);
  assert.equal(added.exercises[0].sets[3].weight, '20');
  assert.equal(action(added, 'remove-set', { setId: 'new-set' }).exercises[0].sets.length, 3);
});
test('completion updates volume and absolute rest deadline; unchecking reverses both', () => {
  const session = complete();
  assert.equal(sessionTotals(session, session.startedAt + 5000).volume, 200);
  assert.equal(session.restEndsAt, session.startedAt + 61000);
  const undone = action(session, 'toggle-set', { now: session.startedAt + 2000 });
  assert.equal(sessionTotals(undone, session.startedAt + 5000).totalSets, 0); assert.equal(undone.restEndsAt, null);
});
test('negative/blank/non-finite inputs and fractional reps cannot complete', () => {
  for (const [field, value] of [['weight', '-1'], ['weight', ''], ['weight', 'Infinity'], ['weight', '2.001'], ['reps', '0'], ['reps', '1.5']]) {
    assert.throws(() => complete(action(makeSession(), 'set-value', { field, value })), { code: 'VALIDATION' });
  }
});
test('volume uses integer cents and counts only completed sets', () => {
  let session = action(makeSession(), 'set-value', { field: 'weight', value: '0.29' });
  session = action(session, 'set-value', { field: 'reps', value: '3' });
  session = complete(session);
  assert.equal(sessionTotals(session, session.startedAt + 1000).volume, 0.87);
  assert.equal(sessionTotals(session, session.startedAt + 1000).totalReps, 3);
});
test('PR candidates beat history strictly, then compare against earlier sets', () => {
  let session = complete();
  assert.equal(sessionRecords(session).records.length, 1);
  const second = session.exercises[0].sets[1].id;
  session = action(session, 'toggle-set', { setId: second, now: session.startedAt + 2000 });
  assert.equal(sessionRecords(session).records.length, 1, 'a tied set is not another PR');
  session = action(session, 'toggle-set', { setId: second, now: session.startedAt + 3000 });
  session = action(session, 'set-value', { setId: second, field: 'weight', value: '25' });
  session = action(session, 'toggle-set', { setId: second, now: session.startedAt + 4000 });
  assert.deepEqual(sessionRecords(session).records.map((item) => item.volume), [200, 250]);
});
test('rest +30/skip and optional auto-rest use persisted deadlines', () => {
  let session = complete();
  session = action(session, 'extend-rest', { now: session.startedAt + 2000 });
  assert.equal(session.restEndsAt, session.startedAt + 91000);
  assert.equal(action(session, 'skip-rest').restEndsAt, null);
  const disabled = action(makeSession(), 'auto-rest', { value: false });
  assert.equal(complete(disabled).restEndsAt, null);
});
test('skipping preserves completed volume but does not claim exercise completion', () => {
  const session = action(complete(), 'skip-exercise');
  assert.equal(session.exercises[0].skipped, true); assert.equal(session.restEndsAt, null);
  assert.equal(sessionTotals(session, session.startedAt + 2000).volume, 200);
  assert.equal(sessionTotals(session, session.startedAt + 2000).exercisesCompleted, 0);
});
test('review/notes survive until save; submitted payload is immutable and stable', () => {
  let session = complete();
  session = action(session, 'review', { now: session.startedAt + 60000 });
  session = action(session, 'notes', { value: 'Great session' });
  session = action(session, 'submit', { now: session.startedAt + 65000 });
  assert.equal(session.notes, 'Great session');
  assert.deepEqual(sessionPayload(session), sessionPayload(session));
  assert.equal(sessionPayload(session).exercises[0].sets[1].reps, 0, 'unfinished drafts do not count');
  assert.throws(() => action(session, 'notes', { value: 'Changed' }), { code: 'CONFLICT' });
  assert.throws(() => action(makeSession(), 'review', { now: session.startedAt + 1000 }), { code: 'VALIDATION' });
});
test('offline actions write synchronously and a new store restores the exact session', () => {
  const session = makeSession(); const { store, repository, storage } = stateFor(session);
  store.getState().dispatch(session.id, SESSION_OWNER, { type: 'toggle-set', exerciseId: session.exercises[0].id, setId: session.exercises[0].sets[0].id, now: session.startedAt + 1000 });
  assert.ok(storage.data.get(SESSION_STORAGE_KEY).includes('completedAt'));
  const restored = createSessionStore(repository); restored.getState().restore();
  assert.deepEqual(restored.getState().sessions, store.getState().sessions);
  assert.equal(restored.getState().sessions[0].restEndsAt, session.startedAt + 61000);
});
test('failed disk writes do not publish or overwrite the previous workout', () => {
  const storage = memory(); const repository = new LocalSessionRepository(storage); const store = createSessionStore(repository);
  store.getState().restore(); const session = makeSession(); store.getState().start(session);
  const saved = storage.getItem(SESSION_STORAGE_KEY);
  storage.setItem = () => { throw new Error('Disk full'); };
  assert.throws(() => store.getState().dispatch(session.id, SESSION_OWNER, { type: 'notes', value: 'Unsaved' }));
  assert.equal(store.getState().sessions[0].notes, ''); assert.equal(storage.getItem(SESSION_STORAGE_KEY), saved);
  assert.match(store.getState().storageError, /Could not save/);
});
test('corrupt JSON is retained and blocks starting a replacement workout', () => {
  const storage = memory(); storage.setItem(SESSION_STORAGE_KEY, '{broken');
  const store = createSessionStore(new LocalSessionRepository(storage)); store.getState().restore();
  assert.equal(store.getState().hydrated, false);
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), '{broken');
  assert.throws(() => store.getState().start(makeSession()), { code: 'CONFLICT' });
});
test('account isolation prevents editing or synchronizing another account session', async () => {
  const { store } = stateFor(submitted()); let requests = 0;
  assert.throws(() => store.getState().dispatch(store.getState().sessions[0].id, 'other', { type: 'notes', value: 'Wrong user' }), { code: 'NOT_FOUND' });
  const worker = new SessionSyncService({ sync: async () => { requests++; return receipt; } }, syncState(store));
  await worker.sync('other'); assert.equal(requests, 0);
});
test('concurrent sync requests share one flight and store the server receipt', async () => {
  const { store } = stateFor(submitted()); let requests = 0;
  const worker = new SessionSyncService({ sync: async () => { requests++; await Promise.resolve(); return receipt; } }, syncState(store));
  await Promise.all([worker.sync(SESSION_OWNER), worker.sync(SESSION_OWNER)]);
  assert.equal(requests, 1); assert.equal(store.getState().sessions[0].syncStatus, 'synced');
  assert.deepEqual(store.getState().sessions[0].receipt.achievements, receipt.achievements);
});
test('lost server response leaves a durable failed session; retry uses the same ID/payload', async () => {
  const { store } = stateFor(submitted()); const calls = [], server = new Map(); let dropResponse = true;
  const worker = new SessionSyncService({ sync: async (session) => {
    calls.push([session.id, sessionPayload(session)]); server.set(session.id, receipt);
    if (dropResponse) { dropResponse = false; throw new Error('Response lost'); }
    return server.get(session.id);
  } }, syncState(store));
  await worker.sync(SESSION_OWNER); assert.equal(store.getState().sessions[0].syncStatus, 'failed');
  await worker.sync(SESSION_OWNER, true);
  assert.equal(server.size, 1); assert.deepEqual(calls[0], calls[1]); assert.equal(store.getState().sessions[0].syncStatus, 'synced');
});
test('network retry backoff avoids immediate repeat requests', async () => {
  const { store } = stateFor(submitted()); let requests = 0, now = 0;
  const worker = new SessionSyncService({ sync: async () => { requests++; throw new Error('Offline'); } }, syncState(store), () => now);
  await worker.sync(SESSION_OWNER); await worker.sync(SESSION_OWNER); assert.equal(requests, 1);
  now = 5001; await worker.sync(SESSION_OWNER); assert.equal(requests, 2);
});

test('legacy sync observer failure cannot undo acknowledged session receipt', async () => {
  const { store } = stateFor(submitted()); let observedOwner;
  const worker = new SessionSyncService({ sync: async () => receipt }, syncState(store), Date.now,
    (owner) => { observedOwner = owner; throw new Error('cache observer failed'); });
  await worker.sync(SESSION_OWNER); assert.equal(observedOwner, SESSION_OWNER);
  assert.equal(store.getState().sessions[0].syncStatus, 'synced');
});

test('legacy authentication failures require explicit retry rather than repeated automatic requests', async () => {
  const { store } = stateFor(submitted()); let requests = 0;
  const worker = new SessionSyncService({ sync: async () => { requests++; throw new AppError('Sign in again', 'AUTHENTICATION'); } }, syncState(store));
  await worker.sync(SESSION_OWNER); await worker.sync(SESSION_OWNER); assert.equal(requests, 1);
});
test('adapter sends stable identity and does not send client-supplied PR/volume flags', async () => {
  const calls = []; const repository = new SupabaseSessionRepository({ rpc: async (...args) => { calls.push(args); return { data: receipt, error: null }; } });
  await repository.sync(submitted());
  assert.equal(calls[0][0], 'sync_workout_session'); assert.equal(calls[0][1].p_user_id, SESSION_OWNER);
  assert.equal(calls[0][1].p_session_id, submitted().id);
  assert.ok(!('volume' in calls[0][1].p_payload)); assert.ok(!('is_personal_record' in calls[0][1].p_payload.exercises[0].sets[0]));
});
test('rest notification replacement/skip cancel only FitHub rest alerts', async () => {
  scheduled.clear(); granted = true;
  scheduled.set('unrelated', { identifier: 'unrelated' });
  const service = new RestNotifications(); const endsAt = Date.now() + 60000;
  await service.reconcile({ id: 'session', name: 'Strength', endsAt, enabled: true });
  assert.equal(scheduled.get('fithub-rest-session').trigger.date.getTime(), endsAt);
  await service.reconcile({ id: 'session', name: 'Strength', endsAt: endsAt + 30000, enabled: true });
  assert.equal(scheduled.size, 2);
  assert.equal(scheduled.get('fithub-rest-session').trigger.date.getTime(), endsAt + 30000);
  await service.reconcile(null); assert.deepEqual([...scheduled.keys()], ['unrelated']);
  granted = false; assert.equal(await service.requestPermission(), false);
  await service.reconcile({ id: 'session', name: 'Strength', endsAt, enabled: true });
  assert.equal(scheduled.size, 1);
});
