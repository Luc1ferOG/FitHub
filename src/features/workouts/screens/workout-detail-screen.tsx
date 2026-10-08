import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/context/auth-context';
import { useAppTheme } from '@/theme';
import { getErrorMessage, isUnavailableRecord } from '@/utils/errors';
import { useAppStore } from '@/store/app-store';
import { isUuid } from '@/validation/uuid';
import { useWorkout, useWorkoutMutation } from '../hooks/use-workouts';
import { DeleteWorkoutDialog } from '../components/delete-workout-dialog';
import { useBeginWorkout } from '../hooks/use-workout-session';
import { useSessionHistory } from '../hooks/use-session-history';
import { useSessionStore } from '../state/session-store';

export function WorkoutDetailScreen() {
  const { workoutId, saved } = useLocalSearchParams<{ workoutId: string; saved?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();
  const offline = useAppStore((state) => state.isOffline);
  const query = useWorkout(workoutId);
  const mutation = useWorkoutMutation();
  const begin = useBeginWorkout();
  const hydrated = useSessionStore((state) => state.hydrated);
  useSessionHistory(query.data?.exercises.map((exercise) => exercise.exerciseId) ?? []);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!isUuid(workoutId)) return <Screen><EmptyState title="Invalid workout link" description="This workout identifier is invalid." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  if (isUnavailableRecord(query.error)) return <Screen><EmptyState title="Workout unavailable" description="This workout was deleted or is no longer available to your account." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  if (query.isPending) return <LoadingIndicator fullScreen label="Loading workout" />;
  if (!query.data) return <Screen><EmptyState title="Workout unavailable" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={() => void query.refetch()} /></Screen>;
  const workout = query.data;
  const isOwner = workout.ownerId === user?.id;
  const duplicate = async () => {
    try {
      const copy = await mutation.mutateAsync({ type: 'duplicate', id: workout.id });
      if (copy) router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: copy.id, saved: '1' } });
    } catch { /* Error remains visible beside the action. */ }
  };
  const deleteWorkout = async () => {
    try {
      await mutation.mutateAsync({ type: 'delete', id: workout.id, updatedAt: workout.updatedAt });
      setConfirmDelete(false);
      router.replace('/(tabs)/workouts');
    } catch { /* Keep the confirmation open so the user can retry. */ }
  };
  return <Screen scroll contentStyle={{ gap: 16 }}>
    <Stack.Screen options={{ title: workout.name }} />
    <Button label="Start Workout" disabled={!hydrated || !workout.exercises.length} onPress={() => {
      try { const sessionId = begin(workout); router.push({ pathname: '/workouts/active/[sessionId]', params: { sessionId } }); setStartError(null); }
      catch (cause) { setStartError(getErrorMessage(cause)); }
    }} />
    {offline ? <Text style={{ color: theme.colors.textMuted }}>This cached workout is available offline. Template edits require a connection.</Text> : null}
    {startError ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{startError}</Text> : null}
    {query.isError ? <Button label="Refresh failed. Retry loading workout" variant="ghost" onPress={() => void query.refetch()} /> : null}
    {saved === '1' ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.text }}>Workout saved successfully.</Text> : null}
    <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{workout.name}</Text>
    <Text style={[theme.typography.body, { color: theme.colors.text }]}>{workout.description || 'No description.'}</Text>
    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{workout.isPublic ? 'Public' : 'Private'}{workout.estimatedDuration ? ` · ${Math.round(workout.estimatedDuration / 60)} minutes` : ''}</Text>
    {!workout.exercises.length ? <EmptyState title="No exercises yet" description="Edit this workout to add exercises." /> : null}
    {workout.exercises.map((exercise, index) => <Card key={exercise.id}><View style={{ gap: 8 }}>
      <Text style={[theme.typography.title, { color: theme.colors.text }]}>{index + 1}. {exercise.exerciseName}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.text }]}>{exercise.sets} sets × {exercise.reps} reps{exercise.weight !== null ? ` · ${exercise.weight} kg` : ''} · {exercise.restSeconds}s rest</Text>
      {exercise.notes ? <Text style={{ color: theme.colors.text }}>{exercise.notes}</Text> : null}
      <Button label={`View ${exercise.exerciseName} form guide`} variant="ghost" onPress={() => router.push({ pathname: '/exercises/[exerciseId]', params: { exerciseId: exercise.exerciseId } })} />
    </View></Card>)}
    {mutation.error && !confirmDelete ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{getErrorMessage(mutation.error)}</Text> : null}
    {isOwner ? <Button label="Edit workout" disabled={offline || mutation.isBusy} onPress={() => router.push({ pathname: '/workouts/edit/[workoutId]', params: { workoutId: workout.id } })} /> : null}
    <Button label="Duplicate workout" variant="secondary" loading={mutation.isBusy && !confirmDelete} disabled={offline || mutation.isBusy} onPress={() => void duplicate()} />
    {isOwner ? <Button label="Delete workout" variant="danger" disabled={offline || mutation.isBusy} onPress={() => { mutation.reset(); setConfirmDelete(true); }} /> : null}
    {confirmDelete ? <DeleteWorkoutDialog name={workout.name} busy={mutation.isBusy} error={mutation.error ? getErrorMessage(mutation.error) : null} onConfirm={() => void deleteWorkout()} onCancel={() => setConfirmDelete(false)} /> : null}
  </Screen>;
}
