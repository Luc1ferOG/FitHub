import { AppError } from '@/domain/errors/app-error';

import type { ExerciseRepository } from '../repositories/exercise-repository';
import type { ExerciseFilters } from '../types/exercise';

export const EXERCISE_PAGE_SIZE = 20;
export const DEFAULT_EXERCISE_FILTERS: ExerciseFilters = {
  search: '', muscle: null, equipment: null, difficulty: null,
};

export function normalizeExerciseFilters(filters: ExerciseFilters): ExerciseFilters {
  return {
    search: filters.search.trim().toLowerCase().slice(0, 100),
    muscle: filters.muscle?.trim() || null,
    equipment: filters.equipment?.trim() || null,
    difficulty: filters.difficulty,
  };
}

export class ExerciseService {
  constructor(private readonly repository: ExerciseRepository) {}

  list(filters: ExerciseFilters, offset: number, signal?: AbortSignal) {
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new AppError('Invalid exercise page.', 'VALIDATION');
    }
    return this.repository.list(normalizeExerciseFilters(filters), offset, EXERCISE_PAGE_SIZE, signal);
  }

  async requireExercise(id: string, signal?: AbortSignal) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new AppError('Exercise not found.', 'NOT_FOUND');
    }
    const exercise = await this.repository.findById(id, signal);
    if (!exercise) throw new AppError('Exercise not found.', 'NOT_FOUND');
    return exercise;
  }

  getFilterOptions(signal?: AbortSignal) {
    return this.repository.getFilterOptions(signal);
  }
}
