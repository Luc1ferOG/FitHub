import type { Workout } from '@/domain/entities/workout';
import { AppError } from '@/domain/errors/app-error';
import type { WorkoutRepository } from '@/features/workouts/repositories/workout-repository';
import { OfflineWorkoutRepository, type OfflineCacheStorage } from '../offline-workout-repository';

const owner = '20000000-0000-0000-0000-000000000001';
const workout: Workout = {
  id: '30000000-0000-0000-0000-000000000001', ownerId: owner, name: 'Offline strength',
  description: '', isPublic: false, estimatedDuration: 1800, createdAt: '2026-10-07T10:00:00Z', updatedAt: '2026-10-07T10:00:00Z',
  exercises: [{ id: '40000000-0000-0000-0000-000000000001', exerciseId: '10000000-0000-0000-0000-000000000001',
    exerciseName: 'Squat', order: 0, sets: 3, reps: 10, weight: 20, restSeconds: 60, notes: '' }],
};
function setup() {
  const values = new Map<string, string>();
  const cache: OfflineCacheStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }, removeByPrefix: (prefix) => { for (const key of values.keys()) if (key.startsWith(prefix)) values.delete(key); },
    valuesByPrefix: (prefix) => [...values].filter(([key]) => key.startsWith(prefix)).map(([, value]) => value) };
  const remote: jest.Mocked<WorkoutRepository> = { findById: jest.fn().mockResolvedValue(workout),
    listByOwner: jest.fn().mockResolvedValue({ items: [workout], nextOffset: null }), save: jest.fn(), delete: jest.fn() };
  let offline = false, user = owner;
  return { remote, cache, values, offline: () => { offline = true; }, user: (id: string) => { user = id; },
    repository: new OfflineWorkoutRepository(remote, cache, () => user, () => offline) };
}
describe('durable workout cache using real Zod validation', () => {
  it('restores a complete template and page offline without calling Supabase', async () => {
    const state = setup(); await state.repository.findById(workout.id); await state.repository.listByOwner(owner, 0); state.offline();
    expect(await state.repository.findById(workout.id)).toEqual(workout);
    expect((await state.repository.listByOwner(owner, 0)).items).toHaveLength(1);
    expect(state.remote.findById).toHaveBeenCalledTimes(1); expect(state.remote.listByOwner).toHaveBeenCalledTimes(1);
  });
  it('does not expose cached private templates to another account', async () => {
    const state = setup(); await state.repository.findById(workout.id); state.offline(); state.user('another-account');
    await expect(state.repository.findById(workout.id)).rejects.toMatchObject({ code: 'NETWORK' });
    await expect(state.repository.listByOwner(owner, 0)).rejects.toMatchObject({ code: 'AUTHORIZATION' });
  });
  it('rejects corrupt cached data without destroying the source', async () => {
    const state = setup(); await state.repository.findById(workout.id);
    const key = `workouts:${owner}:detail:${workout.id}`;
    state.values.set(key, JSON.stringify({ ...workout, exercises: [{ ...workout.exercises[0], sets: 0 }] })); state.offline();
    await expect(state.repository.findById(workout.id)).rejects.toThrow(); expect(state.values.has(key)).toBe(true);
  });
  it('uses cached data for network failures, not authorization failures', async () => {
    const state = setup(); await state.repository.findById(workout.id);
    state.remote.findById.mockRejectedValue(new AppError('Network', 'NETWORK'));
    expect(await state.repository.findById(workout.id)).toEqual(workout);
    state.remote.findById.mockRejectedValue(new AppError('Forbidden', 'AUTHORIZATION'));
    await expect(state.repository.findById(workout.id)).rejects.toMatchObject({ code: 'AUTHORIZATION' });
    state.offline(); await expect(state.repository.findById(workout.id)).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
