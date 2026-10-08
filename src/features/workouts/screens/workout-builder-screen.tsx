import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Screen } from '@/components/layout/screen';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import type { Workout } from '@/domain/entities/workout';
import { useAuth } from '@/features/auth/context/auth-context';
import { getErrorMessage } from '@/utils/errors';
import { WorkoutBuilder } from '../components/workout-builder';
import { useWorkout, useWorkoutMutation } from '../hooks/use-workouts';
import type { WorkoutInput } from '../types/workout';

export function CreateWorkoutScreen() { return <WorkoutEditor />; }

export function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const query = useWorkout(workoutId);
  const { user } = useAuth();
  if (query.isPending) return <LoadingIndicator fullScreen label="Loading workout builder" />;
  if (!query.data) return <Screen><EmptyState title="Could not load workout" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={() => void query.refetch()} /></Screen>;
  if (query.data.ownerId !== user?.id) return <Screen><EmptyState title="This workout is read-only" description="Duplicate the template to customize your own copy." /></Screen>;
  return <WorkoutEditor initial={query.data} />;
}

function WorkoutEditor({ initial }: { initial?: Workout }) {
  // Freeze the version with the form; background refetches must not authorize stale edits.
  const [baseline] = useState(initial);
  const router = useRouter();
  const mutation = useWorkoutMutation();
  const save = async (input: WorkoutInput) => {
    try {
      const workout = await mutation.mutateAsync(baseline ? { type: 'edit', id: baseline.id, updatedAt: baseline.updatedAt, input } : { type: 'create', input });
      if (workout) router.replace({ pathname: '/workouts/[workoutId]', params: { workoutId: workout.id, saved: '1' } });
    } catch { /* Render the mutation error without discarding the form. */ }
  };
  return <Screen contentStyle={{ flex: 1 }}>
    <Stack.Screen options={{ title: baseline ? 'Edit workout' : 'Create workout' }} />
    <WorkoutBuilder {...(baseline ? { initial: baseline } : {})} busy={mutation.isBusy} error={mutation.error ? getErrorMessage(mutation.error) : null} onSave={save} />
  </Screen>;
}
