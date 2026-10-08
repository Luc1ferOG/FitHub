import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/feedback';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/context/auth-context';
import { useSessionStore } from '../state/session-store';
import { createSessionHistorySelector, type SessionHistoryItem } from '../services/session-history-selector';
import { SessionHistoryRow } from '../components/session-history-row';

const keyExtractor = (item: SessionHistoryItem) => item.id;
const Separator = () => <View style={{ height: 12 }} />;

export function SessionHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [limit, setLimit] = useState(30);
  const select = useMemo(() => createSessionHistorySelector(user?.id ?? '', limit), [user?.id, limit]);
  const page = useSessionStore((state) => select(state.sessions));
  const open = useCallback((id: string) => router.push({ pathname: '/workouts/active/[sessionId]', params: { sessionId: id } }), [router]);
  const renderItem = useCallback(({ item }: { item: SessionHistoryItem }) => <SessionHistoryRow item={item} onOpen={open} />, [open]);
  return <Screen contentStyle={{ flex: 1 }}>
    <Stack.Screen options={{ title: 'Saved workouts on this device' }} />
    <FlatList data={page.items} keyExtractor={keyExtractor} initialNumToRender={6} maxToRenderPerBatch={8} windowSize={7} ItemSeparatorComponent={Separator}
      ListEmptyComponent={<EmptyState title="No saved workouts yet" description="Start a workout to create your first session." />}
      renderItem={renderItem} ListFooterComponent={page.items.length < page.total ? <Button label="Load more saved workouts" variant="secondary" onPress={() => setLimit((value) => value + 30)} /> : null} />
  </Screen>;
}
