import { calculateChallengeProgress, progressPercent, qualifiesForChallenge, rankScores, targetToStorage, type Qualification, type QualifyingWorkout } from '../challenge-rules';

const qualification: Qualification = { metric: 'workout_count', exerciseId: null, startDate: '2026-10-01', endDate: '2026-10-31',
  joinedAt: '2026-10-01T10:00:00Z', leftAt: null, status: 'active' };
const workout: QualifyingWorkout = { startedAt: '2026-10-02T12:00:00Z', completedAt: '2026-10-02T12:30:00Z', durationSeconds: 1800,
  sets: [{ exerciseId: 'push-up', weightKg: 0, reps: 20, completed: true }, { exerciseId: 'squat', weightKg: 50, reps: 10, completed: true },
    { exerciseId: 'squat', weightKg: 100, reps: 100, completed: false }] };

describe('challenge reference calculations (PostgreSQL remains authoritative)', () => {
  it.each([['workout_count', 1], ['volume_kg', 500], ['repetitions', 30], ['duration_seconds', 1800], ['distance_m', 0]] as const)('calculates %s from completed evidence only', (metric, expected) => {
    expect(calculateChallengeProgress({ ...qualification, metric }, workout)).toBe(expected);
  });
  it('counts repetitions only for the configured exercise', () => {
    expect(calculateChallengeProgress({ ...qualification, metric: 'repetitions', exerciseId: 'push-up' }, workout)).toBe(20);
  });
  it.each([
    { completedAt: null }, { completedAt: '2026-10-02T11:59:59Z' }, { startedAt: 'invalid' },
    { startedAt: '2026-10-01T09:59:59Z' }, { completedAt: '2026-11-01T00:00:00Z' },
  ])('rejects unfinished, prejoin, reversed or out-of-date workouts: %j', (patch) => {
    expect(qualifiesForChallenge(qualification, { ...workout, ...patch })).toBe(false);
    expect(calculateChallengeProgress(qualification, { ...workout, ...patch })).toBe(0);
  });
  it('includes the final UTC day and exactly the join time', () => {
    expect(qualifiesForChallenge(qualification, { ...workout, startedAt: qualification.joinedAt, completedAt: '2026-10-31T23:59:59.999Z' })).toBe(true);
  });
  it('allows the seven-day late sync grace but rejects the following day', () => {
    expect(qualifiesForChallenge(qualification, workout, new Date('2026-11-07T23:59:59Z'))).toBe(true);
    expect(qualifiesForChallenge(qualification, workout, new Date('2026-11-08T00:00:00Z'))).toBe(false);
  });
  it('uses UTC instants rather than the date spelled in an offset timestamp', () => {
    expect(qualifiesForChallenge(qualification, { ...workout, completedAt: '2026-10-31T23:30:00-02:00' })).toBe(false);
  });
  it('excludes former participants/cancelled challenges', () => {
    expect(qualifiesForChallenge({ ...qualification, leftAt: '2026-10-03T00:00:00Z' }, workout)).toBe(false);
    expect(qualifiesForChallenge({ ...qualification, status: 'cancelled' }, workout)).toBe(false);
  });
  it('converts minute targets once and clamps visual completion only', () => {
    expect(targetToStorage('duration_seconds', 300)).toBe(18000);
    expect(targetToStorage('volume_kg', 300)).toBe(300);
    expect(progressPercent(25, 20)).toBe(100); expect(progressPercent(-1, 20)).toBe(0); expect(progressPercent(1, 0)).toBe(0);
  });
});
describe('leaderboard ordering', () => {
  it('uses dense ties and stable user IDs independent of input ordering', () => {
    const scores = [{ userId: 'c', value: 11 }, { userId: 'b', value: 15 }, { userId: 'a', value: 15 }];
    expect(rankScores(scores)).toEqual([{ userId: 'a', value: 15, rank: 1 }, { userId: 'b', value: 15, rank: 1 }, { userId: 'c', value: 11, rank: 2 }]);
    expect(rankScores([...scores].reverse())).toEqual(rankScores(scores)); expect(scores[0]?.userId).toBe('c');
  });
  it('does not split ties at a page boundary', () => {
    const scores = Array.from({ length: 25 }, (_, i) => ({ userId: String(i).padStart(3, '0'), value: i < 21 ? 10 : 5 }));
    const ranked = rankScores(scores);
    expect(ranked[19]?.rank).toBe(1); expect(ranked[20]?.rank).toBe(1); expect(ranked[21]?.rank).toBe(2);
    expect(new Set(ranked.map((row) => row.userId)).size).toBe(25); expect(rankScores([])).toEqual([]);
  });
});
