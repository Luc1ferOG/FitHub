import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule,SyntheticModule } from 'node:vm';
const modules = new Map();
function source(path) { if (!modules.has(path)) modules.set(path,new SourceTextModule(stripTypeScriptTypes(readFileSync(path,'utf8'),{ mode:'transform' }),{ identifier:path })); return modules.get(path); }
const schemas = new SyntheticModule(['leaderboardResponse'],function() { this.setExport('leaderboardResponse',{ parse:(value)=>value }); });
const supabase = new SyntheticModule(['supabase'],function() { this.setExport('supabase',{}); });
async function load(path) {
  const module = source(path); await module.link((specifier,parent)=> {
    if (specifier === '@/lib/supabase') return supabase;
    if (specifier.endsWith('validation/leaderboard-response')) return schemas;
    return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts`:`${posix.normalize(posix.join(posix.dirname(parent.identifier),specifier))}.ts`);
  }); await module.evaluate(); return module.namespace;
}
const { rankScores } = await load('src/features/challenges/services/challenge-rules.ts');
const { leaderboardLabel,completionPercent,firstLeaderboardPage,leaderboardKeys } = await load('src/features/leaderboards/services/leaderboard-presentation.ts');
const { LeaderboardService } = await load('src/features/leaderboards/services/leaderboard-service.ts');
const { SupabaseLeaderboardRepository } = await load('src/data/repositories/supabase/supabase-leaderboard-repository.ts');
const { RealtimeRefresh } = await load('src/features/leaderboards/services/realtime-refresh.ts');
const owner = '93000000-0000-0000-0000-000000000001'; const other = '93000000-0000-0000-0000-000000000002'; const challenge = '73000000-0000-0000-0000-000000000001';
const entry = { userId:other,displayName:'Mark',username:'mark',avatarUrl:null,value:13,rank:2 };
const row = { user_id:other,display_name:'Mark',username:'mark',avatar_url:null,value:13,rank:2 };
const response = { version:'5',title:'12 workouts',metric:'workout_count',target:20,participant_count:21,sharing:null,me:null,podium:[row],entries:Array(21).fill(row) };
function transport(data,error = null) {
  const calls = []; const query = { then:(resolve,reject)=>Promise.resolve({ data,error }).then(resolve,reject),abortSignal:(signal)=> { calls.push(['signal',signal]); return query; } };
  return { repository:new SupabaseLeaderboardRepository({ rpc:(...args)=> { calls.push(args); return query; } }),calls };
}
test('ties use dense ranks and UUID ordering independent of input order',()=> {
  const scores = [{ userId:other,value:15 },{ userId:owner,value:15 },{ userId:challenge,value:11 }];
  assert.deepEqual(rankScores(scores).map((p)=>[p.userId,p.rank]),[[owner,1],[other,1],[challenge,2]]);
  assert.deepEqual(rankScores([...scores].reverse()),rankScores(scores)); assert.equal(scores[0].userId,other);
});
test('ties crossing a page boundary use score + UUID, not score alone',()=> {
  const scores = Array.from({ length:43 },(_,i)=>({ userId:`93000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`,value:i < 25 ? 15:11 }));
  const ranked = rankScores(scores); const first = ranked.slice(0,20); const cursor = first[19];
  const rest = ranked.filter((p)=>p.value < cursor.value || (p.value === cursor.value && p.userId > cursor.userId));
  assert.equal(new Set([...first,...rest].map((p)=>p.userId)).size,43); assert.equal(rest[0].rank,1); assert.equal(rest[5].rank,2);
});
test('challenge labels describe out-of-target progress, percentage and current user',()=> {
  assert.equal(leaderboardLabel(entry,'workout_count',20,false),'Rank 2, Mark, 13 out of 20 workouts completed, 65 percent complete.');
  assert.match(leaderboardLabel(entry,'workout_count',20,true),/Mark, you/);
  assert.match(leaderboardLabel({ ...entry,value:780 },'duration_seconds',1200,false),/13 out of 20 minutes/);
  assert.equal(completionPercent(30,20),100); assert.equal(completionPercent(1,null),null);
});
test('friends labels clearly distinguish the rolling UTC window without an invented target',()=> {
  assert.equal(leaderboardLabel(entry,'workout_count',null,false),'Rank 2, Mark, 13 workouts completed in the last 30 UTC days.');
});
test('refresh keeps one page but always resets even an evicted first cursor to null',()=> {
  const data = { pages:['page 4','page 5'],pageParams:[{ value:10,version:'old' },{ value:5,version:'old' }] };
  assert.deepEqual(firstLeaderboardPage(data),{ pages:['page 4'],pageParams:[null] }); assert.equal(data.pages.length,2);
  assert.deepEqual(firstLeaderboardPage({ pages:[],pageParams:[] }),{ pages:[],pageParams:[] }); assert.equal(firstLeaderboardPage(undefined),undefined);
});
test('repository pages have 20 entries, authoritative podium and versioned cursors',async()=> {
  const { repository,calls } = transport(response); const signal = new AbortController().signal;
  const page = await repository.page({ kind:'challenge',challengeId:challenge },null,signal);
  assert.equal(page.entries.length,20); assert.equal(page.podium.length,1); assert.deepEqual(page.nextCursor,{ value:13,userId:other,version:'5' });
  assert.deepEqual(calls[0],['get_challenge_leaderboard',{ p_challenge:challenge,p_value:null,p_user:null,p_version:null }]); assert.equal(calls[1][1],signal);
  const second = transport({ ...response,entries:[] }); assert.equal((await second.repository.page({ kind:'friends' },page.nextCursor)).nextCursor,null);
  assert.deepEqual(second.calls[0],['get_friends_leaderboard',{ p_value:13,p_user:other,p_version:'5' }]);
});
test('stale versions become conflicts, never merged pages or leaked backend errors',async()=> {
  const { repository } = transport(null,{ code:'40001',message:'private detail' });
  await assert.rejects(repository.page({ kind:'friends' },null),(error)=>error.code === 'CONFLICT' && !error.message.includes('private'));
});
test('service rejects invalid scopes/cursors and isolates account keys',()=> {
  const service = new LeaderboardService({ page:()=>response });
  assert.throws(()=>service.page({ kind:'challenge',challengeId:'bad' },null));
  for (const value of [-1,Infinity,NaN,1.5]) assert.throws(()=>service.page({ kind:'friends' },{ value,userId:other,version:'5' }));
  assert.throws(()=>service.page({ kind:'friends' },{ value:1,userId:other,version:'' }));
  assert.notDeepEqual(leaderboardKeys.board(owner,'friends',''),leaderboardKeys.board(other,'friends',''));
});
test('friends realtime watches only owner signal and cleanup suppresses late callbacks',()=> {
  let event; let status; let removed = 0; let changes = 0; const states = [];
  const channel = { on:(kind,filter,handler)=> { assert.deepEqual(filter,{ event:'UPDATE',schema:'public',table:'leaderboard_revisions',filter:`user_id=eq.${owner}` }); event = handler; return channel; },subscribe:(handler)=> { status = handler; return channel; } };
  const repository = new SupabaseLeaderboardRepository({ channel:()=>channel,removeChannel:()=> { removed++; return Promise.resolve(); } });
  const cleanup = repository.subscribe({ kind:'friends' },owner,()=>changes++,(state)=>states.push(state)); status('SUBSCRIBED'); event(); status('TIMED_OUT'); cleanup(); event(); status('SUBSCRIBED');
  assert.equal(changes,2); assert.equal(removed,1); assert.deepEqual(states,['connected','disconnected']);
});
test('event bursts coalesce, in-flight changes trail once and disposal stops work',async()=> {
  let calls = 0; let finish;
  const coordinator = new RealtimeRefresh(()=> { calls++; return calls === 1 ? new Promise((resolve)=> { finish = resolve; }):Promise.resolve(); },0);
  coordinator.schedule(); coordinator.schedule(); coordinator.schedule(); await new Promise((resolve)=>setTimeout(resolve,10)); assert.equal(calls,1);
  coordinator.schedule(); coordinator.schedule(); await new Promise((resolve)=>setTimeout(resolve,10)); assert.equal(calls,1);
  finish(); await new Promise((resolve)=>setTimeout(resolve,10)); assert.equal(calls,2);
  coordinator.schedule(); coordinator.dispose(); await new Promise((resolve)=>setTimeout(resolve,10)); assert.equal(calls,2);
});
