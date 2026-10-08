import type { ChallengeMetric } from '@/types/database';

export const METRIC_LABELS: Record<ChallengeMetric, string> = { workout_count: 'Workout Count', volume_kg: 'Total Workout Volume', repetitions: 'Exercise Repetitions', duration_seconds: 'Workout Minutes', distance_m: 'Distance' };
export function displayChallengeValue(metric: ChallengeMetric, value: number): string {
  const converted = metric === 'duration_seconds' ? value / 60 : value;
  return `${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}${metric === 'volume_kg' ? ' kg' : metric === 'duration_seconds' ? ' min' : metric === 'repetitions' ? ' reps' : metric === 'distance_m' ? ' m' : ' workouts'}`;
}
export function targetToStorage(metric: ChallengeMetric, target: number): number { return metric === 'duration_seconds' ? target * 60 : target; }
export function progressPercent(value: number, target: number): number { return target > 0 ? Math.max(0, Math.min(100, value / target * 100)) : 0; }
export type QualifyingWorkout = { startedAt: string; completedAt: string | null; durationSeconds: number; sets: { exerciseId: string; reps: number; weightKg: number; completed: boolean }[] };
export type Qualification = { metric: ChallengeMetric; exerciseId: string | null; startDate: string; endDate: string; joinedAt: string; leftAt: string | null; status: string };
// Reference model for unit tests/preview only. PostgreSQL remains authoritative.
export function qualifiesForChallenge(challenge: Qualification, workout: QualifyingWorkout, syncTime?: Date): boolean {
  const start = Date.parse(workout.startedAt); const finish = Date.parse(workout.completedAt ?? ''); const joined = Date.parse(challenge.joinedAt);
  if (challenge.leftAt || !['active', 'completed'].includes(challenge.status) || !Number.isFinite(start) || !Number.isFinite(finish) || !Number.isFinite(joined) || finish < start || start < joined) return false;
  const startDay = new Date(start).toISOString().slice(0, 10); const endDay = new Date(finish).toISOString().slice(0, 10);
  if (syncTime && Date.parse(syncTime.toISOString().slice(0,10)) > Date.parse(challenge.endDate) + 7 * 86400000) return false;
  return startDay >= challenge.startDate && endDay <= challenge.endDate;
}
export function calculateChallengeProgress(challenge: Qualification, workout: QualifyingWorkout): number {
  if (!qualifiesForChallenge(challenge, workout)) return 0;
  const sets = workout.sets.filter((set) => set.completed);
  switch (challenge.metric) {
    case 'workout_count': return 1;
    case 'duration_seconds': return Math.max(0, workout.durationSeconds);
    case 'volume_kg': return sets.reduce((sum, set) => sum + Math.max(0, set.reps) * Math.max(0, set.weightKg), 0);
    case 'repetitions': return sets.filter((set) => challenge.exerciseId === null || set.exerciseId === challenge.exerciseId).reduce((sum, set) => sum + Math.max(0, set.reps), 0);
    default: return 0;
  }
}
export function rankScores<T extends { userId: string; value: number }>(scores: readonly T[]): (T & { rank: number })[] {
  const ordered = [...scores].sort((a, b) => b.value - a.value || a.userId.localeCompare(b.userId));
  let rank = 0; let previous: number | undefined;
  return ordered.map((score) => { if (score.value !== previous) rank++; previous = score.value; return { ...score, rank }; });
}
export const challengeKeys = {
  root: ['challenges'] as const,
  list: (owner: string, kind: string) => ['challenges', owner, 'list', kind] as const,
  detail: (owner: string, id: string) => ['challenges', owner, 'detail', id] as const,
};
