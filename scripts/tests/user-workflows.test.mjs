import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

// Run the same integration fixture as Jest. Zod/native Zustand containers are
// boundaries here; real schemas and real Zustand execute in the Jest suite.
const modules = new Map();
function source(path) { if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path })); return modules.get(path); }
function stub(values) { return new SyntheticModule(Object.keys(values), function () { for (const [name, value] of Object.entries(values)) this.setExport(name, value); }); }
const passthrough = { parse: (value) => value, safeParse: (data) => ({ success: true, data }) };
const auth = stub({ registerSchema: passthrough, loginSchema: passthrough, newPasswordSchema: passthrough, passwordResetRequestSchema: passthrough });
const workouts = stub({ workoutSchema: passthrough }); const sessions = stub({ sessionStorageSchema: passthrough });
const zustand = stub({ createStore: (initialize) => { let state; const get = () => state; const set = (next) => { state = { ...state, ...next }; }; state = initialize(set, get); return { getState: get }; } });
async function load(path) {
  const module = source(path);
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    if (specifier === 'zustand/vanilla') return zustand;
    if (specifier.endsWith('/validation/auth-schema')) return auth;
    if (specifier.endsWith('/validation/workout-schema')) return workouts;
    if (specifier.endsWith('/validation/session-schema')) return sessions;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  });
  if (module.status !== 'evaluated') await module.evaluate(); return module.namespace;
}
const { runWorkoutJourney } = await load('src/testing/workout-journey.ts');
test('register/create/edit/log/finish/reopen/sync delivers authoritative receipt and submits once', async () => {
  const journey = await runWorkoutJourney();
  assert.equal(journey.registered.user.id, journey.created.ownerId); assert.equal(journey.edited.name, 'Edited journey');
  assert.equal(journey.created.exercises[0].reps, 10); assert.equal(journey.edited.exercises[0].reps, 12);
  assert.deepEqual(journey.offline, journey.submitted); assert.equal(journey.confirmed.syncStatus, 'synced');
  assert.equal(journey.confirmed.receipt.volume, 480); assert.equal(journey.confirmed.receipt.durationSeconds, 60);
  assert.equal(journey.confirmed.receipt.totalReps, 24); assert.equal(journey.confirmed.receipt.challengeChanges[0].value, 1);
  assert.deepEqual(journey.attemptedIds, [journey.submitted.id]); assert.deepEqual(journey.restoredAgain, [journey.confirmed]);
});
test('lost-response recovery keeps one saved workout and replays exactly the same submission', async () => {
  const journey = await runWorkoutJourney(true);
  assert.equal(journey.afterFailure.syncStatus, 'failed'); assert.equal(journey.afterFailure.receipt, null);
  assert.deepEqual(journey.attemptedIds, [journey.submitted.id, journey.submitted.id]);
  assert.equal(new Set(journey.attemptedPayloads).size, 1); assert.equal(journey.restoredAgain.length, 1);
  assert.equal(journey.confirmed.receipt.challengeChanges.length, 1);
});
