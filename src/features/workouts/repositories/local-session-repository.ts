import { AppError } from '@/domain/errors/app-error';
import type { ActiveWorkoutSession } from '../types/workout-session';
import { sessionStorageSchema } from '../validation/session-schema';

export interface SessionStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SessionPersistence { restore(): ActiveWorkoutSession[]; save(sessions: readonly ActiveWorkoutSession[]): void }
export const SESSION_STORAGE_KEY = '@fithub/workout-sessions-v1';
export class LocalSessionRepository {
  constructor(private readonly storage: SessionStorage) {}
  restore(): ActiveWorkoutSession[] {
    const raw = this.storage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return [];
    const result = sessionStorageSchema.safeParse(JSON.parse(raw));
    if (!result.success) throw new AppError('Stored workout data could not be read. It has been preserved; retry restoration instead of starting another workout.', 'VALIDATION', { cause: result.error });
    return result.data.sessions;
  }
  save(sessions: readonly ActiveWorkoutSession[]): void {
    this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, sessions }));
  }
}
