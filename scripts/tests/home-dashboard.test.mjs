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
const schema = new SyntheticModule(['dashboardResponse'], function () { this.setExport('dashboardResponse', { parse: (value) => value }); });
async function load(path) {
  const module = source(path);
  await module.link((specifier, parent) => {
    if (specifier === '@/lib/supabase') return client;
    if (specifier.endsWith('validation/dashboard-response')) return schema;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
  });
  await module.evaluate(); return module.namespace;
}
const rules = await load('src/features/home/services/dashboard-rules.ts');
const { DashboardService } = await load('src/features/home/services/dashboard-service.ts');
const { SupabaseDashboardRepository } = await load('src/data/repositories/supabase/supabase-dashboard-repository.ts');
test('greeting changes at noon and evening', () => {
  assert.equal(rules.greeting(0), 'Good morning'); assert.equal(rules.greeting(11), 'Good morning');
  assert.equal(rules.greeting(12), 'Good afternoon'); assert.equal(rules.greeting(18), 'Good evening');
});
test('volume honors preferred units without changing canonical data', () => {
  assert.equal(rules.volumeLabel(100, 'metric'), '100 kg'); assert.equal(rules.volumeLabel(100, 'imperial'), '220 lb');
});
test('challenge end dates are inclusive UTC, not device-local midnight', () => {
  assert.equal(rules.challengeRemaining('2026-10-07', new Date('2026-10-07T23:30:00Z')), '1 hour left');
  assert.equal(rules.challengeRemaining('2026-10-07', new Date('2026-10-08T00:00:00Z')), 'Ended');
  assert.equal(rules.challengeRemaining('2026-10-07', new Date('2026-10-06T00:00:00Z')), '2 days left');
});
test('progress is capped without capping the actual challenge value', () => {
  assert.equal(rules.progressPercentage(25, 20), 100); assert.equal(rules.progressPercentage(5, 20), 25);
  assert.equal(rules.progressPercentage(0, 0), 0); assert.equal(rules.progressPercentage(-1, 20), 0);
});
test('query keys isolate accounts, timezones and calendar rollovers', () => {
  const key = rules.dashboardKeys.snapshot('a', 'UTC', '2026-10-7');
  for (const args of [['b', 'UTC', '2026-10-7'], ['a', 'Europe/Skopje', '2026-10-7'], ['a', 'UTC', '2026-10-8']]) assert.notDeepEqual(key, rules.dashboardKeys.snapshot(...args));
});
test('repository makes exactly one RPC and forwards cancellation', async () => {
  const calls = []; const signal = new AbortController().signal;
  const query = { abortSignal: (value) => { calls.push(value); return query; }, then: (resolve) => resolve({ data: { today: { workouts: 1 } }, error: null }) };
  const repository = new SupabaseDashboardRepository({ rpc: (...args) => { calls.push(args); return query; } });
  const result = await new DashboardService(repository).load('UTC', signal);
  assert.deepEqual(calls, [['get_home_dashboard', { p_timezone: 'UTC' }], signal]); assert.equal(result.today.workouts, 1);
});
test('repository reports understandable permission and network failures', async () => {
  for (const [code, expected] of [['42501', 'AUTHORIZATION'], ['503', 'NETWORK']]) {
    const repository = new SupabaseDashboardRepository({ rpc: () => Promise.resolve({ data: null, error: { code, message: 'internal' } }) });
    await assert.rejects(repository.load('UTC'), (error) => error.code === expected && /Check your connection/.test(error.message));
  }
});
test('SQL confines private data to the actor and bounds activity', () => {
  const sql = readFileSync('supabase/migrations/202610070018_home_dashboard.sql', 'utf8');
  for (const pattern of [/actor uuid := auth.uid\(\)/, /actor is null/, /user_id=actor/g, /owner_id=actor/, /status='accepted'/, /private.can_view_challenge\(c.id\)/, /limit 3/, /limit 8/, /sync_status='synced'/, /security definer set search_path = ''/, /from public,anon/, /pg_catalog.pg_timezone_names/]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /photo_url|weight_kg|date_of_birth|email/);
});
