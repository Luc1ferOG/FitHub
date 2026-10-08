import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { LeaderboardRepository } from '@/features/leaderboards/repositories/leaderboard-repository';
import type { LeaderboardCursor,LeaderboardScope,RankedUser,RealtimeState } from '@/features/leaderboards/types/leaderboard';
import { leaderboardResponse } from '@/features/leaderboards/validation/leaderboard-response';
type Response = ReturnType<typeof leaderboardResponse.parse>;
export function mapRankedUser(row:Response['entries'][number]):RankedUser {
  return { userId:row.user_id,displayName:row.display_name,username:row.username,avatarUrl:row.avatar_url,value:row.value,rank:row.rank };
}
function check(error:{ code?:string; message:string }|null):void {
  if (!error) return;
  const code = error.code === '40001' ? 'CONFLICT' : error.code === '42501' ? 'AUTHORIZATION' : error.code === '22023' ? 'VALIDATION' : 'NETWORK';
  throw new AppError(code === 'CONFLICT' ? 'The ranking changed. Refreshing the leaderboard.' : code === 'AUTHORIZATION' ? 'This leaderboard is not available to your account.' : 'Could not load the leaderboard. Try again.',code,{ cause:error });
}
export class SupabaseLeaderboardRepository implements LeaderboardRepository {
  constructor(private readonly client:SupabaseClient<Database> = supabase) {}
  async page(scope:LeaderboardScope,cursor:LeaderboardCursor|null,signal?:AbortSignal) {
    const args = { p_value:cursor?.value ?? null,p_user:cursor?.userId ?? null,p_version:cursor?.version ?? null };
    let query = scope.kind === 'friends' ? this.client.rpc('get_friends_leaderboard',args) : this.client.rpc('get_challenge_leaderboard',{ ...args,p_challenge:scope.challengeId });
    if (signal) query = query.abortSignal(signal);
    const { data,error } = await query; check(error); const row = leaderboardResponse.parse(data);
    const entries = row.entries.slice(0,20).map(mapRankedUser); const last = entries[entries.length-1];
    return { title:row.title,metric:row.metric,target:row.target,version:row.version,participantCount:row.participant_count,sharing:row.sharing,
      me:row.me ? mapRankedUser(row.me):null,podium:row.podium.map(mapRankedUser),entries,
      nextCursor:row.entries.length > 20 && last ? { value:last.value,userId:last.userId,version:row.version }:null };
  }
  async setSharing(owner:string,enabled:boolean) {
    const { data,error } = await this.client.from('profiles').update({ share_friends_leaderboard:enabled }).eq('id',owner).select('id').maybeSingle(); check(error);
    if (!data) throw new AppError('Your account changed. Sign in before updating sharing.','AUTHORIZATION');
  }
  subscribe(scope:LeaderboardScope,owner:string,changed:()=>void,status:(state:RealtimeState)=>void) {
    let active = true;
    const table = scope.kind === 'friends' ? 'leaderboard_revisions':'challenges';
    const filter = scope.kind === 'friends' ? `user_id=eq.${owner}`:`id=eq.${scope.challengeId}`;
    const channel = this.client.channel(`leaderboard:${scope.kind}:${scope.kind === 'friends' ? owner:scope.challengeId}`)
      .on('postgres_changes',{ event:'UPDATE',schema:'public',table,filter },()=> { if (active) changed(); })
      .subscribe((state)=> { if (!active) return; status(state === 'SUBSCRIBED' ? 'connected' : ['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(state) ? 'disconnected':'connecting'); if (state === 'SUBSCRIBED') changed(); });
    return ()=> { active = false; void this.client.removeChannel(channel).catch(()=>undefined); };
  }
}
