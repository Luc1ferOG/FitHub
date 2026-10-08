import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { LoadingIndicator } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { UserCard } from '../components/user-card';
import { SocialListFeedback } from '../components/social-list-feedback';
import { useFriendList } from '../hooks/use-social';
import type { FriendListKind } from '../types/social';

function FriendList({ kind, header }: { kind: FriendListKind; header?: ReactNode }) {
  const router = useRouter(); const theme = useAppTheme(); const query = useFriendList(kind);
  const openProfile = useCallback((id: string) => router.push({ pathname: '/user/[id]', params: { id } }), [router]);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const renderItem = useCallback(({ item }: { item: typeof items[number] }) => <UserCard profile={item.profile} onPress={openProfile} />, [openProfile]);
  return <FlatList data={items} keyExtractor={(item) => item.friendship.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, flexGrow: 1 }}
    renderItem={renderItem}
    ListHeaderComponent={<View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>{header}{kind !== 'friends' ? <Text style={{ color: theme.colors.textMuted }}>Open a profile to {kind === 'incoming' ? 'accept or reject a request' : 'view or cancel a request'}.</Text> : null}</View>}
    ListEmptyComponent={<SocialListFeedback loading={query.isPending} error={query.error} title={kind === 'friends' ? 'Find your fitness community' : 'No pending requests'} description={kind === 'friends' ? 'Search for people and send your first request.' : 'New requests will appear here.'} retry={() => { void query.refetch(); }} />}
    ListFooterComponent={query.isFetchingNextPage ? <LoadingIndicator /> : items.length > 0 && query.isError ? <SocialListFeedback loading={false} error={query.error} title="" description="" retry={() => { void query.fetchNextPage(); }} /> : null}
    refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch(); }}
    onEndReachedThreshold={0.4} onEndReached={() => { if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage(); }} initialNumToRender={10} maxToRenderPerBatch={8} windowSize={7} />;
}
export function FriendsScreen() {
  const router = useRouter(); const theme = useAppTheme();
  return <Screen scroll={false} contentStyle={{ flex: 1, gap: 12 }}><FriendList kind="friends" header={<View style={{ gap: theme.spacing.md }}><Text style={[theme.typography.heading, { color: theme.colors.text }]}>Friends</Text>
    <Button label="Friends leaderboard" variant="secondary" onPress={() => router.push('/friends/leaderboard')} /><Button label="Find people" onPress={() => router.push('/friends/search')} /><Button label="Pending requests" variant="secondary" onPress={() => router.push('/friends/requests')} /></View>} /></Screen>;
}
export function FriendRequestsScreen() {
  const [kind, setKind] = useState<'incoming' | 'outgoing'>('incoming'); const theme = useAppTheme();
  return <Screen scroll={false} contentStyle={{ flex: 1, gap: 12 }}><FriendList key={kind} kind={kind} header={<View style={{ gap: theme.spacing.md }}><Text style={[theme.typography.heading, { color: theme.colors.text }]}>Friend requests</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Button label="Incoming" accessibilityState={{ selected: kind === 'incoming' }} variant={kind === 'incoming' ? 'primary' : 'secondary'} onPress={() => setKind('incoming')} />
      <Button label="Sent" accessibilityState={{ selected: kind === 'outgoing' }} variant={kind === 'outgoing' ? 'primary' : 'secondary'} onPress={() => setKind('outgoing')} /></View></View>} /></Screen>;
}
