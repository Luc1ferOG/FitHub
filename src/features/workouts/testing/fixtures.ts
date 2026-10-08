import type { Workout } from '@/domain/entities/workout';
import type { WorkoutInput } from '../types/workout';

export const input: WorkoutInput = { name: 'Strength A', description: 'Full body', isPublic: false, estimatedDuration: 1800,
  exercises: [{ exerciseId: '10000000-0000-0000-0000-000000000001', sets: 3, reps: 10, weight: 20, restSeconds: 60, notes: 'Brace' }] };
export const workout: Workout = { id: '30000000-0000-0000-0000-000000000001', ownerId: 'owner',
  ...input, createdAt: '2026-10-06T12:00:00Z', updatedAt: '2026-10-06T12:00:00Z',
  exercises: input.exercises.map((item, order) => ({ ...item, id: 'entry-1', order, exerciseName: 'Back Squat' })) };
