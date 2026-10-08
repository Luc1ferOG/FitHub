import type { Workout } from '@/domain/entities/workout';
import type { WorkoutInput, WorkoutPage } from '../types/workout';

export interface WorkoutRepository {
  findById(id: string, signal?: AbortSignal): Promise<Workout | null>;
  listByOwner(ownerId: string, offset: number, signal?: AbortSignal): Promise<WorkoutPage>;
  save(input: WorkoutInput, id?: string, updatedAt?: string): Promise<string>;
  delete(id: string, updatedAt: string): Promise<void>;
}
