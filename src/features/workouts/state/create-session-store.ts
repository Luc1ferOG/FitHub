import { createStore } from 'zustand/vanilla';
import { AppError } from '@/domain/errors/app-error';
import type { ActiveWorkoutSession, SessionAction, SessionReceipt } from '../types/workout-session';
import type { SessionPersistence } from '../repositories/local-session-repository';
import { acknowledgeSession, updateSession } from '../services/session-logic';

export type SessionStore = {
  sessions: ActiveWorkoutSession[]; hydrated: boolean; storageError: string | null;
  restore: () => void; start: (session: ActiveWorkoutSession) => void;
  dispatch: (id: string, userId: string, action: SessionAction) => void;
  replace: (session: ActiveWorkoutSession) => void;
  acknowledge: (id: string, userId: string, receipt: SessionReceipt) => void;
  fail: (id: string, userId: string, message: string) => void;
};
export function createSessionStore(repository: SessionPersistence) {
  return createStore<SessionStore>((set, get) => {
    const commit = (sessions: ActiveWorkoutSession[]) => {
      if (!get().hydrated) throw new AppError('Restore saved workout data before writing changes.', 'CONFLICT');
      // Write before publish: a failed disk write must not look like a successful log.
      try { repository.save(sessions); }
      catch (error) { set({ storageError: 'Could not save workout changes to this device. Free storage and retry; your previous saved data is retained.' }); throw error; }
      set({ sessions, storageError: null });
    };
    const owned = (id: string, userId: string) => {
      const session = get().sessions.find((item) => item.id === id && item.userId === userId);
      if (!session) throw new AppError('Workout session not found for this account.', 'NOT_FOUND');
      return session;
    };
    return { sessions: [], hydrated: false, storageError: null,
      restore: () => { try { set({ sessions: repository.restore(), hydrated: true, storageError: null }); } catch { set({ hydrated: false, storageError: 'Workout restoration failed. Saved data has not been overwritten. Retry after checking device storage.' }); } },
      start: (session) => {
        if (!get().hydrated) throw new AppError('Wait for workout restoration before starting.', 'CONFLICT');
        if (get().sessions.some((item) => item.id === session.id)) throw new AppError('Session ID already exists.', 'CONFLICT');
        if (get().sessions.some((item) => item.userId === session.userId && item.submittedAt === null)) throw new AppError('Resume your existing workout before starting another.', 'CONFLICT');
        commit([...get().sessions, session]);
      },
      dispatch: (id, userId, action) => { const session = updateSession(owned(id, userId), action); commit(get().sessions.map((item) => item.id === id ? session : item)); },
      replace: (session) => { owned(session.id, session.userId); commit(get().sessions.map((item) => item.id === session.id ? session : item)); },
      acknowledge: (id, userId, receipt) => { const session = acknowledgeSession(owned(id, userId), receipt); commit(get().sessions.map((item) => item.id === id ? session : item)); },
      fail: (id, userId, message) => { const session = owned(id, userId); commit(get().sessions.map((item) => item.id === id ? { ...session, syncStatus: 'failed', syncError: message } : item)); },
    };
  });
}
