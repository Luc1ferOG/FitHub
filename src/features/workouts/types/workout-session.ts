export type PreviousSet = { weight: number; reps: number };
export type ExerciseHistory = { exerciseId: string; bestVolume: number; previousSets: PreviousSet[] };
export type LoggedSet = { id: string; weight: string; reps: string; completedAt: number | null };
export type SessionExercise = {
  id: string; exerciseId: string; name: string; targetSets: number; targetReps: number;
  restSeconds: number; notes: string; skipped: boolean;
  previousSets: PreviousSet[]; bestVolume: number | null; sets: LoggedSet[];
};
export type SessionRecord = { exerciseName: string; setNumber: number; volume: number };
export type SessionTotals = { durationSeconds: number; totalSets: number; totalReps: number; volume: number; exercisesCompleted: number };
export type SessionReceipt = SessionTotals & {
  personalRecords: SessionRecord[];
  achievements: { code: string; title: string }[];
  challengeChanges: { id: string; title: string; value: number }[];
};
export type ActiveWorkoutSession = {
  id: string; userId: string; workoutId: string | null; name: string;
  startedAt: number; completedAt: number | null; submittedAt: number | null;
  notes: string; exercises: SessionExercise[];
  autoRest: boolean; notifyRest: boolean; restEndsAt: number | null;
  syncStatus: 'pending' | 'failed' | 'synced'; syncError: string | null;
  receipt: SessionReceipt | null;
};
export type SessionAction =
  | { type: 'set-value'; exerciseId: string; setId: string; field: 'weight' | 'reps'; value: string }
  | { type: 'toggle-set'; exerciseId: string; setId: string; now: number }
  | { type: 'add-set'; exerciseId: string; id: string }
  | { type: 'remove-set'; exerciseId: string; setId: string }
  | { type: 'exercise-notes'; exerciseId: string; value: string }
  | { type: 'skip-exercise'; exerciseId: string }
  | { type: 'notes'; value: string }
  | { type: 'auto-rest'; value: boolean }
  | { type: 'notify-rest'; value: boolean }
  | { type: 'skip-rest' }
  | { type: 'extend-rest'; now: number }
  | { type: 'review'; now: number }
  | { type: 'resume' }
  | { type: 'submit'; now: number };
