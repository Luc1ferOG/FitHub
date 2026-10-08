import { z } from 'zod';

export const workoutExerciseSchema = z.object({
  // PostgreSQL UUIDs (including seeded IDs) need not carry an RFC version/variant.
  exerciseId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Choose a valid exercise'),
  sets: z.number().int().min(1, 'At least one set is required').max(100),
  reps: z.number().int().min(1, 'Reps must be at least 1').max(10000),
  weight: z.number().min(0, 'Weight cannot be negative').max(999999.99).nullable(),
  restSeconds: z.number().int().min(0, 'Rest cannot be negative').max(86400),
  notes: z.string().max(1000),
});
export const workoutSchema = z.object({
  name: z.string().trim().min(1, 'Workout name is required').max(120),
  description: z.string().trim().max(2000),
  isPublic: z.boolean(),
  estimatedDuration: z.number().int().min(1).max(86400).nullable(),
  exercises: z.array(workoutExerciseSchema).min(1, 'Add at least one exercise').max(100),
});
