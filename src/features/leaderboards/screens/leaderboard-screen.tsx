import { Stack, useRouter } from 'expo-router';
import { useCallback,useMemo } from 'react';
import { FlatList, View, type ListRenderItem } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { EmptyState,LoadingIndicator } from '@/components/feedback';
import { useAuth } from '@/features/auth/context/auth-context';
import { ChallengeSummary } from '@/features/challenges/components/challenge-summary';
import { useChallenge } from '@/features/challenges/hooks/use-challenges';
import { useAppTheme } from '@/theme';
import { getErrorMessage, isUnavailableRecord } from '@/utils/errors';
import { isUuid } from '@/validation/uuid';
import { useLeaderboard } from '../hooks/use-leaderboard';
import type { LeaderboardScope,RankedUser,RealtimeState } from '../types/leaderboard';
import { LeaderboardUserRow } from '../components/leaderboard-user-row';
import { LeaderboardPodium } from '../components/leaderboard-podium';
import { FriendsSharingControl } from '../components/friends-sharing-control';

function ChallengeHeader({ id,realtime }:{ id:string; realtime:RealtimeState }) {
  const query = useChallenge(id); const details = query.data?.pages[0];
  if (isUnavailableRecord(query.error)) return <EmptyState title="Challenge unavailable" description="This challenge was deleted or is no longer available." />;
  if (details) return <ChallengeSummary details={details} realtime={realtime} showLeaderboardHeading={false} />;
  if (query.isPending) return <LoadingIndicator label="Loading challenge details" />;
  return <EmptyState title="Could not load challenge details" description={getErrorMessage(query.error)} actionLabel="Retry details" onAction={()=> { void query.refetch(); }} />;
}
export function LeaderboardScreen({ scope,showDetails = false }:{ scope:LeaderboardScope; showDetails?:boolean }) {
  const router = useRouter();
  const query = useLeaderboard(scope); const { user } = useAuth(); const theme = useAppTheme();
  const page = query.data?.pages[0]; const owner = user?.id ?? ''; const metric = page?.metric ?? 'workout_count'; const target = page?.target ?? null;
  // Server-ranked pages remain scrollable until a refresh resets the cursor chain.
  const entries = useMemo(()=>query.data?.pages.flatMap((item)=>item.entries) ?? [],[query.data]);
  const renderRow = useCallback<ListRenderItem<RankedUser>>(({ item })=><LeaderboardUserRow entry={item} metric={metric} target={target} currentUserId={owner} />,[metric,owner,target]);
  const keyExtractor = useCallback((entry:RankedUser)=>entry.userId,[]);
  if (scope.kind === 'challenge' && !isUuid(scope.challengeId)) return <Screen><EmptyState title={showDetails ? 'Invalid challenge link' : 'Invalid leaderboard link'} description="This challenge identifier is invalid." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  if (isUnavailableRecord(query.error)) return <Screen><EmptyState title="Challenge unavailable" description="This challenge was deleted or is no longer available to your account." actionLabel="Go home" onAction={() => router.replace('/(tabs)/home')} /></Screen>;
  return <Screen scroll={false} contentStyle={{ flex:1 }}><Stack.Screen options={{ title:scope.kind === 'friends' ? 'Friends leaderboard':'Challenge leaderboard' }} />
    <FlatList data={entries} renderItem={renderRow} keyExtractor={keyExtractor} contentContainerStyle={{ gap:12,flexGrow:1 }} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
      ListHeaderComponent={page ? <View style={{ gap:16,marginBottom:12 }}>
        {scope.kind === 'challenge' && showDetails ? <ChallengeHeader id={scope.challengeId} realtime={query.realtime} />:null}
        <Text accessibilityRole="header" style={[theme.typography.heading,{ color:theme.colors.text }]}>{page.title}</Text>
        <Text style={{ color:theme.colors.textMuted }}>{page.participantCount} participants · {page.me ? `Your rank: #${page.me.rank}`:'You are not participating'}</Text>
        <Text accessibilityLiveRegion="polite" style={{ color:theme.colors.textMuted }}>{query.realtime === 'connected' ? 'Live rankings connected':'Live rankings reconnecting; periodic refresh is enabled.'}</Text>
        {scope.kind === 'friends' ? <FriendsSharingControl sharing={page.sharing ?? false} />:null}
        <LeaderboardPodium entries={page.podium} metric={metric} target={target} currentUserId={owner} />
        {page.me ? <View style={{ gap:8 }}><Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Your position</Text><LeaderboardUserRow entry={page.me} metric={metric} target={target} currentUserId={owner} /></View>:null}
        <Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Rankings</Text>
      </View>:null}
      ListEmptyComponent={query.isPending ? <LoadingIndicator label="Loading leaderboard" />:query.isError ? <EmptyState title="Could not load leaderboard" description={getErrorMessage(query.error)} actionLabel="Retry" onAction={()=> { void query.refresh(); }} />:<EmptyState title="No ranked participants" description="Join a challenge or connect with friends to get started." />}
      refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={()=> { void query.refresh(); }}
      ListFooterComponent={query.isFetchingNextPage ? <LoadingIndicator label="Loading rankings" />:query.isError && entries.length > 0 ? <EmptyState title="Could not update rankings" description={getErrorMessage(query.error)} actionLabel="Refresh rankings" onAction={()=> { void query.refresh(); }} />:query.hasNextPage ? <Button label="Load more rankings" variant="secondary" onPress={()=> { if (!query.isFetching) void query.fetchNextPage(); }} />:null}
      onEndReachedThreshold={0.3} onEndReached={()=> { if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage(); }} />
  </Screen>;
}
