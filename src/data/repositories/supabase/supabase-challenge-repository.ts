import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import type { ChallengeRepository } from '@/features/challenges/repositories/challenge-repository';
import type { ChallengeAction, ChallengeInput, FitnessChallenge, RealtimeState } from '@/features/challenges/types/fitness-challenge';
import { challengeDetailsSchema, challengeRowSchema } from '@/features/challenges/validation/challenge-schema';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export function mapChallenge(row: ReturnType<typeof challengeRowSchema.parse>): FitnessChallenge {
  return { id:row.id,creatorId:row.creator_id,title:row.title,description:row.description,metric:row.metric_type,target:row.target_value,startDate:row.start_date,endDate:row.end_date,visibility:row.visibility,status:row.status,exerciseId:row.exercise_id };
}
function checkError(error: { code?: string; message: string } | null): void {
  if (!error) return;
  const code = error.code === '42501' ? 'AUTHORIZATION' : ['22023','23514','23502','22P02','22007','22008','23503'].includes(error.code ?? '') ? 'VALIDATION' : 'NETWORK';
  throw new AppError(code === 'AUTHORIZATION' ? 'This challenge or action is not available to your account.' : code === 'VALIDATION' ? 'Check challenge rules, dates and invitations before trying again.' : 'Could not connect to FitHub. Try again.',code,{ cause:error });
}
export class SupabaseChallengeRepository implements ChallengeRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async list(kind: 'discover' | 'invites', offset: number, signal?: AbortSignal) {
    let query = this.client.rpc('list_fitness_challenges',{ p_kind:kind,p_offset:offset });
    if (signal) query = query.abortSignal(signal);
    const { data,error } = await query; checkError(error);
    const rows = challengeRowSchema.array().parse(data);
    return { items:rows.slice(0,20).map(mapChallenge),nextOffset:rows.length > 20 && offset < 10000 ? offset+20 : null };
  }
  async detail(id: string, offset: number, signal?: AbortSignal) {
    let query = this.client.rpc('get_fitness_challenge',{ p_challenge:id,p_offset:offset }); if (signal) query = query.abortSignal(signal);
    const { data,error } = await query; checkError(error); if (!data) return null;
    const row = challengeDetailsSchema.parse(data);
    return { challenge:mapChallenge(row.challenge),creator:{ id:row.creator.id,displayName:row.creator.display_name,username:row.creator.username },
      exerciseName:row.exercise_name,participantCount:row.participant_count,invited:row.invited,
      membership:row.membership ? { userId:row.membership.user_id,currentValue:row.membership.current_value,completed:row.membership.completed,rank:row.membership.rank,leftAt:row.membership.left_at } : null,
      leaderboard:row.leaderboard.slice(0,20).map((p) => ({ userId:p.user_id,displayName:p.display_name,username:p.username,avatarUrl:p.avatar_url,value:p.current_value,rank:p.rank,completed:p.completed })),
      nextOffset:row.leaderboard.length > 20 && offset < 10000 ? offset+20 : null };
  }
  async create(input: ChallengeInput) {
    const { data,error } = await this.client.rpc('create_fitness_challenge',{ p_input:{ ...input } }); checkError(error);
    if (!data) throw new AppError('Challenge creation did not return an ID.','UNKNOWN'); return data;
  }
  async manage(id: string, action: ChallengeAction, target: string | null) {
    const { error } = await this.client.rpc('manage_challenge_membership',{ p_challenge:id,p_action:action,p_user:target }); checkError(error);
  }
  subscribe(id: string, changed: () => void, status: (state: RealtimeState) => void) {
    let active = true;
    const channel = this.client.channel(`challenge:${id}`)
      .on('postgres_changes',{ event:'UPDATE',schema:'public',table:'challenges',filter:`id=eq.${id}` },() => { if (active) changed(); })
      .subscribe((state) => { if (active) { status(state === 'SUBSCRIBED' ? 'connected' : state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED' ? 'disconnected' : 'connecting'); if (state === 'SUBSCRIBED') changed(); } });
    return () => { active = false; void this.client.removeChannel(channel).catch(() => undefined); };
  }
}
