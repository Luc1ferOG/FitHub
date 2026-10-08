import type { ActiveWorkoutSession, ExerciseHistory, SessionReceipt } from '../types/workout-session';

export interface SessionRepository {
  history(exerciseIds: readonly string[], signal?: AbortSignal): Promise<ExerciseHistory[]>;
  sync(session: ActiveWorkoutSession, signal?: AbortSignal): Promise<SessionReceipt>;
}
