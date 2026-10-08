import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { input, workout } from '../../testing/fixtures';
import { workoutService } from '../../services/workout-dependencies';
import type { WorkoutCommand, WorkoutPage } from '../../types/workout';
import { useWorkoutMutation, workoutKeys } from '../use-workouts';

jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('../../services/workout-dependencies', () => ({ workoutService: {
  create: jest.fn(), edit: jest.fn(), delete: jest.fn(), duplicate: jest.fn(),
} }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  const key = workoutKeys.list('owner', 0);
  client.setQueryData(key, { items: [workout], nextOffset: null });
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, key, hook: renderHook(() => useWorkoutMutation(), { wrapper: Wrapper }) };
}
describe('workout mutation cache', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each(['create', 'edit', 'duplicate', 'delete'] as const)('invalidates owner pages after %s', async (type) => {
    const { client, hook } = setup();
    jest.mocked(workoutService.create).mockResolvedValue(workout);
    jest.mocked(workoutService.edit).mockResolvedValue(workout);
    jest.mocked(workoutService.duplicate).mockResolvedValue(workout);
    jest.mocked(workoutService.delete).mockResolvedValue(undefined);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const command: WorkoutCommand = type === 'create' ? { type, input } : type === 'edit' ? { type, id: workout.id, updatedAt: workout.updatedAt, input } : type === 'delete' ? { type, id: workout.id, updatedAt: workout.updatedAt } : { type, id: workout.id };
    await act(async () => { await hook.result.current.mutateAsync(command); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: workoutKeys.lists('owner') });
    if (type !== 'delete') expect(client.getQueryData(workoutKeys.detail(workout.id, 'owner'))).toEqual(workout);
    hook.unmount(); client.clear();
  });
  it('optimistically hides deleted rows and restores them after failure', async () => {
    let rejectWrite: (reason: Error) => void = () => undefined;
    jest.mocked(workoutService.delete).mockImplementation(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    const { client, key, hook } = setup();
    act(() => { hook.result.current.mutate({ type: 'delete', id: workout.id, updatedAt: workout.updatedAt }); });
    await waitFor(() => expect(client.getQueryData<WorkoutPage>(key)?.items).toEqual([]));
    await act(async () => { rejectWrite(new Error('Offline')); });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(client.getQueryData<WorkoutPage>(key)?.items).toEqual([workout]);
    hook.unmount(); client.clear();
  });
  it('rolls back an optimistic edit without discarding the cached workout', async () => {
    jest.mocked(workoutService.edit).mockRejectedValue(new Error('Offline'));
    const { client, key, hook } = setup();
    await act(async () => { try { await hook.result.current.mutateAsync({ type: 'edit', id: workout.id, updatedAt: workout.updatedAt, input: { ...input, name: 'Changed' } }); } catch { /* expected */ } });
    expect(client.getQueryData<WorkoutPage>(key)?.items[0]?.name).toBe(workout.name);
    hook.unmount(); client.clear();
  });
});
