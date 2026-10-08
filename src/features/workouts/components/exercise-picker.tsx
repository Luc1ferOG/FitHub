import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Input, ModalSurface } from '@/components/ui';
import { EmptyState, LoadingIndicator } from '@/components/feedback';
import { ExerciseCard } from '@/features/exercises/components/exercise-card';
import { useExercises } from '@/features/exercises/hooks/use-exercises';
import { DEFAULT_EXERCISE_FILTERS } from '@/features/exercises/services/exercise-service';
import type { ExerciseSummary } from '@/features/exercises/types/exercise';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export function ExercisePicker({ onSelect, onClose }: { onSelect: (exercise: ExerciseSummary) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const query = useExercises({ ...DEFAULT_EXERCISE_FILTERS, search: debouncedSearch });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  return <ModalSurface title="Add exercise" onClose={onClose} presentation="sheet" scroll={false} closeLabel="Close exercise picker">
      <Input label="Find an exercise to add" value={search} onChangeText={setSearch} maxLength={100} />
      <FlatList data={items} keyExtractor={(item) => item.id} initialNumToRender={6} windowSize={7}
        keyboardShouldPersistTaps="handled" ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <ExerciseCard exercise={item} accessibilityHint="Adds this exercise to your workout" onSelect={() => onSelect(item)} />}
        onEndReached={() => { if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage(); }}
        ListEmptyComponent={query.isPending ? <LoadingIndicator label="Loading exercises" /> : query.isError ? <EmptyState title="Could not load exercises" description="Check your connection and try again." actionLabel="Retry" onAction={() => void query.refetch()} /> : <EmptyState title="No matching exercises" description="Try another search." />}
        ListFooterComponent={query.isFetchingNextPage ? <LoadingIndicator label="Loading more exercises" /> : query.isFetchNextPageError ? <Button label="Retry more exercises" onPress={() => void query.fetchNextPage()} /> : null} />
  </ModalSurface>;
}
