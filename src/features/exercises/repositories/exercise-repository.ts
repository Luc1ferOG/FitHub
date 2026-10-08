import type { Exercise, ExerciseFilterOptions, ExerciseFilters, ExercisePage } from '../types/exercise';

export interface ExerciseRepository {
  list(filters: ExerciseFilters, offset: number, limit: number, signal?: AbortSignal): Promise<ExercisePage>;
  findById(id: string, signal?: AbortSignal): Promise<Exercise | null>;
  getFilterOptions(signal?: AbortSignal): Promise<ExerciseFilterOptions>;
}
