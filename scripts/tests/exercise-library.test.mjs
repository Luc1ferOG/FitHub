import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

// Executes the actual TypeScript service and adapter with an injected transport.
// Native rendering and TanStack integration are covered separately by Jest.
const modules = new Map();
const paths = {
  '@/domain/errors/app-error': 'src/domain/errors/app-error.ts',
};
const supabaseStub = new SyntheticModule(['supabase'], function () {
  this.setExport('supabase', {});
});

function sourceModule(path) {
  if (!modules.has(path)) {
    modules.set(path, new SourceTextModule(
      stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }),
      { identifier: path },
    ));
  }
  return modules.get(path);
}

async function load(path) {
  const module = sourceModule(path);
  await module.link((specifier) => {
    if (specifier === '@/lib/supabase') return supabaseStub;
    if (paths[specifier]) return sourceModule(paths[specifier]);
    throw new Error(`Unexpected runtime dependency: ${specifier}`);
  });
  await module.evaluate();
  return module.namespace;
}

const { ExerciseService, DEFAULT_EXERCISE_FILTERS, normalizeExerciseFilters } = await load(
  'src/features/exercises/services/exercise-service.ts',
);
const { SupabaseExerciseRepository, EXERCISE_SUMMARY_COLUMNS, escapeExerciseSearch } = await load(
  'src/data/repositories/supabase/supabase-exercise-repository.ts',
);

const row = {
  id: '10000000-0000-0000-0000-000000000001', name: 'Back Squat',
  primary_muscle: 'quadriceps', equipment: 'barbell', difficulty: 'intermediate', thumbnail_url: null,
};

function transport(data, error = null) {
  const calls = [];
  const response = { data, error };
  const query = {};
  for (const method of ['select', 'order', 'ilike', 'eq', 'range', 'abortSignal']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
  query.maybeSingle = () => Promise.resolve(response);
  const client = {
    from: (table) => { assert.equal(table, 'exercises'); return query; },
    rpc: (name) => { assert.equal(name, 'get_exercise_filter_options'); return query; },
  };
  return { repository: new SupabaseExerciseRepository(client), calls };
}

test('search normalization preserves literal wildcard input and caps input length', () => {
  assert.equal(normalizeExerciseFilters({ ...DEFAULT_EXERCISE_FILTERS, search: ' SQUAT_% ' }).search, 'squat_%');
  assert.equal(escapeExerciseSearch('squat_%'), 'squat\\_\\%');
  assert.equal(normalizeExerciseFilters({ ...DEFAULT_EXERCISE_FILTERS, search: 'a'.repeat(101) }).search.length, 100);
});

test('repository combines search, three filters, deterministic ordering, and cancellation', async () => {
  const { repository, calls } = transport([row]);
  const signal = new AbortController().signal;
  const page = await repository.list({ search: 'squat_%', muscle: 'quadriceps', equipment: 'barbell', difficulty: 'intermediate' }, 20, 20, signal);
  assert.deepEqual(calls, [
    ['select', EXERCISE_SUMMARY_COLUMNS], ['order', 'name', { ascending: true }], ['order', 'id', { ascending: true }],
    ['ilike', 'name', '%squat\\_\\%%'], ['eq', 'primary_muscle', 'quadriceps'],
    ['eq', 'equipment', 'barbell'], ['eq', 'difficulty', 'intermediate'], ['range', 20, 40], ['abortSignal', signal],
  ]);
  assert.equal(page.items[0].primaryMuscle, 'quadriceps');
  assert.equal(page.nextOffset, null);
});

test('lookahead row creates a next page without leaking it into current results', async () => {
  const { repository } = transport(Array.from({ length: 21 }, (_, index) => ({ ...row, id: String(index) })));
  const page = await repository.list(DEFAULT_EXERCISE_FILTERS, 0, 20);
  assert.equal(page.items.length, 20);
  assert.equal(page.nextOffset, 20);
});

test('a full terminal page and an empty catalogue stop pagination', async () => {
  for (const count of [0, 20]) {
    const { repository, calls } = transport(Array.from({ length: count }, () => row));
    const page = await repository.list(DEFAULT_EXERCISE_FILTERS, 0, 20);
    assert.equal(page.nextOffset, null);
    assert.equal(calls.some(([method]) => method === 'eq' || method === 'ilike'), false);
  }
});

test('detail fields are mapped and missing IDs return null', async () => {
  const { repository } = transport({ ...row, description: 'Guide', instructions: ['Brace'], secondary_muscles: ['glutes'],
    form_tips: ['Stay balanced'], common_mistakes: ['Knees collapsing'], video_url: null });
  const detail = await repository.findById(row.id);
  assert.deepEqual(detail.formTips, ['Stay balanced']);
  assert.deepEqual(detail.commonMistakes, ['Knees collapsing']);
  assert.equal(await transport(null).repository.findById(row.id), null);
});

test('catalogue filter metadata is validated before use', async () => {
  const options = { muscles: ['quadriceps'], equipment: ['barbell'] };
  assert.deepEqual(await transport(options).repository.getFilterOptions(), options);
  await assert.rejects(() => transport({ muscles: [123], equipment: [] }).repository.getFilterOptions(), { code: 'VALIDATION' });
});

test('backend errors become application errors', async () => {
  await assert.rejects(() => transport(null, { message: 'Offline' }).repository.list(DEFAULT_EXERCISE_FILTERS, 0, 20), { code: 'NETWORK' });
});

test('service enforces bounded pages and rejects invalid detail routes', async () => {
  const { repository, calls } = transport([]);
  const service = new ExerciseService(repository);
  await service.list({ ...DEFAULT_EXERCISE_FILTERS, search: ' SQUAT ' }, 0);
  assert.ok(calls.some(([method, start, end]) => method === 'range' && start === 0 && end === 20));
  assert.throws(() => service.list(DEFAULT_EXERCISE_FILTERS, -1), { code: 'VALIDATION' });
  await assert.rejects(() => service.requireExercise('not-a-uuid'), { code: 'NOT_FOUND' });
});
