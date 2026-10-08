import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const modules = new Map();
function source(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path }));
  return modules.get(path);
}
const supabase = new SyntheticModule(['supabase'], function () { this.setExport('supabase', {}); });
// Response parsing is an external Zod boundary; actual schemas are covered by Jest.
const schemas = new SyntheticModule(['publicUserResponse','friendshipResponse','profileResponse','friendListResponse','searchResponse'], function () {
  for (const name of ['publicUserResponse','friendshipResponse','profileResponse','friendListResponse','searchResponse']) this.setExport(name, { parse: (data) => data });
});
async function load(path) {
  const module = source(path);
  await module.link((specifier) => specifier === '@/lib/supabase' ? supabase : specifier.endsWith('/validation/social-response') ? schemas : source(`src/${specifier.slice(2)}.ts`));
  await module.evaluate(); return module.namespace;
}
const state = source('src/features/social/services/friend-state.ts'); await state.link(() => {}); await state.evaluate();
const service = source('src/features/social/services/social-service.ts');
await service.link((specifier) => specifier === './friend-state' ? state : source(`src/${specifier.slice(2)}.ts`)); await service.evaluate();
const { friendState, canChangeFriend, optimisticRelation, socialKeys } = state.namespace;
const { SocialService, normalizeSearch } = service.namespace;
const { SupabaseSocialRepository, socialPage } = await load('src/data/repositories/supabase/supabase-social-repository.ts');
const owner = '90000000-0000-0000-0000-000000000001';
const target = '90000000-0000-0000-0000-000000000002';
const relation = { id: 'request', requesterId: owner, addresseeId: target, status: 'pending', createdAt: '2026-10-07' };
const row = { id: target, username: 'friend', display_name: 'My Friend', avatar_url: null, bio: null, experience_level: 'beginner' };
function transport(data, error = null) {
  const calls = []; const query = { then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject), maybeSingle: async () => ({ data, error }) };
  for (const method of ['select','or','abortSignal']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  const client = { rpc: (...args) => { calls.push(['rpc', ...args]); return query; }, from: (...args) => { calls.push(['from', ...args]); return query; } };
  return { repository: new SupabaseSocialRepository(client), calls };
}
test('all five friend states and every allowed action', () => {
  assert.equal(friendState(owner, owner, null), 'self');
  assert.equal(friendState(owner, target, null), 'none');
  assert.equal(friendState(owner, target, { ...relation, status: 'declined' }), 'none');
  assert.equal(friendState(owner, target, relation), 'outgoing');
  assert.equal(friendState(target, owner, relation), 'incoming');
  assert.equal(friendState(owner, target, { ...relation, status: 'accepted' }), 'friends');
  const allowed = { self: [], none: ['send'], incoming: ['accept','reject'], outgoing: ['cancel'], friends: ['remove'] };
  for (const [status, actions] of Object.entries(allowed)) for (const action of ['send','accept','reject','cancel','remove']) assert.equal(canChangeFriend(status, action), actions.includes(action));
});
test('service prevents self, duplicate, reverse request and invalid transition writes', () => {
  const calls = []; const sut = new SocialService({ change: (...args) => calls.push(args) });
  for (const [who, action, current] of [[owner,'send',null],[target,'send',relation],[target,'accept',relation],[target,'remove',relation],[target,'send',{ ...relation, requesterId: target, addresseeId: owner }]]) {
    assert.throws(() => sut.change(owner, who, action, current));
  }
  assert.equal(calls.length, 0);
  assert.throws(() => sut.change(owner, target, 'accept', { ...relation, requesterId: 'unrelated', addresseeId: owner }));
  sut.change(owner, target, 'send', null);
  sut.change(target, owner, 'accept', relation);
  sut.change(target, owner, 'reject', relation);
  sut.change(owner, target, 'cancel', relation);
  sut.change(owner, target, 'remove', { ...relation, status: 'accepted' });
  assert.equal(calls.length, 5); assert.deepEqual(calls[1], [owner, 'accept', 'request']);
});
test('search normalization, minimum length, UUID and page guards', async () => {
  const calls = []; const sut = new SocialService({ search: (...args) => calls.push(args), profile: async () => null });
  assert.equal(normalizeSearch('  My   Friend  '), 'My Friend');
  sut.search('  My   Friend  ', 20); assert.deepEqual(calls[0].slice(0, 2), ['My Friend',20]);
  for (const [search, offset] of [['x',0], ['x'.repeat(81),0], ['valid',-1], ['valid',0.5], ['valid',10001]]) assert.throws(() => sut.search(search,offset));
  await assert.rejects(sut.profile('invalid'), /Invalid user/);
  await assert.rejects(sut.profile(target), /unavailable/);
});
test('optimistic accept, reject, cancel and removal are immutable', () => {
  assert.equal(optimisticRelation(relation,'accept').status, 'accepted');
  assert.equal(optimisticRelation(relation,'reject').status, 'declined');
  assert.equal(optimisticRelation(relation,'cancel'), null);
  assert.equal(optimisticRelation({ ...relation, status: 'accepted' },'remove'), null);
  assert.equal(optimisticRelation(null,'send'), null);
  assert.equal(relation.status,'pending');
});
test('keys isolate account, search, list direction and target', () => {
  assert.notDeepEqual(socialKeys.search(owner,'alice'), socialKeys.search(owner,'bob'));
  assert.notDeepEqual(socialKeys.list(owner,'incoming'), socialKeys.list(owner,'outgoing'));
  assert.notDeepEqual(socialKeys.relation(owner,target), socialKeys.relation(target,owner));
});
test('adapter search sends literal search via bounded RPC with cancellation', async () => {
  const { repository,calls } = transport(Array.from({ length: 21 }, () => row)); const abort = new AbortController();
  const page = await repository.search('friend%_,()',20,abort.signal);
  assert.equal(page.items.length,20); assert.equal(page.nextOffset,40); assert.equal(page.items[0].displayName,'My Friend');
  assert.deepEqual(calls[0], ['rpc','search_social_users',{ p_search: 'friend%_,()', p_offset: 20 }]);
  assert.equal(calls[1][1],abort.signal);
  assert.equal(socialPage([],0).nextOffset,null); assert.equal(socialPage(Array(21).fill(row),10000).nextOffset,null);
});
test('incoming, outgoing and friends query correct paginated lists', async () => {
  for (const kind of ['friends','incoming','outgoing']) {
    const { repository,calls } = transport([{ profile: row, friendship: { id: 'request', requester_id: owner, addressee_id: target, status: 'pending', created_at: 'now' } }]);
    const result = await repository.list(kind,0); assert.equal(result.items[0].friendship.requesterId,owner);
    assert.deepEqual(calls[0],['rpc','list_social_friends',{ p_kind: kind,p_offset: 0 }]);
  }
});
test('write RPC uses stale-request identity and maps deleted relation', async () => {
  const { repository,calls } = transport(null);
  assert.equal(await repository.change(target,'remove','request'),null);
  assert.deepEqual(calls[0],['rpc','change_friendship',{ p_target: target,p_action: 'remove',p_expected_id: 'request' }]);
});
test('conflict, authorization and network errors are actionable', async () => {
  for (const [code,expected] of [['23505','CONFLICT'],['40001','CONFLICT'],['42501','AUTHORIZATION'],['','NETWORK']]) {
    const { repository } = transport(null,{ code, message: 'internal secret' });
    await assert.rejects(repository.change(target,'send',null),(error) => error.code === expected && !error.message.includes('secret'));
  }
});
test('public profile projection maps achievements and selected counts only', async () => {
  const { repository } = transport({ profile: row, public_workout_count: 3, achievement_count: 1, achievements: [{ code:'first',title:'First workout',icon:'trophy',unlocked_at:'now' }] });
  const result = await repository.profile(target); assert.equal(result.achievements[0].unlockedAt,'now'); assert.equal(result.publicWorkoutCount,3);
  for (const field of ['weight','email','dateOfBirth','totalVolume','sessions']) assert.equal(field in result,false);
});
