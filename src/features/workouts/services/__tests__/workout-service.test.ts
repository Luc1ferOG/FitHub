import type { WorkoutRepository } from '../../repositories/workout-repository';
import { input, workout } from '../../testing/fixtures';
import { WorkoutService } from '../workout-service';

function setup() {
  const repository: jest.Mocked<WorkoutRepository> = { findById: jest.fn().mockResolvedValue(workout),
    listByOwner: jest.fn(), save: jest.fn().mockResolvedValue(workout.id), delete: jest.fn().mockResolvedValue(undefined) };
  return { repository, service: new WorkoutService(repository) };
}
describe('workout CRUD service', () => {
  it('creates and reads the saved aggregate', async () => {
    const { repository, service } = setup();
    expect(await service.create(input)).toEqual(workout);
    expect(repository.save).toHaveBeenCalledWith(input);
  });
  it('edits with the original version', async () => {
    const { repository, service } = setup();
    await service.edit('owner', workout.id, workout.updatedAt, input);
    expect(repository.save).toHaveBeenCalledWith(input, workout.id, workout.updatedAt);
  });
  it('deletes only the owner template', async () => {
    const { repository, service } = setup();
    await service.delete('owner', workout.id, workout.updatedAt);
    expect(repository.delete).toHaveBeenCalledWith(workout.id, workout.updatedAt);
    await expect(service.delete('other', workout.id, workout.updatedAt)).rejects.toMatchObject({ code: 'AUTHORIZATION' });
    expect(repository.delete).toHaveBeenCalledTimes(1);
  });
  it('duplicates all ordered configuration as a new private workout', async () => {
    const { repository, service } = setup();
    await service.duplicate(workout.id);
    expect(repository.save).toHaveBeenCalledWith({ ...input, name: 'Strength A (copy)', isPublic: false });
  });
  it('rejects invalid creates without writing', async () => {
    const { repository, service } = setup();
    await expect(service.create({ ...input, exercises: [] })).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('rejects editing another user and handles missing workouts', async () => {
    const { repository, service } = setup();
    await expect(service.edit('other', workout.id, workout.updatedAt, input)).rejects.toMatchObject({ code: 'AUTHORIZATION' });
    expect(repository.save).not.toHaveBeenCalled();
    repository.findById.mockResolvedValue(null);
    await expect(service.requireWorkout(workout.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    repository.findById.mockClear();
    await expect(service.requireWorkout('abc')).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(repository.findById).not.toHaveBeenCalled();
  });
});
