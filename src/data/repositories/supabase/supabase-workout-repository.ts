import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/domain/errors/app-error';
import type { Workout, WorkoutSummary } from '@/domain/entities/workout';
import { supabase } from '@/lib/supabase';
import type { Database, WorkoutRow } from '@/types/database';
import type { WorkoutRepository } from '@/features/workouts/repositories/workout-repository';
import type { WorkoutInput, WorkoutPage } from '@/features/workouts/types/workout';

export const WORKOUT_PAGE_SIZE = 20;
export function mapWorkoutSummary(row: WorkoutRow): WorkoutSummary {
  return { id: row.id, ownerId: row.owner_id, name: row.name, description: row.description,
    isPublic: row.is_public, estimatedDuration: row.estimated_duration, createdAt: row.created_at, updatedAt: row.updated_at };
}
function fail(error: { code?: string; message: string }): never {
  const code = error.code === '40001' ? 'CONFLICT' : error.code === '42501' ? 'AUTHORIZATION' : ['22023', '22P02', '22003', '23514', '23503'].includes(error.code ?? '') ? 'VALIDATION' : 'NETWORK';
  throw new AppError(code === 'CONFLICT' ? 'This workout changed on another device. Reload it before editing again.' : code === 'VALIDATION' ? 'Check the workout details and exercise values before saving.' : code === 'AUTHORIZATION' ? 'You do not have permission to change this workout.' : 'Could not save or load the workout. Check your connection and try again.', code, { cause: error });
}
export class SupabaseWorkoutRepository implements WorkoutRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}

  async listByOwner(ownerId: string, offset: number, signal?: AbortSignal): Promise<WorkoutPage> {
    let query = this.client.from('workouts').select('*').eq('owner_id', ownerId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + WORKOUT_PAGE_SIZE);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) fail(error);
    return { items: (data ?? []).slice(0, WORKOUT_PAGE_SIZE).map(mapWorkoutSummary), nextOffset: (data?.length ?? 0) > WORKOUT_PAGE_SIZE ? offset + WORKOUT_PAGE_SIZE : null };
  }

  async findById(id: string, signal?: AbortSignal): Promise<Workout | null> {
    let query = this.client.from('workouts').select('*, workout_exercises(*, exercises(name))').eq('id', id);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    return { ...mapWorkoutSummary(data), exercises: [...data.workout_exercises].sort((a, b) => a.order_index - b.order_index).map((row) => ({
      id: row.id, exerciseId: row.exercise_id, exerciseName: row.exercises?.name ?? 'Exercise', order: row.order_index,
      sets: row.target_sets ?? 3, reps: row.target_reps ?? 10, weight: row.target_weight, restSeconds: row.rest_seconds ?? 60, notes: row.notes,
    })) };
  }

  async save(input: WorkoutInput, id?: string, updatedAt?: string): Promise<string> {
    const { data, error } = await this.client.rpc('save_workout', {
      p_workout_id: id ?? null, p_expected_updated_at: updatedAt ?? null,
      p_name: input.name, p_description: input.description, p_is_public: input.isPublic,
      p_estimated_duration: input.estimatedDuration,
      p_exercises: input.exercises.map((item) => ({ exercise_id: item.exerciseId, target_sets: item.sets, target_reps: item.reps,
        target_weight: item.weight, rest_seconds: item.restSeconds, notes: item.notes })),
    });
    if (error) fail(error);
    if (!data) throw new AppError('The server did not return a workout ID.', 'UNKNOWN');
    return data;
  }

  async delete(id: string, updatedAt: string): Promise<void> {
    const { error } = await this.client.rpc('delete_workout', { p_workout_id: id, p_expected_updated_at: updatedAt });
    if (error) fail(error);
  }
}
