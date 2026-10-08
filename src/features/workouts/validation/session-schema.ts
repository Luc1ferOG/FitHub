import { z } from 'zod';
import { setResult } from '../services/session-logic';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const timestamp = z.number().int().min(0).max(8640000000000000);
const count = z.number().int().nonnegative();
export const sessionReceiptSchema = z.object({ durationSeconds: count, totalSets: count, totalReps: count, volume: z.number().finite().nonnegative(), exercisesCompleted: count,
  personalRecords: z.array(z.object({ exerciseName: z.string(), setNumber: count, volume: z.number().finite().nonnegative() })),
  achievements: z.array(z.object({ code: z.string(), title: z.string() })),
  challengeChanges: z.array(z.object({ id: uuid, title: z.string(), value: z.number().finite().nonnegative() })),
});
export const exerciseHistorySchema = z.array(z.object({ exerciseId: uuid, bestVolume: z.number().finite().nonnegative(),
  previousSets: z.array(z.object({ weight: z.number().finite().nonnegative(), reps: count })) }));
const sessionSchema = z.object({ id: uuid, userId: uuid, workoutId: uuid.nullable(), name: z.string().min(1).max(120),
  startedAt: timestamp, completedAt: timestamp.nullable(), submittedAt: timestamp.nullable(), notes: z.string().max(4000),
  autoRest: z.boolean(), notifyRest: z.boolean(), restEndsAt: timestamp.nullable(), syncStatus: z.enum(['pending', 'failed', 'synced']), syncError: z.string().nullable(), receipt: sessionReceiptSchema.nullable(),
  exercises: z.array(z.object({ id: uuid, exerciseId: uuid, name: z.string().min(1).max(120), targetSets: z.number().int().min(1).max(100), targetReps: z.number().int().min(1).max(10000), restSeconds: z.number().int().min(0).max(86400), notes: z.string().max(1000), skipped: z.boolean(),
    bestVolume: z.number().finite().nonnegative().nullable(), previousSets: z.array(z.object({ weight: z.number().finite().nonnegative(), reps: count })),
    sets: z.array(z.object({ id: uuid, weight: z.string().max(16), reps: z.string().max(16), completedAt: timestamp.nullable() })).max(100) })).min(1).max(100),
});
export const sessionStorageSchema = z.object({ version: z.literal(1), sessions: z.array(sessionSchema) }).superRefine((value, context) => {
  const ids = new Set<string>();
  const activeOwners = new Set<string>();
  for (const [index, session] of value.sessions.entries()) {
    let valid = !ids.has(session.id) && (session.completedAt === null || session.completedAt >= session.startedAt)
      && (session.submittedAt === null || session.completedAt !== null)
      && (session.syncStatus !== 'synced' || (session.submittedAt !== null && session.receipt !== null));
    ids.add(session.id);
    if (session.submittedAt === null) { if (activeOwners.has(session.userId)) valid = false; activeOwners.add(session.userId); }
    const children = new Set<string>();
    for (const exercise of session.exercises) {
      if (children.has(exercise.id)) valid = false;
      children.add(exercise.id);
      for (const set of exercise.sets) {
        if (children.has(set.id)) valid = false;
        children.add(set.id);
        if (set.completedAt !== null) {
          try { setResult(set); } catch { valid = false; }
          if (set.completedAt < session.startedAt || (session.completedAt !== null && set.completedAt > session.completedAt)) valid = false;
        }
      }
    }
    if (!valid) context.addIssue({ code: 'custom', message: 'Stored workout invariants failed; data has been preserved.', path: ['sessions', index] });
  }
});
