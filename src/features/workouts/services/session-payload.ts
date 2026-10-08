import { AppError } from '@/domain/errors/app-error';
import type { ActiveWorkoutSession } from '../types/workout-session';
import { setResult } from './session-logic';

export function sessionPayload(session: ActiveWorkoutSession) {
  if (session.completedAt === null || session.submittedAt === null) throw new AppError('Only submitted workouts can synchronize.', 'VALIDATION');
  return { workoutId: session.workoutId, name: session.name, notes: session.notes,
    startedAt: new Date(session.startedAt).toISOString(), completedAt: new Date(session.completedAt).toISOString(),
    exercises: session.exercises.map((exercise) => ({ id: exercise.id, exerciseId: exercise.exerciseId, name: exercise.name,
      targetSets: exercise.targetSets, targetReps: exercise.targetReps, restSeconds: exercise.restSeconds, notes: exercise.notes, skipped: exercise.skipped,
      sets: exercise.sets.map((set) => {
        // Incomplete input drafts are retained locally; only valid completed results count.
        const result = set.completedAt === null ? { weight: 0, reps: 0 } : setResult(set);
        return { id: set.id, ...result, completed: set.completedAt !== null,
          completedAt: set.completedAt === null ? null : new Date(set.completedAt).toISOString() };
      }) })) };
}
