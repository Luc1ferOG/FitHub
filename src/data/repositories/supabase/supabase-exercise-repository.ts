import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/domain/errors/app-error';
import type { ExerciseRepository } from '@/features/exercises/repositories/exercise-repository';
import type { Exercise, ExerciseFilterOptions, ExerciseFilters, ExerciseSummary } from '@/features/exercises/types/exercise';
import { supabase } from '@/lib/supabase';
import type { Database, ExerciseRow } from '@/types/database';

export const EXERCISE_SUMMARY_COLUMNS = 'id,name,primary_muscle,equipment,difficulty,thumbnail_url';

function parseFilterOptions(data: unknown): ExerciseFilterOptions {
  if (typeof data !== 'object' || data === null || !('muscles' in data) || !('equipment' in data)) {
    throw new AppError('Invalid exercise filter response.', 'VALIDATION');
  }
  const { muscles, equipment } = data;
  if (!Array.isArray(muscles) || !Array.isArray(equipment)
    || !muscles.every((item: unknown): item is string => typeof item === 'string')
    || !equipment.every((item: unknown): item is string => typeof item === 'string')) {
    throw new AppError('Invalid exercise filter response.', 'VALIDATION');
  }
  return { muscles, equipment };
}

export function escapeExerciseSearch(search: string): string {
  // ILIKE interprets these as pattern syntax, even though the request is parameterized.
  return search.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function mapSummary(row: Pick<ExerciseRow, 'id' | 'name' | 'primary_muscle' | 'equipment' | 'difficulty' | 'thumbnail_url'>): ExerciseSummary {
  return {
    id: row.id, name: row.name, primaryMuscle: row.primary_muscle,
    equipment: row.equipment, difficulty: row.difficulty, thumbnailUrl: row.thumbnail_url,
  };
}

function mapExercise(row: ExerciseRow): Exercise {
  return {
    ...mapSummary(row), description: row.description, secondaryMuscles: row.secondary_muscles,
    instructions: row.instructions, formTips: row.form_tips, commonMistakes: row.common_mistakes,
    videoUrl: row.video_url,
  };
}

export class SupabaseExerciseRepository implements ExerciseRepository {
  constructor(private readonly client: SupabaseClient<Database> = supabase) {}

  async list(filters: ExerciseFilters, offset: number, limit: number, signal?: AbortSignal) {
    let query = this.client.from('exercises').select(EXERCISE_SUMMARY_COLUMNS)
      .order('name', { ascending: true }).order('id', { ascending: true });
    if (filters.search) query = query.ilike('name', `%${escapeExerciseSearch(filters.search)}%`);
    if (filters.muscle) query = query.eq('primary_muscle', filters.muscle);
    if (filters.equipment) query = query.eq('equipment', filters.equipment);
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
    // Fetch one lookahead row, never the entire catalogue or a costly exact count.
    query = query.range(offset, offset + limit);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new AppError('Could not load exercises.', 'NETWORK', { cause: error });
    const rows = data ?? [];
    return {
      items: rows.slice(0, limit).map(mapSummary),
      nextOffset: rows.length > limit ? offset + limit : null,
    };
  }

  async findById(id: string, signal?: AbortSignal) {
    let query = this.client.from('exercises').select('*').eq('id', id);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) throw new AppError('Could not load the exercise guide.', 'NETWORK', { cause: error });
    return data ? mapExercise(data) : null;
  }

  async getFilterOptions(signal?: AbortSignal) {
    let query = this.client.rpc('get_exercise_filter_options');
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new AppError('Could not load exercise filters.', 'NETWORK', { cause: error });
    return parseFilterOptions(data);
  }
}
