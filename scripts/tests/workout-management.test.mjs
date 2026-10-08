import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

// Execute actual services, cache helpers, reorder and adapter without native dependencies.
// Zod is an explicitly stubbed boundary here; real validation is covered by Jest.
const modules = new Map();
const supabaseStub = new SyntheticModule(['supabase'], function () { this.setExport('supabase', {}); });
const schemaStub = new SyntheticModule(['workoutSchema'], function () { this.setExport('workoutSchema', { parse: (input) => input }); });
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const module = source(path);
  await module.link((specifier, parent) => {
    if (specifier === '@/lib/supabase') return supabaseStub;
    if (specifier.endsWith('/validation/workout-schema')) return schemaStub;
    const resolved = specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`;
    return source(resolved);
  });
  await module.evaluate(); return module.namespace;
}
const { reorderItems } = await load('src/features/workouts/utils/reorder.ts');
const { optimisticWorkoutPage, rollbackWorkoutPage, workoutKeys } = await load('src/features/workouts/services/workout-cache.ts');
const { SupabaseWorkoutRepository } = await load('src/data/repositories/supabase/supabase-workout-repository.ts');
const { WorkoutService } = await load('src/features/workouts/services/workout-service.ts');
const { input, workout } = await load('src/features/workouts/testing/fixtures.ts');
const row = { id: workout.id, owner_id: 'owner', name: input.name, description: input.description, is_public: false,
  estimated_duration: 1800, created_at: workout.createdAt, updated_at: workout.updatedAt };

function transport(data, error = null) {
  const calls = [];
  const response = { data, error };
  const query = {};
  for (const method of ['select', 'eq', 'order', 'range', 'abortSignal']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
  query.maybeSingle = () => Promise.resolve(response);
  const client = { from: (name) => { assert.equal(name, 'workouts'); return query; }, rpc: (...args) => { calls.push(['rpc', ...args]); return query; } };
  return { repository: new SupabaseWorkoutRepository(client), calls };
}

test('reorder moves both directions immutably with per-occurrence configuration', () => {
  const items = [{ id: 'same', sets: 3 }, { id: 'same', sets: 5 }, { id: 'third', sets: 2 }];
  assert.deepEqual(reorderItems(items, 0, 2), [items[1], items[2], items[0]]);
  assert.deepEqual(reorderItems(items, 2, 0), [items[2], items[0], items[1]]);
  assert.equal(items[0].sets, 3);
  for (const [from, to] of [[-1, 0], [0, 3], [0.5, 1], [0, 0]]) assert.deepEqual(reorderItems(items, from, to), items);
});
test('optimistic edits and deletes affect only the target row and rollback preserves unrelated edits', () => {
  const other = { ...workout, id: 'other' };
  const before = { items: [workout, other], nextOffset: 20 };
  const changed = optimisticWorkoutPage(before, workout.id, { ...workout, name: 'Changed' });
  assert.equal(changed.items[0].name, 'Changed');
  const deleted = optimisticWorkoutPage(before, workout.id, null);
  assert.deepEqual(deleted.items, [other]);
  const concurrent = { ...deleted, items: [{ ...other, name: 'Other changed' }] };
  assert.deepEqual(rollbackWorkoutPage(concurrent, before, workout.id).items.map((item) => item.name), [workout.name, 'Other changed']);
  assert.equal(before.items[0].name, workout.name);
});
test('query keys isolate owner pages and details', () => {
  assert.notDeepEqual(workoutKeys.list('owner', 0), workoutKeys.list('other', 0));
  assert.notDeepEqual(workoutKeys.list('owner', 0), workoutKeys.list('owner', 20));
  assert.deepEqual(workoutKeys.lists('owner'), ['workouts', 'owner', 'owner']);
});
test('list queries are owner-scoped, bounded and cancellable', async () => {
  const { repository, calls } = transport(Array.from({ length: 21 }, (_, index) => ({ ...row, id: String(index) })));
  const signal = new AbortController().signal;
  const page = await repository.listByOwner('owner', 20, signal);
  assert.equal(page.items.length, 20); assert.equal(page.nextOffset, 40);
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'owner_id' && call[2] === 'owner'));
  assert.ok(calls.some((call) => call[0] === 'range' && call[1] === 20 && call[2] === 40));
  assert.ok(calls.some((call) => call[0] === 'abortSignal' && call[1] === signal));
});
test('details restore configured order and preserve notes and optional weight', async () => {
  const entry = { id: 'entry', exercise_id: input.exercises[0].exerciseId, target_sets: 3, target_reps: 10,
    target_weight: null, rest_seconds: 60, notes: 'Brace', exercises: { name: 'Squat' } };
  const { repository } = transport({ ...row, workout_exercises: [{ ...entry, order_index: 1 }, { ...entry, id: 'first', order_index: 0 }] });
  const detail = await repository.findById(row.id);
  assert.deepEqual(detail.exercises.map((item) => item.id), ['first', 'entry']);
  assert.equal(detail.exercises[0].weight, null); assert.equal(detail.exercises[0].notes, 'Brace');
});
test('create and edit use the aggregate RPC with all exercise configuration', async () => {
  const { repository, calls } = transport(row.id);
  assert.equal(await repository.save(input), row.id);
  await repository.save(input, row.id, row.updated_at);
  assert.equal(calls[0][1], 'save_workout');
  assert.equal(calls[0][2].p_workout_id, null);
  assert.deepEqual(calls[0][2].p_exercises[0], { exercise_id: input.exercises[0].exerciseId, target_sets: 3, target_reps: 10, target_weight: 20, rest_seconds: 60, notes: 'Brace' });
  assert.equal(calls[1][2].p_expected_updated_at, row.updated_at);
});
test('delete sends the expected version and maps conflicts into actionable errors', async () => {
  const { repository, calls } = transport(null);
  await repository.delete(row.id, row.updated_at);
  assert.deepEqual(calls[0], ['rpc', 'delete_workout', { p_workout_id: row.id, p_expected_updated_at: row.updated_at }]);
  await assert.rejects(transport(null, { code: '40001', message: 'Conflict' }).repository.delete(row.id, row.updated_at), { code: 'CONFLICT' });
});
test('create, edit, delete and duplicate service delegate correctly for valid inputs', async () => {
  const calls = [];
  const repository = { findById: async () => workout, save: async (...args) => { calls.push(['save', ...args]); return workout.id; },
    delete: async (...args) => calls.push(['delete', ...args]) };
  const service = new WorkoutService(repository);
  await service.create(input); await service.edit('owner', workout.id, workout.updatedAt, input);
  await service.delete('owner', workout.id, workout.updatedAt); await service.duplicate(workout.id);
  assert.deepEqual(calls[0], ['save', input]);
  assert.deepEqual(calls[1], ['save', input, workout.id, workout.updatedAt]);
  assert.deepEqual(calls[2], ['delete', workout.id, workout.updatedAt]);
  assert.equal(calls[3][1].name, 'Strength A (copy)'); assert.equal(calls[3][1].isPublic, false);
  assert.deepEqual(calls[3][1].exercises, input.exercises);
});
test('service rejects edits or deletes from another owner before writing', async () => {
  let writes = 0;
  const service = new WorkoutService({ findById: async () => workout, save: async () => { writes++; }, delete: async () => { writes++; } });
  await assert.rejects(service.edit('other', workout.id, workout.updatedAt, input), { code: 'AUTHORIZATION' });
  await assert.rejects(service.delete('other', workout.id, workout.updatedAt), { code: 'AUTHORIZATION' });
  assert.equal(writes, 0);
});
test('missing detail and transport failures are not silently treated as success', async () => {
  assert.equal(await transport(null).repository.findById(row.id), null);
  await assert.rejects(transport(null, { message: 'Offline' }).repository.listByOwner('owner', 0), { code: 'NETWORK' });
  await assert.rejects(new WorkoutService({ findById: async () => null }).requireWorkout(row.id), { code: 'NOT_FOUND' });
});
test('invalid workout identifiers are rejected before querying the repository', async () => {
  const service = new WorkoutService({ findById: async () => assert.fail('Invalid ID must not query the database') });
  await assert.rejects(service.requireWorkout('abc'), { code: 'VALIDATION' });
});
