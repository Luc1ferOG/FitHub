import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Workout } from '@/domain/entities/workout';
import { useAuth } from '@/features/auth/context/auth-context';
import { getErrorMessage } from '@/utils/errors';
import { applyHistory, createSession, sessionRecords, sessionTotals, setResult, setVolume } from '../services/session-logic';
import { sessionStore, useSessionStore } from '../state/session-store';
import type { ExerciseHistory, SessionAction } from '../types/workout-session';
import { sessionHistoryKey, useSessionHistory } from './use-session-history';
import { useWorkoutClock } from './use-workout-clock';
export { useWorkoutClock };

export function useBeginWorkout() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useCallback((workout: Workout) => {
    if (!user) throw new Error('Sign in to start a workout.');
    const state = sessionStore.getState();
    const current = state.sessions.find((session) => session.userId === user.id && session.submittedAt === null);
    if (current) return current.id;
    const ids = workout.exercises.map((exercise) => exercise.exerciseId);
    const cached = client.getQueryData<ExerciseHistory[]>(sessionHistoryKey(user.id, ids)) ?? [];
    const history = new Map(cached.map((item) => [item.exerciseId, item]));
    // Locally submitted workouts are also usable history while offline.
    for (const session of state.sessions.filter((item) => item.userId === user.id && item.submittedAt !== null).sort((a, b) => a.startedAt - b.startedAt)) {
      for (const exercise of session.exercises) {
        const completed = exercise.sets.filter((set) => set.completedAt !== null);
        if (!completed.length) continue;
        const old = history.get(exercise.exerciseId);
        history.set(exercise.exerciseId, { exerciseId: exercise.exerciseId, bestVolume: Math.max(old?.bestVolume ?? 0, ...completed.map(setVolume)), previousSets: completed.map(setResult) });
      }
    }
    const session = createSession(workout, user.id, Date.now(), randomUUID, [...history.values()]);
    state.start(session);
    return session.id;
  }, [client, user]);
}
export function useWorkoutSession(id: string) {
  const { user } = useAuth();
  const session = useSessionStore((state) => state.sessions.find((item) => item.id === id && item.userId === user?.id));
  const hydrated = useSessionStore((state) => state.hydrated);
  const storageError = useSessionStore((state) => state.storageError);
  const [error, setError] = useState<string | null>(null);
  const now = useWorkoutClock();
  const ids = useMemo(() => session?.exercises.map((exercise) => exercise.exerciseId) ?? [], [session?.exercises]);
  const history = useSessionHistory(ids);
  useEffect(() => {
    if (!user || !history.data) return;
    const current = sessionStore.getState().sessions.find((item) => item.id === id && item.userId === user.id);
    if (!current || current.submittedAt !== null) return;
    try { sessionStore.getState().replace(applyHistory(current, history.data)); } catch (cause) {
      // Surface failures from synchronization with the external persisted store.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(getErrorMessage(cause));
    }
  }, [history.data, id, user]);
  const dispatch = useCallback((action: SessionAction) => {
    if (!user) return;
    try { sessionStore.getState().dispatch(id, user.id, action); setError(null); } catch (cause) { setError(getErrorMessage(cause)); }
  }, [id, user]);
  const restEndsAt = session?.restEndsAt ?? null;
  useEffect(() => {
    if (restEndsAt === null || restEndsAt > now) return;
    const timer = setTimeout(() => dispatch({ type: 'skip-rest' }), 0);
    return () => clearTimeout(timer);
  }, [dispatch, now, restEndsAt]);
  const records = useMemo<ReturnType<typeof sessionRecords>>(() => session ? sessionRecords(session) : { setIds: [], records: [], provisional: true }, [session]);
  return { session, hydrated, storageError, error, dispatch, now, records,
    totals: session ? sessionTotals(session, now) : null, historyUnavailable: history.isError };
}
