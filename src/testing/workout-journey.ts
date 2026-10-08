// Shared client integration fixture. Application services/store/payload mapping
// are real. Remote repositories and the storage transport are test doubles.
import { AuthService } from '@/features/auth/services/auth-service';
import type { AuthRepository } from '@/features/auth/repositories/auth-repository';
import type { AuthSession } from '@/features/auth/types/auth';
import { WorkoutService } from '@/features/workouts/services/workout-service';
import type { WorkoutRepository } from '@/features/workouts/repositories/workout-repository';
import type { Workout } from '@/domain/entities/workout';
import { createSession, sessionRecords, sessionTotals } from '@/features/workouts/services/session-logic';
import { sessionPayload } from '@/features/workouts/services/session-payload';
import { LocalSessionRepository } from '@/features/workouts/repositories/local-session-repository';
import { createSessionStore } from '@/features/workouts/state/create-session-store';
import { SessionSyncService } from '@/features/workouts/services/session-sync-service';
import { AppError } from '@/domain/errors/app-error';
import type { ActiveWorkoutSession, SessionReceipt } from '@/features/workouts/types/workout-session';
import { input } from '@/features/workouts/testing/fixtures';

export const JOURNEY_OWNER = '99000000-0000-0000-0000-000000000001';
const templateId = '39000000-0000-0000-0000-000000000001';
const challengeId = '79000000-0000-0000-0000-000000000001';
export async function runWorkoutJourney(dropFirstResponse = false) {
  const authSession: AuthSession = { user: { id: JOURNEY_OWNER, email: 'journey@example.test' }, expiresAt: null };
  const authRepository: AuthRepository = {
    register: async () => ({ user: authSession.user, session: authSession }), isUsernameAvailable: async () => true,
    login: async () => authSession, getSession: async () => authSession, onSessionChange: () => () => {},
    logout: async () => {}, requestPasswordReset: async () => {}, exchangePasswordRecoveryCode: async () => authSession,
    updatePassword: async () => {}, startAutoRefresh: () => {}, stopAutoRefresh: () => {},
  };
  const registered = await new AuthService(authRepository, 'fithub://reset-password').register({ username: 'journey_user',
    displayName: 'Journey User', email: 'journey@example.test', password: 'TestPassword42!', confirmPassword: 'TestPassword42!' });
  let saved: Workout | null = null; let version = 0;
  const repository: WorkoutRepository = {
    findById: async (id) => saved?.id === id ? saved : null,
    listByOwner: async (owner) => ({ items: saved?.ownerId === owner ? [saved] : [], nextOffset: null }),
    save: async (values, id, expected) => {
      if (id && expected !== saved?.updatedAt) throw new AppError('Stale template', 'CONFLICT');
      const timestamp = new Date(Date.UTC(2026, 9, 8, 12, 0, ++version)).toISOString();
      saved = { ...values, id: id ?? templateId, ownerId: JOURNEY_OWNER, createdAt: saved?.createdAt ?? timestamp, updatedAt: timestamp,
        exercises: values.exercises.map((exercise, order) => ({ ...exercise, id: `entry-${order}`, order, exerciseName: 'Back Squat' })) };
      return saved.id;
    },
    delete: async () => { saved = null; },
  };
  const workouts = new WorkoutService(repository);
  const created = await workouts.create({ ...input, name: 'Journey workout', exercises: input.exercises.map((exercise) => ({ ...exercise, sets: 2 })) });
  const edited = await workouts.edit(JOURNEY_OWNER, created.id, created.updatedAt, { ...input, name: 'Edited journey',
    exercises: input.exercises.map((exercise) => ({ ...exercise, sets: 2, reps: 12 })) });
  const memory = new Map<string, string>();
  const persistence = new LocalSessionRepository({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } });
  const store = createSessionStore(persistence); store.getState().restore();
  let sequence = 0; const started = Date.UTC(2026, 9, 8, 12);
  const active = createSession(edited, registered.user.id, started,
    () => `89000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    [{ exerciseId: input.exercises[0]?.exerciseId ?? '', bestVolume: 150, previousSets: [] }]);
  store.getState().start(active);
  for (const exercise of active.exercises) for (const [index, set] of exercise.sets.entries()) {
    store.getState().dispatch(active.id, JOURNEY_OWNER, { type: 'toggle-set', exerciseId: exercise.id, setId: set.id, now: started + (index + 1) * 1000 });
  }
  store.getState().dispatch(active.id, JOURNEY_OWNER, { type: 'review', now: started + 60000 });
  store.getState().dispatch(active.id, JOURNEY_OWNER, { type: 'notes', value: 'Completed offline' });
  store.getState().dispatch(active.id, JOURNEY_OWNER, { type: 'submit', now: started + 65000 });
  const submitted = store.getState().sessions[0]; if (!submitted) throw new Error('Missing submitted session');
  // Recreate the whole store to model closing and reopening without networking.
  const reopened = createSessionStore(persistence); reopened.getState().restore();
  const offline = reopened.getState().sessions[0]; if (!offline) throw new Error('Missing restored session');
  const receipt: SessionReceipt = { ...sessionTotals(submitted, started + 900000), personalRecords: sessionRecords(submitted).records,
    achievements: [{ code: 'FIRST_WORKOUT', title: 'First Workout' }], challengeChanges: [{ id: challengeId, title: 'Workout count', value: 1 }] };
  const attemptedIds: string[] = []; const attemptedPayloads: string[] = [];
  const remote = { history: async () => [], sync: async (session: ActiveWorkoutSession) => {
    attemptedIds.push(session.id); attemptedPayloads.push(JSON.stringify(sessionPayload(session)));
    if (dropFirstResponse && attemptedIds.length === 1) throw new AppError('Response lost after remote commit', 'NETWORK');
    return receipt; // Authoritative server effects are verified separately by SQL tests.
  } };
  const worker = new SessionSyncService(remote, { sessions: () => reopened.getState().sessions,
    acknowledge: (...args) => reopened.getState().acknowledge(...args), fail: (...args) => reopened.getState().fail(...args) });
  await Promise.all([worker.sync(JOURNEY_OWNER), worker.sync(JOURNEY_OWNER)]);
  const afterFailure = dropFirstResponse ? reopened.getState().sessions[0] : null;
  if (dropFirstResponse) await worker.sync(JOURNEY_OWNER, true);
  await worker.sync(JOURNEY_OWNER); // Already acknowledged: no duplicate submission.
  const confirmed = reopened.getState().sessions[0]; if (!confirmed) throw new Error('Missing confirmed session');
  return { registered, created, edited, submitted, offline, afterFailure, confirmed, attemptedIds, attemptedPayloads,
    restoredAgain: persistence.restore(), receipt };
}
