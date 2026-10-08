import { runWorkoutJourney } from '../workout-journey';

describe('register → create → edit → start → complete → synchronization', () => {
  it('preserves edited targets offline and applies authoritative challenge/achievement results', async () => {
    const journey = await runWorkoutJourney();
    expect(journey.registered.session?.user.id).toBe(journey.created.ownerId);
    expect(journey.created.name).toBe('Journey workout'); expect(journey.edited.name).toBe('Edited journey');
    expect(journey.created.exercises[0]?.reps).toBe(10); expect(journey.edited.exercises[0]?.reps).toBe(12);
    expect(journey.offline).toEqual(journey.submitted); expect(journey.offline.notes).toBe('Completed offline');
    expect(journey.confirmed.syncStatus).toBe('synced');
    expect(journey.confirmed.receipt).toMatchObject({ durationSeconds: 60, totalSets: 2, totalReps: 24, volume: 480,
      exercisesCompleted: 1, challengeChanges: [expect.objectContaining({ value: 1 })], achievements: [expect.objectContaining({ code: 'FIRST_WORKOUT' })] });
    expect(journey.attemptedIds).toEqual([journey.submitted.id]); expect(journey.restoredAgain).toEqual([journey.confirmed]);
  });
  it('recovers a lost response without changing the identity or immutable payload', async () => {
    const journey = await runWorkoutJourney(true);
    expect(journey.afterFailure?.syncStatus).toBe('failed'); expect(journey.afterFailure?.receipt).toBeNull();
    expect(journey.attemptedIds).toEqual([journey.submitted.id, journey.submitted.id]);
    expect(new Set(journey.attemptedPayloads).size).toBe(1); expect(journey.restoredAgain).toHaveLength(1);
    expect(journey.confirmed.receipt?.challengeChanges).toHaveLength(1);
  });
});
