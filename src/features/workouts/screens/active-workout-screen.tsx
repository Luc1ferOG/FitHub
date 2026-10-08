import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, ScrollView, View, type ListRenderItem } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { Screen } from '@/components/layout/screen';
import { Button, ProgressBar } from '@/components/ui';
import { useAppStore } from '@/store/app-store';
import { useAppTheme } from '@/theme';
import { ActiveExerciseCard } from '../components/active-exercise-card';
import { RestTimer, formatDuration } from '../components/rest-timer';
import { WorkoutSessionSummary } from '../components/workout-session-summary';
import { useWorkoutSession } from '../hooks/use-workout-session';
import { sessionStore } from '../state/session-store';
import type { SessionExercise } from '../types/workout-session';

export function ActiveWorkoutScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const offline = useAppStore((state) => state.isOffline);
  const { session, hydrated, storageError, error, dispatch, now, totals, records, historyUnavailable } = useWorkoutSession(sessionId);
  const renderItem: ListRenderItem<SessionExercise> = useCallback(({ item }) => <ActiveExerciseCard exercise={item}
    recordIds={item.sets.filter((set) => records.setIds.includes(set.id)).map((set) => set.id).join('|')} onAction={dispatch} />, [dispatch, records.setIds]);
  if (!hydrated) return <Screen>{storageError ? <EmptyState title="Workout restoration needs attention" description={storageError} actionLabel="Retry restoration" onAction={() => sessionStore.getState().restore()} /> : <LoadingIndicator label="Restoring saved workout" />}</Screen>;
  if (!session || !totals) return <Screen><EmptyState title="Workout session unavailable" description="Sign in to the original account on this device to restore your workout." actionLabel="Home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  const completed = totals.totalSets;
  const planned = session.exercises.reduce((count, exercise) => count + exercise.sets.length, 0);
  return <Screen contentStyle={{ flex: 1, gap: 12 }}>
    <Stack.Screen options={{ title: session.name }} />
    {storageError || error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{storageError ?? error}</Text> : null}
    <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{offline ? 'Offline · logging is saved on this device' : 'Logging is saved on this device'}</Text>
    {session.completedAt !== null ? <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><WorkoutSessionSummary session={session} totals={totals} records={records.records} onAction={dispatch} onDone={() => router.replace('/(tabs)/home')} /></ScrollView> : <>
      <FlatList data={session.exercises} renderItem={renderItem} keyExtractor={(item) => item.id} initialNumToRender={2} maxToRenderPerBatch={3} windowSize={5}
        automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 16 }}>
      <Text accessibilityRole="header" style={[theme.typography.heading, { color: theme.colors.text }]}>{session.name}</Text>
      <Text accessibilityLabel={`Workout elapsed ${totals.durationSeconds} seconds`} style={[theme.typography.title, { color: theme.colors.text }]}>{formatDuration(totals.durationSeconds)} · {totals.volume.toFixed(2)} kg·reps</Text>
      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textMuted }}>{completed} / {planned} sets completed</Text>
        <ProgressBar value={planned ? completed / planned * 100 : 0} label="Completed workout sets" description={`${completed} of ${planned} sets completed`} />
      </View>
          <RestTimer session={session} now={now} onAction={dispatch} />
          {historyUnavailable ? <Text style={{ color: theme.colors.textMuted }}>History is unavailable offline. Cached results and logging remain usable.</Text> : null}
        </View>} />
      <Button label="Finish workout and review" onPress={() => dispatch({ type: 'review', now: Date.now() })} />
    </>}
  </Screen>;
}
