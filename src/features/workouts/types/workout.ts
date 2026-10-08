import type { WorkoutSummary } from '@/domain/entities/workout';

export type WorkoutExerciseInput = {
  exerciseId: string;
  sets: number;
  reps: number;
  weight: number | null;
  restSeconds: number;
  notes: string;
};
export type WorkoutInput = {
  name: string;
  description: string;
  isPublic: boolean;
  estimatedDuration: number | null;
  exercises: WorkoutExerciseInput[];
};
export type WorkoutPage = { items: WorkoutSummary[]; nextOffset: number | null };
export type WorkoutCommand =
  | { type: 'create'; input: WorkoutInput }
  | { type: 'edit'; id: string; updatedAt: string; input: WorkoutInput }
  | { type: 'delete'; id: string; updatedAt: string }
  | { type: 'duplicate'; id: string };
