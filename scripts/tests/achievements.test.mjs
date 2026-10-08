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
function stub(values) { return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }); }
const supabase = stub({ supabase: {} });
const schema = stub({ achievementResponse: { parse: (data) => data } });
async function load(path) {
  const module = source(path);
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    if (specifier === '@/lib/supabase') return supabase;
    if (specifier.endsWith('validation/achievement-response')) return schema;
    return source(specifier.startsWith('@/') ? 'src/' + specifier.slice(2) + '.ts' : posix.normalize(posix.join(posix.dirname(parent.identifier), specifier)) + '.ts');
  });
  if (module.status !== 'evaluated') await module.evaluate(); return module.namespace;
}
const rules = await load('src/features/achievements/services/achievement-rules.ts');
const { AchievementService } = await load('src/features/achievements/services/achievement-service.ts');
const { SupabaseAchievementRepository } = await load('src/data/repositories/supabase/supabase-achievement-repository.ts');
const { achievementEventTypes } = await load('src/domain/events/achievement-event.ts');
const migration = readFileSync('supabase/migrations/202610060017_achievement_system.sql', 'utf8');
const seed = readFileSync('supabase/seed.sql', 'utf8');
const catalog = [...migration.matchAll(/\('20000000[^']*','([^']+)','([^']+)','[^']*','([^']+)','([^']+)','([^']+)',(\d+),(true|false)\)/g)]
  .map(([, code, title, icon, category, metric, target, active]) => ({ code, title, icon, category, metric, target: Number(target), active: active === 'true' }));
const owner = '97000000-0000-0000-0000-000000000001';
const other = '97000000-0000-0000-0000-000000000002';
const badge = (overrides = {}) => ({ id: other, description: 'Description', code: 'VOLUME_100000', title: 'Marathon Lifter', category: 'volume', metric: 'total_volume', icon: 'fitness-outline', current: 72500, target: 100000, active: true, unlockedAt: null, presentedAt: null, ...overrides });

test('catalog has all 17 requested active badges, exactly one retained legacy badge, matching seed', () => {
  assert.equal(catalog.filter((a) => a.active).length, 17); assert.equal(catalog.length, 18);
  assert.equal(new Set(catalog.map((a) => a.code)).size, 18);
  assert.deepEqual(catalog.filter((a) => a.active && a.category === 'consistency').map((a) => a.target), [1, 5, 10, 50, 100]);
  assert.deepEqual(catalog.filter((a) => a.category === 'streaks').map((a) => a.target), [3, 7, 30]);
  assert.deepEqual(catalog.filter((a) => a.active && a.category === 'strength').map((a) => a.target), [1, 10]);
  assert.deepEqual(catalog.filter((a) => a.category === 'volume').map((a) => a.target), [10000, 100000, 1000000]);
  assert.deepEqual(catalog.filter((a) => a.category === 'social').map((a) => [a.metric, a.target]), [['friend_count', 1], ['challenges_joined', 1], ['challenge_wins', 1], ['challenges_completed', 5]]);
  const catalogSql = migration.slice(migration.indexOf('insert into public.achievements('), migration.indexOf('-- Trusted'));
  assert.ok(seed.includes(catalogSql.trim()));
});
for (const entry of catalog.filter((a) => a.active)) {
  for (const [label, current, expected] of [['below', entry.target - 1, false], ['exact', entry.target, true], ['above', entry.target + 1, true]]) {
    test(entry.code + ' threshold ' + label, () => assert.equal(rules.thresholdReached(current, entry.target), expected));
  }
}
test('invalid/non-finite thresholds cannot unlock', () => {
  for (const pair of [[NaN, 1], [Infinity, 1], [1, Infinity], [1, NaN], [1, 0], [1, -1], [-1, 1]]) assert.equal(rules.thresholdReached(...pair), false);
});
test('locked badge shows uncooked canonical volume progress and clamps display at target', () => {
  assert.equal(rules.progressLabel(badge()), '72,500 / 100,000 kg');
  assert.equal(rules.achievementProgress(badge()).percent, 72.5);
  assert.equal(rules.achievementProgress(badge({ current: 200000 })).percent, 100);
  assert.equal(rules.achievementProgress(badge({ current: -1 })).percent, 0);
  assert.equal(rules.achievementProgress(badge({ current: NaN })).percent, 0);
});
test('pending presentation excludes locked, acknowledged and locally hidden badges, sorted deterministically', () => {
  const date = '2026-10-01T00:00:00Z';
  const a = badge({ id: 'a', code: 'A', unlockedAt: date });
  const b = badge({ id: 'b', code: 'B', unlockedAt: date });
  assert.deepEqual(rules.pendingUnlocks([b, badge(), a, badge({ id: 'c', unlockedAt: date, presentedAt: date })], new Set(['b'])).map((a) => a.id), ['a']);
  assert.deepEqual(rules.pendingUnlocks([b, a], new Set()).map((a) => a.id), ['a', 'b']);
});
test('every domain event reconciles trusted facts without accepting client scores', async () => {
  const calls = []; const service = new AchievementService({ reconcile: async (...args) => { calls.push(args); } });
  for (const type of achievementEventTypes) await service.handleEvent(owner, { type, userId: owner, eventId: other, sourceId: other, occurredAt: '2026-10-01T00:00:00Z', count: 100000 });
  assert.equal(calls.length, 6); assert.ok(calls.every((args) => args.length === 1 && args[0] === owner));
});
test('service rejects foreign, malformed and unknown events before database access', () => {
  const service = new AchievementService({ reconcile: () => { throw Error('must not call'); } });
  const event = { type: 'WorkoutCompleted', userId: owner, eventId: other, sourceId: other, occurredAt: '2026-10-01T00:00:00Z' };
  for (const change of [{ userId: other }, { type: 'Forged' }, { sourceId: 'bad' }, { eventId: 'bad' }, { occurredAt: 'bad' }]) assert.throws(() => service.handleEvent(owner, { ...event, ...change }));
});
function transport(error = null) {
  const calls = []; const handlers = []; let connected; let removed = false;
  const query = { then: (resolve, reject) => Promise.resolve({ data: { entries: [] }, error }).then(resolve, reject), abortSignal: (signal) => { calls.push(['abort', signal]); return query; } };
  const channel = { on: (...args) => { handlers.push(args); return channel; }, subscribe: (fn) => { connected = fn; return channel; } };
  const client = { rpc: (...args) => { calls.push(args); return query; }, channel: () => channel, removeChannel: async () => { removed = true; } };
  return { repository: new SupabaseAchievementRepository(client), calls, handlers, connect: () => connected('SUBSCRIBED'), removed: () => removed };
}
test('repository uses owner-scoped RPCs, abort signal, never direct award inserts', async () => {
  const t = transport(); const signal = new AbortController().signal;
  assert.deepEqual(await t.repository.list(owner, signal), { entries: [] });
  await t.repository.reconcile(owner); await t.repository.acknowledge(owner, other);
  assert.deepEqual(t.calls, [['get_my_achievements', { p_user: owner }], ['abort', signal], ['reconcile_achievements', { p_user: owner }], ['acknowledge_achievement', { p_user: owner, p_id: other }]]);
});
test('repository produces safe network/authorization errors', async () => {
  for (const [code, expected] of [['42501', 'AUTHORIZATION'], ['08006', 'NETWORK']]) await assert.rejects(transport({ code, message: 'secret internals' }).repository.list(owner), (error) => error.code === expected && !error.message.includes('secret'));
});
test('realtime owner filter, validated event hints, reconnect and cleanup', async () => {
  const t = transport(); const events = []; let awards = 0; let reconnect = 0;
  const stop = t.repository.subscribe(owner, (e) => events.push(e), () => awards++, () => reconnect++);
  assert.equal(t.handlers[0][1].filter, 'user_id=eq.' + owner);
  const row = { user_id: owner, id: other, source_id: other, event_type: 'FriendAdded', occurred_at: '2026-10-01T00:00:00Z' };
  t.handlers[0][2]({ new: { ...row, user_id: other } }); t.handlers[0][2]({ new: { ...row, event_type: 'Forged' } });
  t.handlers[0][2]({ new: row }); t.handlers[1][2](); t.connect();
  assert.equal(events.length, 1); assert.equal(events[0].type, 'FriendAdded'); assert.equal(awards, 1); assert.equal(reconnect, 1);
  stop(); await Promise.resolve(); t.handlers[0][2]({ new: row }); t.handlers[1][2](); t.connect();
  assert.ok(t.removed()); assert.equal(events.length, 1); assert.equal(awards, 1); assert.equal(reconnect, 1);
});
test('SQL uses confirmed facts, UTC longest streak, idempotent inserts and owner authorization', () => {
  assert.doesNotMatch(migration, /(?:\bas|\bend;)\s+\$(?!\$)/m);
  for (const pattern of [/sync_status='synced'/, /at time zone 'UTC'/, /select distinct .*::date as workout_day/, /coalesce\(max\(streak_length\),0\)/, /ws.completed and ws.is_personal_record/, /on conflict\(user_id,achievement_id\) do nothing/, /auth.uid\(\) is distinct from p_user/, /where user_id=p_user and achievement_id=p_id/]) assert.match(migration, pattern);
  assert.doesNotMatch(migration, /::date\s+day\b/);
  assert.match(migration, /workout_day-row_number\(\) over\(order by workout_day\)::integer as streak_group/);
  assert.match(migration, /awarded := private.evaluate_achievements\(actor\)/);
  assert.match(migration, /where id=any\(ids\)/);
  assert.match(migration, /end_date\+7</);
  assert.match(migration, /left_at is null and completed and rank=1/);
  assert.match(migration, /after insert on public.user_achievements/);
  assert.match(migration, /revoke all on function public.finalize_achievement_challenges\(\) from public,anon,authenticated/);
});
