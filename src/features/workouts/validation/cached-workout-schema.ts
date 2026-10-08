import { z } from 'zod';
import { databaseUuidSchema as uuid } from '@/validation/database-uuid-schema';

const summary = z.object({
  id: uuid, ownerId: uuid, name: z.string(), description: z.string(),
  isPublic: z.boolean(), estimatedDuration: z.number().nonnegative().nullable(),
  createdAt: z.string(), updatedAt: z.string(),
});
export const cachedWorkoutSchema = summary.extend({ exercises: z.array(z.object({
  id: uuid, exerciseId: uuid, exerciseName: z.string(), order: z.number().int().nonnegative(),
  sets: z.number().int().positive(), reps: z.number().int().nonnegative(), weight: z.number().nonnegative().nullable(),
  restSeconds: z.number().int().nonnegative(), notes: z.string(),
})) });
export const cachedWorkoutPageSchema = z.object({ items: z.array(summary), nextOffset: z.number().int().nonnegative().nullable() });
