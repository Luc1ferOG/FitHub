import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/domain/errors/app-error';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { SessionRepository } from '@/features/workouts/repositories/session-repository';
import type { ActiveWorkoutSession, ExerciseHistory, SessionReceipt } from '@/features/workouts/types/workout-session';
import { sessionPayload } from '@/features/workouts/services/session-payload';
import { exerciseHistorySchema, sessionReceiptSchema } from '@/features/workouts/validation/session-schema';

function fail(error: { message: string; code?: string }): never {
  const code = error.code === '42501' ? 'AUTHORIZATION' : error.code === '40001' ? 'CONFLICT' : ['22023', '22P02', '22003', '23514', '23503', '22007', '22008'].includes(error.code ?? '') ? 'VALIDATION' : 'NETWORK';
  throw new AppError(code === 'NETWORK' ? 'Synchronization failed. Your workout is safe on this device; it will retry when connected.' : code === 'AUTHORIZATION' ? 'Sign in to the original account to synchronize this workout.' : code === 'CONFLICT' ? 'The session ID conflicts with saved history. Your local workout has been retained.' : 'The server could not accept this workout. Your local data is retained; check your device clock and retry.', code, { cause: error });
}
export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}
  async history(exerciseIds: readonly string[], signal?: AbortSignal): Promise<ExerciseHistory[]> {
    let query = this.client.rpc('get_workout_exercise_history', { p_exercise_ids: [...new Set(exerciseIds)].slice(0, 100) });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) fail(error);
    return exerciseHistorySchema.parse(data);
  }
  async sync(session: ActiveWorkoutSession, signal?: AbortSignal): Promise<SessionReceipt> {
    let query = this.client.rpc('sync_workout_session', {
      p_user_id: session.userId, p_session_id: session.id, p_payload: sessionPayload(session),
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) fail(error);
    return sessionReceiptSchema.parse(data);
  }
}
