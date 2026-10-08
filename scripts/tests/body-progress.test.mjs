import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
const modules = new Map();
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
const client = new SyntheticModule(['supabase'], function () { this.setExport('supabase', {}); });
const schema = new SyntheticModule(['progressResponse'], function () { this.setExport('progressResponse', { parse: (data) => data }); });
async function load(path) {
  const module = source(path);
  await module.link((specifier, parent) => {
    if (specifier === '@/lib/supabase') return client;
    if (specifier.endsWith('validation/progress-response')) return schema;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  });
  await module.evaluate(); return module.namespace;
}
const units = await load('src/utils/units.ts');
const rules = await load('src/features/progress/services/measurement-rules.ts');
const { MeasurementService } = await load('src/features/progress/services/measurement-service.ts');
const { SupabaseMeasurementRepository } = await load('src/data/repositories/supabase/supabase-measurement-repository.ts');
const owner = '95000000-0000-0000-0000-000000000001';
const id = '95000000-0000-0000-0000-000000000002';
const form = () => rules.emptyMeasurementForm(new Date(2020, 0, 2));
const input = () => rules.parseMeasurementForm({ ...form(), weightKg: '80' }, 'metric');
const row = { id, user_id: owner, recorded_at: '2020-01-02T00:00:00.000Z', weight_kg: 80, body_fat_percentage: null, chest_cm: null, waist_cm: 90, hips_cm: null, left_arm_cm: null, right_arm_cm: null, left_thigh_cm: null, right_thigh_cm: null };
function transport(data, error = null) {
  const calls = [];
  const query = { then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject) };
  for (const method of ['select', 'eq', 'order', 'range', 'abortSignal', 'maybeSingle', 'update', 'insert', 'delete']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  return { repository: new SupabaseMeasurementRepository({ from: (...args) => { calls.push(['from', ...args]); return query; }, rpc: (...args) => { calls.push(['rpc', ...args]); return query; } }), calls };
}
test('mass and length conversions round-trip without premature rounding', () => {
  assert.ok(Math.abs(units.kilogramsToPounds(80) - 176.36980974790205) < 1e-9);
  assert.equal(units.inchesToCentimetres(10), 25.4);
  for (const n of [20, 80.1234, 500]) assert.ok(Math.abs(units.poundsToKilograms(units.kilogramsToPounds(n)) - n) < 1e-9);
  assert.equal(units.fromCanonical(20, 'bodyFatPercentage', 'imperial'), 20);
  assert.equal(units.measurementUnit('leftThighCm', 'imperial'), 'in');
});
test('imperial form values become canonical kg/cm and preserve empty values', () => {
  const result = rules.parseMeasurementForm({ ...form(), weightKg: '176.37', waistCm: '35.43', bodyFatPercentage: '20,5' }, 'imperial');
  assert.equal(result.weightKg, 80); assert.equal(result.waistCm, 89.99); assert.equal(result.bodyFatPercentage, 20.5); assert.equal(result.leftArmCm, null);
});
test('circumference-only entries work, empty entries do not', () => {
  assert.equal(rules.parseMeasurementForm({ ...form(), leftArmCm: '32' }, 'metric').weightKg, null);
  assert.throws(() => rules.parseMeasurementForm(form(), 'metric'), /at least one/);
});
test('reject impossible dates, future dates, non-finite and nonsensical values', () => {
  const now = new Date(2020, 0, 2);
  for (const date of ['2020-02-30', '2020-1-02', '2020-01-03', '1899-12-31']) assert.equal(rules.validMeasurementDate(date, now), false);
  assert.equal(rules.validMeasurementDate('2000-02-29', now), true);
  for (const text of ['-5', '0', '501', 'Infinity', 'NaN', '1e2', '12abc']) assert.throws(() => rules.parseMeasurementForm({ ...form(), weightKg: text }, 'metric'));
  assert.throws(() => rules.parseMeasurementForm({ ...form(), bodyFatPercentage: '76' }, 'metric'));
});
test('editing untouched imperial values never drifts stored measurements', () => {
  const original = { ...input(), weightKg: 80.12, waistCm: 91.23 };
  const displayed = rules.measurementToForm(original, 'imperial');
  assert.deepEqual(rules.formToMeasurement(displayed, 'imperial', original), original);
  assert.equal(rules.formToMeasurement({ ...displayed, weightKg: '180' }, 'imperial', original).waistCm, original.waistCm);
});
test('previous and starting changes are independent and handle missing baselines', () => {
  assert.deepEqual(rules.summaryChanges({ latest: 78, previous: 80, starting: 85, recordedAt: null }), { previous: -2, starting: -7 });
  assert.deepEqual(rules.summaryChanges({ latest: 80, previous: null, starting: 80, recordedAt: null }), { previous: null, starting: 0 });
  assert.deepEqual(rules.summaryChanges({ latest: null, previous: null, starting: null, recordedAt: null }), { previous: null, starting: null });
  assert.match(rules.formatMeasurement(2, 'waistCm', 'imperial', true), /^\+0.8 in$/);
});
test('chart geometry follows real elapsed time, constant series and singleton are finite', () => {
  const points = [{ date: '2020-01-01', value: 80 }, { date: '2020-01-02', value: 79 }, { date: '2020-01-11', value: 78 }];
  assert.deepEqual(rules.chartGeometry(points, 100, 100), [{ x: 0, y: 0 }, { x: 10, y: 50 }, { x: 100, y: 100 }]);
  assert.deepEqual(rules.chartGeometry([points[0]], 100, 100), [{ x: 50, y: 50 }]);
  assert.deepEqual(rules.chartGeometry([], 100, 100), []);
  assert.equal(rules.chartGeometry(points.map((p) => ({ ...p, value: 80 })), 100, 100)[1].y, 50);
});
test('service validates input before create/edit/delete and delegates canonical values', async () => {
  const calls = []; const service = new MeasurementService({ save: async (...args) => { calls.push(['save', ...args]); return { ...args[1], id, userId: owner }; }, remove: async (...args) => { calls.push(['remove', ...args]); } });
  await service.save(owner, input()); await service.save(owner, input(), id); await service.remove(owner, id);
  assert.equal(calls.length, 3); assert.equal(calls[1][3], id);
  assert.throws(() => service.save(owner, { ...input(), weightKg: -1 })); assert.throws(() => service.remove(owner, 'bad')); assert.throws(() => service.list(owner, -1));
  assert.throws(() => service.save(owner, { ...input(), recordedAt: '2020-02-30T00:00:00.000Z' }));
});
test('history query paginates 20 rows, orders date/UUID and is explicitly owner-scoped', async () => {
  const { repository, calls } = transport(Array(21).fill(row)); const signal = new AbortController().signal;
  const result = await repository.list(owner, 20, signal);
  assert.equal(result.entries.length, 20); assert.equal(result.nextOffset, 40);
  assert.ok(calls.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === owner));
  assert.deepEqual(calls.filter((c) => c[0] === 'order').map((c) => c[1]), ['recorded_at', 'id']);
  assert.deepEqual(calls.find((c) => c[0] === 'range'), ['range', 20, 40]);
  assert.equal((await transport([]).repository.list(owner, 0)).nextOffset, null);
});
test('writes exclude owner changes on edit, constrain deletes and reject missing rows/errors', async () => {
  const create = transport(row); await create.repository.save(owner, input()); assert.equal(create.calls.find((c) => c[0] === 'insert')[1].user_id, owner);
  const edit = transport(row); await edit.repository.save(owner, input(), id); assert.equal('user_id' in edit.calls.find((c) => c[0] === 'update')[1], false);
  const remove = transport([{ id }]); await remove.repository.remove(owner, id); assert.ok(remove.calls.some((c) => c[0] === 'eq' && c[1] === 'user_id'));
  await assert.rejects(transport([]).repository.remove(owner, id), /no longer/);
  await assert.rejects(transport(null).repository.save(owner, input(), id), /could not be saved/);
  await assert.rejects(transport(null, { code: '23514', message: 'private details' }).repository.save(owner, input()), /Check your measurement/);
});
test('dashboard queries send only period, never a spoofable owner argument', async () => {
  const { repository, calls } = transport({ count: 0, points: [], summaries: {} }); await repository.dashboard('all');
  assert.deepEqual(calls[0], ['rpc', 'get_body_progress', { p_period: 'all', p_today: rules.localDate() }]);
});
