import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { SourceTextModule,SyntheticModule } from 'node:vm';
const modules = new Map();
function source(path) { if (!modules.has(path)) modules.set(path,new SourceTextModule(stripTypeScriptTypes(readFileSync(path,'utf8'),{ mode:'transform' }),{ identifier:path })); return modules.get(path); }
const schemas = new SyntheticModule(['challengeInputSchema','challengeRowSchema','challengeDetailsSchema'],function() {
  const schema = { parse:(value) => value,array:() => ({ parse:(value) => value }) };
  for (const key of ['challengeInputSchema','challengeRowSchema','challengeDetailsSchema']) this.setExport(key,schema);
});
const supabase = new SyntheticModule(['supabase'],function() { this.setExport('supabase',{}); });
async function load(path) {
  const mod = source(path);
  await mod.link((specifier,parent) => {
    if (specifier.endsWith('validation/challenge-schema')) return schemas;
    if (specifier === '@/lib/supabase') return supabase;
    if (specifier === './challenge-rules') return source('src/features/challenges/services/challenge-rules.ts');
    if (specifier.startsWith('@/')) return source(`src/${specifier.slice(2)}.ts`);
    throw new Error(`Unexpected ${specifier} in ${parent.identifier}`);
  }); await mod.evaluate(); return mod.namespace;
}
const rulesModule = source('src/features/challenges/services/challenge-rules.ts'); await rulesModule.link(() => {}); await rulesModule.evaluate();
const { qualifiesForChallenge,calculateChallengeProgress,rankScores,progressPercent,targetToStorage,challengeKeys } = rulesModule.namespace;
const { ChallengeService } = await load('src/features/challenges/services/challenge-service.ts');
const { SupabaseChallengeRepository } = await load('src/data/repositories/supabase/supabase-challenge-repository.ts');
const pushModule = source('supabase/functions/_shared/push-delivery.ts'); await pushModule.link(() => {}); await pushModule.evaluate();
const { classifyPushResponse,classifyPushHttp } = pushModule.namespace;
const owner = '92000000-0000-0000-0000-000000000001'; const id = '72000000-0000-0000-0000-000000000001';
const challenge = { metric:'workout_count',exerciseId:null,startDate:'2026-10-01',endDate:'2026-10-31',joinedAt:'2026-10-05T12:00:00Z',leftAt:null,status:'active' };
const workout = { startedAt:'2026-10-07T10:00:00Z',completedAt:'2026-10-07T10:30:00Z',durationSeconds:1800,sets:[
  { exerciseId:'pushup',reps:20,weightKg:0,completed:true },{ exerciseId:'squat',reps:10,weightKg:50,completed:true },{ exerciseId:'pushup',reps:30,weightKg:0,completed:false },{ exerciseId:'pushup',reps:15,weightKg:0,completed:true },
] };
test('four metrics count only completed and relevant workout data',() => {
  assert.equal(calculateChallengeProgress(challenge,workout),1);
  assert.equal(calculateChallengeProgress({ ...challenge,metric:'volume_kg' },workout),500);
  assert.equal(calculateChallengeProgress({ ...challenge,metric:'repetitions',exerciseId:'pushup' },workout),35);
  assert.equal(calculateChallengeProgress({ ...challenge,metric:'duration_seconds' },workout),1800);
  assert.equal(calculateChallengeProgress({ ...challenge,metric:'repetitions',exerciseId:'missing' },workout),0);
});
test('UTC date bounds include last day and reject cross-midnight finishing outside window',() => {
  assert.equal(qualifiesForChallenge(challenge,{ ...workout,startedAt:'2026-10-31T22:00:00Z',completedAt:'2026-10-31T23:59:59Z' }),true);
  assert.equal(qualifiesForChallenge(challenge,{ ...workout,startedAt:'2026-10-31T23:59:00Z',completedAt:'2026-11-01T00:00:01Z' }),false);
  assert.equal(qualifiesForChallenge(challenge,{ ...workout,startedAt:'2026-11-01T01:00:00+02:00',completedAt:'2026-11-01T01:30:00+02:00' }),true);
});
test('pre-join, incomplete, left, cancelled and invalid timestamps do not qualify',() => {
  for (const value of [{ ...challenge,joinedAt:'2026-10-08T00:00:00Z' },{ ...challenge,leftAt:'now' },{ ...challenge,status:'cancelled' }]) assert.equal(calculateChallengeProgress(value,workout),0);
  for (const value of [{ ...workout,completedAt:null },{ ...workout,startedAt:'bad' },{ ...workout,completedAt:'2026-10-07T09:00:00Z' }]) assert.equal(qualifiesForChallenge(challenge,value),false);
  assert.equal(qualifiesForChallenge({ ...challenge,status:'completed' },workout),true);
});
test('dense ranking shares tie positions with deterministic order and preserves inputs',() => {
  const scores = [{ userId:'b',value:10 },{ userId:'a',value:10 },{ userId:'c',value:5 },{ userId:'d',value:0 }];
  assert.deepEqual(rankScores(scores).map((p) => [p.userId,p.rank]),[['a',1],['b',1],['c',2],['d',3]]); assert.equal(scores[0].userId,'b');
});
test('offline saves have a bounded seven-day UTC grace period',() => {
  assert.equal(qualifiesForChallenge(challenge,workout,new Date('2026-11-07T23:59:59Z')),true);
  assert.equal(qualifiesForChallenge(challenge,workout,new Date('2026-11-08T00:00:00Z')),false);
});
test('minutes convert to seconds and display progress remains bounded',() => { assert.equal(targetToStorage('duration_seconds',300),18000); assert.equal(targetToStorage('volume_kg',50000),50000); assert.equal(progressPercent(150,100),100); assert.equal(progressPercent(-1,100),0); assert.equal(progressPercent(1,0),0); });
test('creation converts minutes once and rejects past dates',async () => {
  const calls = []; const service = new ChallengeService({ create:async(input) => { calls.push(input); return id; } },() => new Date('2026-10-07T12:00:00Z'));
  const input = { title:'300 minutes',description:'',metric:'duration_seconds',target:300,startDate:'2026-10-07',endDate:'2026-10-31',visibility:'public',exerciseId:null };
  assert.equal(await service.create(input),id); assert.equal(calls[0].target,18000);
  assert.throws(() => service.create({ ...input,startDate:'2026-10-06' }),/today/);
});
test('join, leave, accept, decline and invite delegate without manual scoring',async () => {
  const calls = []; const service = new ChallengeService({ manage:async(...args) => calls.push(args) });
  for (const action of ['join','leave','accept','decline']) await service.manage(id,action);
  await service.manage(id,'invite',owner); assert.equal(calls.length,5); assert.deepEqual(calls[4],[id,'invite',owner]);
  assert.throws(() => service.manage(id,'invite'),/Choose a friend/); assert.throws(() => service.manage('bad','join'));
});
function transport(data,error = null) {
  const calls = []; const query = { then:(resolve,reject) => Promise.resolve({ data,error }).then(resolve,reject),abortSignal:(signal) => { calls.push(['abortSignal',signal]); return query; } };
  return { repository:new SupabaseChallengeRepository({ rpc:(...args) => { calls.push(args); return query; } }),calls };
}
const row = { id,creator_id:owner,title:'12 workouts',description:'',metric_type:'workout_count',target_value:12,start_date:'2026-10-01',end_date:'2026-10-31',visibility:'public',status:'active',exercise_id:null };
test('repository discovery/invitations use bounded auth-scoped RPC pages',async () => {
  for (const kind of ['discover','invites']) { const { repository,calls } = transport(Array(21).fill(row)); const signal = new AbortController().signal;
    const page = await repository.list(kind,20,signal); assert.equal(page.items.length,20); assert.equal(page.nextOffset,40); assert.deepEqual(calls[0],['list_fitness_challenges',{ p_kind:kind,p_offset:20 }]); assert.equal(calls[1][1],signal); }
});
test('detail maps member position and lookahead leaderboard',async () => {
  const { repository } = transport({ challenge:row,creator:{ id:owner,display_name:'Owner',username:'owner' },exercise_name:null,participant_count:21,invited:false,
    membership:{ user_id:owner,current_value:5,completed:false,rank:2,left_at:null },leaderboard:Array(21).fill({ user_id:owner,display_name:'Owner',username:'owner',avatar_url:null,current_value:5,rank:2,completed:false }) });
  const details = await repository.detail(id,0); assert.equal(details.membership.rank,2); assert.equal(details.leaderboard.length,20); assert.equal(details.nextOffset,20);
});
test('realtime watches authorized parent updates, reconnect refetches and cleanup suppresses callbacks',() => {
  let changed; let subscribed; let removed = 0; let changes = 0; const states = [];
  const channel = { on:(kind,filter,handler) => { assert.equal(filter.table,'challenges'); assert.equal(filter.event,'UPDATE'); assert.equal(filter.filter,`id=eq.${id}`); changed = handler; return channel; },subscribe:(handler) => { subscribed = handler; return channel; } };
  const repository = new SupabaseChallengeRepository({ channel:() => channel,removeChannel:() => { removed++; return Promise.resolve(); } });
  const cleanup = repository.subscribe(id,() => changes++, (state) => states.push(state)); subscribed('SUBSCRIBED'); changed(); subscribed('TIMED_OUT'); assert.equal(changes,2); assert.deepEqual(states,['connected','disconnected']); cleanup(); changed(); subscribed('SUBSCRIBED'); assert.equal(changes,2); assert.equal(removed,1);
});
test('push tickets require receipts; invalid tokens retire, transient failures retry',() => {
  assert.deepEqual(classifyPushResponse({ status:'ok',id:'ticket' },'pending'),{ outcome:'receipt',receipt:'ticket' });
  assert.equal(classifyPushResponse({ status:'ok' },'receipt').outcome,'done');
  assert.equal(classifyPushResponse({ status:'error',details:{ error:'DeviceNotRegistered' } },'receipt').outcome,'unregistered');
  assert.equal(classifyPushResponse({ status:'error',details:{ error:'InvalidCredentials' } },'pending').outcome,'failed');
  assert.equal(classifyPushResponse(undefined,'receipt').outcome,'retry'); assert.equal(classifyPushHttp(429).outcome,'retry'); assert.equal(classifyPushHttp(503).outcome,'retry'); assert.equal(classifyPushHttp(401).outcome,'failed');
});
test('query keys keep challenge details and invitation lists account isolated',() => { assert.notDeepEqual(challengeKeys.detail(owner,id),challengeKeys.detail(id,owner)); assert.notDeepEqual(challengeKeys.list(owner,'discover'),challengeKeys.list(owner,'invites')); });
