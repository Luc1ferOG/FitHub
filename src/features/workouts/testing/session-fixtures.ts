import { createSession } from '../services/session-logic';
import type { SessionReceipt } from '../types/workout-session';
import { workout } from './fixtures';

export const SESSION_OWNER = '90000000-0000-0000-0000-000000000001';
export function makeSession() {
  let sequence = 0;
  return createSession(workout, SESSION_OWNER, Date.UTC(2026, 9, 6, 12),
    () => `80000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    [{ exerciseId: workout.exercises[0]?.exerciseId ?? '', bestVolume: 150, previousSets: [{ weight: 15, reps: 10 }] }]);
}
export const receipt: SessionReceipt = { durationSeconds: 60, totalSets: 1, totalReps: 10, volume: 200, exercisesCompleted: 0,
  personalRecords: [{ exerciseName: 'Back Squat', setNumber: 1, volume: 200 }], achievements: [{ code: 'FIRST_WORKOUT', title: 'First Step' }], challengeChanges: [] };
