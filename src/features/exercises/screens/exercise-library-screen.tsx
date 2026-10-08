import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { Screen } from '@/components/layout/screen';
import { Button, Input } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAppTheme } from '@/theme';

import { ExerciseCard } from '../components/exercise-card';
import { ExerciseFiltersPanel, type ExerciseFilterChange } from '../components/exercise-filters';
import { ExerciseSkeleton } from '../components/exercise-skeleton';
import { useExerciseFilterOptions, useExercises } from '../hooks/use-exercises';
import { DEFAULT_EXERCISE_FILTERS, normalizeExerciseFilters } from '../services/exercise-service';
import type { ExerciseFilters, ExerciseSummary } from '../types/exercise';

const keyExtractor = (exercise: ExerciseSummary) => exercise.id;
function Separator() { return <View style={styles.separator} />; }

export function ExerciseLibraryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [filters, setFilters] = useState<ExerciseFilters>(DEFAULT_EXERCISE_FILTERS);
  const search = useDebouncedValue(filters.search, 300);
  const queryFilters = useMemo(() => ({ ...filters, search }), [filters, search]);
  const exercises = useExercises(queryFilters);
  const options = useExerciseFilterOptions();
  const items = useMemo(() => exercises.data?.pages.flatMap((page) => page.items) ?? [], [exercises.data]);
  const isDebouncing = normalizeExerciseFilters(filters).search !== normalizeExerciseFilters(queryFilters).search;
  const reset = useCallback(() => setFilters(DEFAULT_EXERCISE_FILTERS), []);
  const select = useCallback((id: string) => router.push({ pathname: '/exercises/[exerciseId]', params: { exerciseId: id } }), [router]);
  const renderItem: ListRenderItem<ExerciseSummary> = useCallback(({ item }) => (
    <ExerciseCard exercise={item} onSelect={select} />
  ), [select]);
  const changeFilter = useCallback<ExerciseFilterChange>((field, value) => {
    if (field === 'difficulty') {
      if (value === null || value === 'beginner' || value === 'intermediate' || value === 'advanced') {
        setFilters((previous) => ({ ...previous, difficulty: value }));
      }
      return;
    }
    setFilters((previous) => ({ ...previous, [field]: value }));
  }, []);
  const loadNextPage = () => {
    if (exercises.hasNextPage && !exercises.isFetching && !exercises.isFetchNextPageError && !isDebouncing) {
      void exercises.fetchNextPage();
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <Stack.Screen options={{ title: 'Exercise library' }} />
      <FlatList
        ListHeaderComponent={<View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
<Input label="Search exercises" placeholder="Search by exercise name" value={filters.search} maxLength={100}
        autoCorrect={false} returnKeyType="search" onChangeText={(value) => setFilters((previous) => ({ ...previous, search: value }))} />
      <ExerciseFiltersPanel filters={filters} options={options.data} onChange={changeFilter} />
      {options.isError ? <Button label="Retry loading filters" variant="ghost" onPress={() => void options.refetch()} /> : null}
      {exercises.isError && items.length > 0 && !exercises.isFetchNextPageError ? (
        <Button label="Refresh failed. Tap to retry" variant="ghost" onPress={() => void exercises.refetch()} />
      ) : null}
      {exercises.fetchStatus === 'paused' ? (
        <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Waiting for a connection. Previously loaded exercises remain available.
        </Text>
      ) : null}
      <Button label="Clear search and filters" variant="ghost" onPress={reset} />
      {isDebouncing ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>Updating search…</Text> : null}
        </View>}
        style={styles.list}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.4}
        refreshing={exercises.isRefetching && !exercises.isFetchingNextPage}
        onRefresh={() => void exercises.refetch()}
        ListEmptyComponent={isDebouncing || exercises.isPending ? <ExerciseSkeleton /> : exercises.isError ? (
          <EmptyState title="Could not load exercises" description="Check your connection and try again." actionLabel="Retry" onAction={() => void exercises.refetch()} />
        ) : <EmptyState title="No exercises found" description="Try a different search or clear your filters." actionLabel="Clear filters" onAction={reset} />}
        ListFooterComponent={exercises.isFetchingNextPage ? <LoadingIndicator label="Loading more exercises" /> : exercises.isFetchNextPageError ? (
          <EmptyState title="Could not load more exercises" description="Your current results are still available." actionLabel="Retry next page" onAction={() => void exercises.fetchNextPage()} />
        ) : items.length > 0 && !exercises.hasNextPage ? (
          <Text style={[styles.end, theme.typography.caption, { color: theme.colors.textMuted }]}>You’ve reached the end</Text>
        ) : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 12 },
  list: { flex: 1 },
  separator: { height: 12 },
  end: { textAlign: 'center', paddingVertical: 24 },
});
