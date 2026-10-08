import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { Button, SwipeAction } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { useWorkouts } from '../hooks/use-workouts';
import { WorkoutCard } from '../components/workout-card';
import { ResumeWorkoutCard } from '../components/resume-workout-card';

export function WorkoutsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [offset, setOffset] = useState(0);
  const query = useWorkouts(offset);
  const select = useCallback((id: string) => router.push({ pathname: '/workouts/[workoutId]', params: { workoutId: id } }), [router]);
  return <Screen contentStyle={{ flex: 1, gap: 16 }}>
    <FlatList ListHeaderComponent={<View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}><ResumeWorkoutCard />
    <Button label="Create workout" onPress={() => router.push('/workouts/create')} />
    {query.fetchStatus === 'paused' ? <Text style={{ color: theme.colors.textMuted }}>Waiting for a connection. Cached workouts remain available.</Text> : null}
    {query.isError && query.data ? <Button label="Refresh failed. Retry" variant="ghost" onPress={() => void query.refetch()} /> : null}</View>} data={query.data?.items ?? []} keyExtractor={(item) => item.id}
      renderItem={({ item }) => <SwipeAction label={`Edit ${item.name}`} onAction={() => router.push({ pathname: '/workouts/edit/[workoutId]', params: { workoutId: item.id } })}><WorkoutCard workout={item} onSelect={select} /></SwipeAction>}
      initialNumToRender={6} windowSize={7} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshing={query.isRefetching} onRefresh={() => void query.refetch()}
      ListEmptyComponent={query.isPending ? <LoadingIndicator label="Loading workouts" /> : query.isError ? <EmptyState title="Could not load workouts" description="Check your connection and try again." actionLabel="Retry" onAction={() => void query.refetch()} /> : <EmptyState title={offset ? 'No more workouts' : 'Your workouts start here'} description="Create a personalized workout with exercises from the library." actionLabel={offset ? 'Back to first page' : 'Create workout'} onAction={() => offset ? setOffset(0) : router.push('/workouts/create')} />} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
      <Button label="Previous workouts" variant="secondary" disabled={offset === 0 || query.isFetching} onPress={() => setOffset(Math.max(0, offset - 20))} />
      <Button label="Next workouts" variant="secondary" disabled={query.data?.nextOffset == null || query.isFetching} onPress={() => { if (query.data?.nextOffset != null) setOffset(query.data.nextOffset); }} />
    </View>
  </Screen>;
}
