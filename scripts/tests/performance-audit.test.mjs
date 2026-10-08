import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule } from 'node:vm';

const modules = new Map();
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const module = source(path);
  await module.link((specifier, parent) => source(`${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`));
  await module.evaluate(); return module.namespace;
}
const { createSessionHistorySelector } = await load('src/features/workouts/services/session-history-selector.ts');
const { ForegroundRefresh } = await load('src/services/realtime/foreground-refresh.ts');
const { QueryPerformanceMetrics } = await load('src/services/performance/query-performance.ts');
const { dashboardDay } = await load('src/features/home/services/dashboard-clock.ts');
const session = (id, time, owner = 'owner') => ({ id, name: `Workout ${id}`, userId: owner, startedAt: time, submittedAt: null, syncStatus: 'pending', exercises: [] });

test('history logs do not change selected references or retain set contents', () => {
  const rows = [session('a', 1), session('b', 2)]; const select = createSessionHistorySelector('owner', 30);
  const first = select(rows);
  const second = select([{ ...rows[0], exercises: [{ sets: [{ reps: 20 }] }] }, rows[1]]);
  assert.equal(second, first); assert.equal(second.items[0].id, 'b');
  assert.equal('exercises' in second.items[0], false); assert.equal(rows[0].id, 'a');
});
test('history changes only affected row references for name, submission or sync', () => {
  const rows = [session('a', 1), session('b', 2)]; const select = createSessionHistorySelector('owner', 30);
  const first = select(rows);
  for (const patch of [{ name: 'Renamed' }, { submittedAt: 50 }, { syncStatus: 'synced' }]) {
    const changed = select([{ ...rows[0], ...patch }, rows[1]]);
    assert.notEqual(changed, first); assert.equal(changed.items[0], first.items[0]);
    assert.notEqual(changed.items[1], first.items[1]);
  }
});
test('history owner isolation, deterministic ties and non-destructive local pagination', () => {
  const rows = [session('b', 4), session('foreign', 9, 'other'), session('a', 4), session('c', 3)];
  const first = createSessionHistorySelector('owner', 2)(rows);
  assert.equal(first.total, 3); assert.deepEqual(first.items.map((row) => row.id), ['a', 'b']);
  assert.deepEqual(createSessionHistorySelector('owner', 30)(rows).items.map((row) => row.id), ['a', 'b', 'c']);
  assert.equal(rows.length, 4); assert.equal(createSessionHistorySelector('', 30)(rows).total, 0);
});
test('history detects removal and insertion even with unchanged count', () => {
  const select = createSessionHistorySelector('owner', 30); const before = select([session('a', 1)]);
  const after = select([session('b', 1)]); assert.notEqual(before, after); assert.equal(after.items[0].id, 'b');
  assert.equal(select([]).total, 0);
});
test('foreground lifecycle releases channels and timers, ignores late events and resumes once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let subscriptions = 0; let releases = 0; let fetches = 0; const events = [];
  const lifecycle = new ForegroundRefresh((changed) => { subscriptions++; events.push(changed); return () => releases++; }, async () => { fetches++; });
  lifecycle.setActive(false); assert.equal(subscriptions, 0);
  lifecycle.setActive(true); lifecycle.setActive(true); assert.equal(subscriptions, 1);
  t.mock.timers.tick(500); await Promise.resolve(); assert.equal(fetches, 1);
  lifecycle.setActive(false); assert.equal(releases, 1);
  events[0](); lifecycle.schedule(); t.mock.timers.tick(120000); await Promise.resolve(); assert.equal(fetches, 1);
  lifecycle.setActive(true); assert.equal(subscriptions, 2);
  t.mock.timers.tick(500); await Promise.resolve(); assert.equal(fetches, 2);
  lifecycle.dispose(); lifecycle.dispose(); assert.equal(releases, 2);
});
test('refresh burst during an in-flight request produces one trailing fetch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let calls = 0; let finish; let event;
  const lifecycle = new ForegroundRefresh((changed) => { event = changed; return () => {}; }, () => { calls++; return calls === 1 ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(); });
  lifecycle.setActive(true); for (let i = 0; i < 1000; i++) event();
  t.mock.timers.tick(500); assert.equal(calls, 1);
  for (let i = 0; i < 1000; i++) event();
  t.mock.timers.tick(500); assert.equal(calls, 1);
  finish(); await Promise.resolve(); t.mock.timers.tick(500); assert.equal(calls, 2);
  lifecycle.dispose();
});
test('monitoring is bounded and its output contains no query hashes or secrets', () => {
  let now = 0; const monitor = new QueryPerformanceMetrics(() => now);
  for (let i = 0; i < 1000; i++) { monitor.start(`secret-${i}`); now++; monitor.finish(`secret-${i}`, i % 10 === 0); }
  const snapshot = monitor.snapshot(); assert.equal(snapshot.samples, 120); assert.equal(snapshot.failures, 100);
  assert.equal(JSON.stringify(snapshot).includes('secret'), false);
  for (let i = 0; i < 1000; i++) monitor.start(`pending-${i}`);
  assert.equal(monitor.snapshot().inFlight, 256);
  monitor.discard('pending-999'); assert.equal(monitor.snapshot().inFlight, 255);
  monitor.clear(); assert.equal(monitor.snapshot().inFlight, 0); assert.equal(monitor.snapshot().samples, 0);
});
test('dashboard day key rolls at local midnight, rather than refetching yesterday', () => {
  assert.equal(dashboardDay(new Date(2026, 9, 7, 23, 59)), '2026-10-7');
  assert.equal(dashboardDay(new Date(2026, 9, 8, 0, 0)), '2026-10-8');
});
