import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Workout } from '@/domain/entities/workout';
import { useAuth } from '@/features/auth/context/auth-context';
import { isUuid } from '@/validation/uuid';
import { workoutService } from '../services/workout-dependencies';
import { optimisticWorkoutPage, rollbackWorkoutPage, workoutKeys } from '../services/workout-cache';
import type { WorkoutCommand, WorkoutPage } from '../types/workout';
import { writeInvalidationKeys } from '@/services/query/write-invalidation';

export { workoutKeys } from '../services/workout-cache';

export function useWorkouts(offset: number) {
  const { user } = useAuth();
  return useQuery({ queryKey: workoutKeys.list(user?.id ?? '', offset), enabled: Boolean(user),
    queryFn: ({ signal }) => workoutService.list(user?.id ?? '', offset, signal), staleTime: 60000, networkMode: 'always', retry: false });
}
export function useWorkout(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: workoutKeys.detail(id, user?.id ?? ''), enabled: Boolean(user && isUuid(id)),
    queryFn: ({ signal }) => workoutService.requireWorkout(id, signal), staleTime: 60000, networkMode: 'always', retry: false });
}
export function useWorkoutMutation() {
  const { user } = useAuth();
  const ownerId = user?.id ?? '';
  const client = useQueryClient();
  const writes = useIsMutating({ mutationKey: workoutKeys.mutation(ownerId) });
  const mutation = useMutation({
    mutationKey: workoutKeys.mutation(ownerId), scope: { id: `workout-write:${ownerId}` }, retry: false,
    mutationFn: async (command: WorkoutCommand): Promise<Workout | null> => {
      if (!user) throw new Error('Sign in to manage workouts.');
      switch (command.type) {
        case 'create': return workoutService.create(command.input);
        case 'edit': return workoutService.edit(ownerId, command.id, command.updatedAt, command.input);
        case 'duplicate': return workoutService.duplicate(command.id);
        case 'delete': await workoutService.delete(ownerId, command.id, command.updatedAt); return null;
      }
    },
    onMutate: async (command) => {
      await client.cancelQueries({ queryKey: workoutKeys.lists(ownerId) });
      // Network writes are serialized by scope. Skip optimism for overlapping
      // invocations so queued writes cannot snapshot another write's temporary row.
      if (client.isMutating({ mutationKey: workoutKeys.mutation(ownerId) }) > 1) return { snapshots: [] };
      if (command.type !== 'edit' && command.type !== 'delete') return { snapshots: [] };
      const snapshots = client.getQueriesData<WorkoutPage>({ queryKey: workoutKeys.lists(ownerId) });
      for (const [key, page] of snapshots) {
        if (!page) continue;
        const original = page.items.find((item) => item.id === command.id);
        if (!original) continue;
        const next = command.type === 'delete' ? null : { ...original, name: command.input.name,
          description: command.input.description, isPublic: command.input.isPublic, estimatedDuration: command.input.estimatedDuration };
        client.setQueryData(key, optimisticWorkoutPage(page, command.id, next));
      }
      return { snapshots };
    },
    onError: (_error, command, context) => {
      if (command.type !== 'edit' && command.type !== 'delete') return;
      for (const [key, before] of context?.snapshots ?? []) {
        if (before) client.setQueryData<WorkoutPage>(key, (current) => current ? rollbackWorkoutPage(current, before, command.id) : before);
      }
    },
    onSuccess: (workout, command) => {
      for (const queryKey of writeInvalidationKeys('workout-template', ownerId)) void client.invalidateQueries({ queryKey });
      if (workout) client.setQueryData(workoutKeys.detail(workout.id, ownerId), workout);
      if (command.type === 'delete') client.removeQueries({ queryKey: workoutKeys.detail(command.id, ownerId), exact: true });
    },
    onSettled: async (_workout, _error, command) => {
      await client.invalidateQueries({ queryKey: workoutKeys.lists(ownerId) });
      if (command.type === 'edit' || command.type === 'delete') {
        await client.invalidateQueries({ queryKey: workoutKeys.detail(command.id, ownerId), refetchType: command.type === 'delete' ? 'none' : 'active' });
      }
    },
  });
  return { ...mutation, isBusy: writes > 0 || mutation.isPending };
}
