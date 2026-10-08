import { AppError } from '@/domain/errors/app-error';
import { requireUuid } from '@/validation/uuid';

import type { WorkoutRepository } from '../repositories/workout-repository';
import type { WorkoutInput } from '../types/workout';
import { workoutSchema } from '../validation/workout-schema';

export class WorkoutService {
  constructor(private readonly repository: WorkoutRepository) {}

  async requireWorkout(id: string, signal?: AbortSignal) {
    requireUuid(id);
    const workout = await this.repository.findById(id, signal);

    if (!workout) {
      throw new AppError('Workout not found.', 'NOT_FOUND', { context: { id } });
    }

    return workout;
  }

  list(ownerId: string, offset: number, signal?: AbortSignal) {
    return this.repository.listByOwner(ownerId, offset, signal);
  }

  async create(input: WorkoutInput) {
    const id = await this.repository.save(workoutSchema.parse(input));
    return this.requireWorkout(id);
  }

  async edit(ownerId: string, id: string, updatedAt: string, input: WorkoutInput) {
    const current = await this.requireWorkout(id);
    if (current.ownerId !== ownerId) throw new AppError('You cannot edit this workout.', 'AUTHORIZATION');
    await this.repository.save(workoutSchema.parse(input), id, updatedAt);
    return this.requireWorkout(id);
  }

  async delete(ownerId: string, id: string, updatedAt: string) {
    const current = await this.requireWorkout(id);
    if (current.ownerId !== ownerId) throw new AppError('You cannot delete this workout.', 'AUTHORIZATION');
    await this.repository.delete(id, updatedAt);
  }

  async duplicate(id: string) {
    const source = await this.requireWorkout(id);
    return this.create({
      name: `${source.name.slice(0, 113)} (copy)`, description: source.description,
      isPublic: false, estimatedDuration: source.estimatedDuration,
      exercises: source.exercises.map(({ exerciseId, sets, reps, weight, restSeconds, notes }) => ({ exerciseId, sets, reps, weight, restSeconds, notes })),
    });
  }
}
