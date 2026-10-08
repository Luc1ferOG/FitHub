export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: number;
  reps: number;
  weight: number | null;
  restSeconds: number;
  notes: string;
};

export type WorkoutSummary = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  estimatedDuration: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Workout = WorkoutSummary & { exercises: readonly WorkoutExercise[] };
