import { AppError } from '@/domain/errors/app-error';
import type { Workout } from '@/domain/entities/workout';
import type { ActiveWorkoutSession, ExerciseHistory, LoggedSet, SessionAction, SessionReceipt, SessionRecord, SessionTotals } from '../types/workout-session';

export function setResult(set: LoggedSet): { weight: number; reps: number } {
  const weight = Number(set.weight), reps = Number(set.reps);
  if (set.weight.trim() === '' || !Number.isFinite(weight) || weight < 0 || weight > 999999.99 || Math.abs(weight * 100 - Math.round(weight * 100)) > 0.00001
    || set.reps.trim() === '' || !Number.isInteger(reps) || reps < 1 || reps > 10000) {
    throw new AppError('Enter a weight of 0–999999.99 kg and 1–10000 whole reps before completing the set.', 'VALIDATION');
  }
  return { weight, reps };
}
export function setVolume(set: LoggedSet): number {
  const { weight, reps } = setResult(set);
  return Math.round(weight * 100) * reps / 100;
}
export function sessionTotals(session: ActiveWorkoutSession, now: number): SessionTotals {
  let totalSets = 0, totalReps = 0, volumeCents = 0, exercisesCompleted = 0;
  for (const exercise of session.exercises) {
    const completed = exercise.sets.filter((set) => set.completedAt !== null);
    if (!exercise.skipped && exercise.sets.length > 0 && completed.length === exercise.sets.length) exercisesCompleted++;
    for (const set of completed) {
      const result = setResult(set);
      totalSets++; totalReps += result.reps; volumeCents += Math.round(result.weight * 100) * result.reps;
    }
  }
  return { durationSeconds: Math.max(0, Math.floor(((session.completedAt ?? now) - session.startedAt) / 1000)),
    totalSets, totalReps, volume: volumeCents / 100, exercisesCompleted };
}
/** PR definition: a strictly greater single-set volume (kg × reps). Ties are not records. */
export function sessionRecords(session: ActiveWorkoutSession): { setIds: string[]; records: SessionRecord[]; provisional: boolean } {
  const best = new Map<string, number>();
  for (const exercise of session.exercises) best.set(exercise.exerciseId, Math.max(best.get(exercise.exerciseId) ?? 0, exercise.bestVolume ?? 0));
  const entries = session.exercises.flatMap((exercise) => exercise.sets.map((set, index) => ({ exercise, set, index })))
    .filter(({ set }) => set.completedAt !== null).sort((a, b) => (a.set.completedAt ?? 0) - (b.set.completedAt ?? 0));
  const setIds: string[] = [], records: SessionRecord[] = [];
  for (const { exercise, set, index } of entries) {
    const volume = setVolume(set);
    if (volume > (best.get(exercise.exerciseId) ?? 0)) {
      best.set(exercise.exerciseId, volume); setIds.push(set.id);
      records.push({ exerciseName: exercise.name, setNumber: index + 1, volume });
    }
  }
  return { setIds, records, provisional: session.exercises.some((exercise) => exercise.bestVolume === null) };
}
export function createSession(workout: Workout, userId: string, now: number, uuid: () => string, history: readonly ExerciseHistory[] = []): ActiveWorkoutSession {
  if (!workout.exercises.length) throw new AppError('Add an exercise to the workout before starting.', 'VALIDATION');
  return { id: uuid(), userId, workoutId: workout.id, name: workout.name, startedAt: now, completedAt: null, submittedAt: null,
    notes: '', autoRest: true, notifyRest: false, restEndsAt: null, syncStatus: 'pending', syncError: null, receipt: null,
    exercises: workout.exercises.map((exercise) => {
      const previous = history.find((item) => item.exerciseId === exercise.exerciseId);
      return { id: uuid(), exerciseId: exercise.exerciseId, name: exercise.exerciseName, targetSets: exercise.sets, targetReps: exercise.reps,
        restSeconds: exercise.restSeconds, notes: exercise.notes, skipped: false, previousSets: previous?.previousSets ?? [], bestVolume: previous?.bestVolume ?? null,
        sets: Array.from({ length: exercise.sets }, () => ({ id: uuid(), weight: String(exercise.weight ?? 0), reps: String(exercise.reps), completedAt: null })) };
    }) };
}
export function applyHistory(session: ActiveWorkoutSession, history: readonly ExerciseHistory[]): ActiveWorkoutSession {
  if (session.submittedAt !== null) return session;
  return { ...session, exercises: session.exercises.map((exercise) => {
    const prior = history.find((item) => item.exerciseId === exercise.exerciseId);
    return prior ? { ...exercise, bestVolume: Math.max(prior.bestVolume, exercise.bestVolume ?? 0), previousSets: prior.previousSets } : exercise;
  }) };
}
export function updateSession(session: ActiveWorkoutSession, action: SessionAction): ActiveWorkoutSession {
  if (session.submittedAt !== null) throw new AppError('Submitted workouts cannot be edited.', 'CONFLICT');
  if (action.type === 'notes') return { ...session, notes: action.value.slice(0, 4000) };
  if (action.type === 'resume') return { ...session, completedAt: null };
  if (action.type === 'submit') {
    if (session.completedAt === null) throw new AppError('Review the workout before saving.', 'VALIDATION');
    return { ...session, submittedAt: action.now, restEndsAt: null, syncStatus: 'pending', syncError: null };
  }
  if (session.completedAt !== null) throw new AppError('Resume logging to change this workout.', 'CONFLICT');
  if (action.type === 'review') {
    const latestSet = Math.max(session.startedAt, ...session.exercises.flatMap((exercise) => exercise.sets.map((set) => set.completedAt ?? 0)));
    if (action.now < latestSet) throw new AppError('Your device clock changed. Correct it before finishing the workout.', 'VALIDATION');
    const totals = sessionTotals(session, action.now);
    if (!totals.totalSets) throw new AppError('Complete at least one set before finishing.', 'VALIDATION');
    if (totals.volume > 999999999999.99) throw new AppError('Workout volume exceeds the supported limit.', 'VALIDATION');
    return { ...session, completedAt: action.now, restEndsAt: null };
  }
  if (action.type === 'skip-rest') return { ...session, restEndsAt: null };
  if (action.type === 'extend-rest') return { ...session, restEndsAt: Math.max(session.restEndsAt ?? action.now, action.now) + 30000 };
  if (action.type === 'auto-rest') return { ...session, autoRest: action.value, restEndsAt: action.value ? session.restEndsAt : null };
  if (action.type === 'notify-rest') return { ...session, notifyRest: action.value };
  const index = session.exercises.findIndex((exercise) => exercise.id === action.exerciseId);
  const exercise = session.exercises[index];
  if (!exercise) throw new AppError('Exercise not found.', 'NOT_FOUND');
  let updated = exercise, restEndsAt = session.restEndsAt;
  if (action.type === 'exercise-notes') updated = { ...exercise, notes: action.value.slice(0, 1000) };
  if (action.type === 'skip-exercise') { updated = { ...exercise, skipped: !exercise.skipped }; restEndsAt = null; }
  if (action.type === 'add-set') {
    if (exercise.sets.length >= 100) throw new AppError('Maximum 100 sets per exercise.', 'VALIDATION');
    const last = exercise.sets[exercise.sets.length - 1];
    updated = { ...exercise, skipped: false, sets: [...exercise.sets, { id: action.id, weight: last?.weight ?? '0', reps: last?.reps ?? String(exercise.targetReps), completedAt: null }] };
  }
  if (action.type === 'remove-set') {
    if (exercise.sets.some((set) => set.id === action.setId && set.completedAt !== null)) restEndsAt = null;
    updated = { ...exercise, sets: exercise.sets.filter((set) => set.id !== action.setId) };
  }
  if (action.type === 'set-value' || action.type === 'toggle-set') {
    const target = exercise.sets.find((set) => set.id === action.setId);
    if (!target) throw new AppError('Set not found.', 'NOT_FOUND');
    if (action.type === 'set-value' && target.completedAt !== null) throw new AppError('Uncheck the set before editing it.', 'VALIDATION');
    if (action.type === 'toggle-set' && target.completedAt === null) {
      if (!Number.isInteger(action.now) || action.now < session.startedAt) throw new AppError('Your device clock changed. Correct it before completing another set.', 'VALIDATION');
      setResult(target);
      if (session.autoRest && exercise.restSeconds > 0) restEndsAt = action.now + exercise.restSeconds * 1000;
    }
    if (action.type === 'toggle-set' && target.completedAt !== null) restEndsAt = null;
    updated = { ...exercise, skipped: false, sets: exercise.sets.map((set) => set.id !== target.id ? set : action.type === 'set-value'
      ? { ...set, [action.field]: action.value.slice(0, 16) }
      : { ...set, completedAt: set.completedAt === null ? action.now : null }) };
  }
  return { ...session, restEndsAt, exercises: session.exercises.map((item, i) => i === index ? updated : item) };
}
export function acknowledgeSession(session: ActiveWorkoutSession, receipt: SessionReceipt): ActiveWorkoutSession {
  return { ...session, syncStatus: 'synced', syncError: null, receipt };
}
