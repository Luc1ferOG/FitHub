import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui';
import { LoadingIndicator, EmptyState } from '@/components/feedback';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { useChallenges } from '../hooks/use-challenges';
import { ChallengeCard } from '../components/challenge-card';
export function ChallengeListScreen() {
  const [kind,setKind] = useState<'discover'|'invites'>('discover'); const query = useChallenges(kind); const router = useRouter(); const theme = useAppTheme();
  const open = useCallback((id:string) => router.push({ pathname:'/challenges/[challengeId]',params:{ challengeId:id } }),[router]);
  return <Screen scroll={false} contentStyle={{ flex:1,gap:12 }}>    <FlatList ListHeaderComponent={<View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}><Text style={[theme.typography.heading,{ color:theme.colors.text }]}>Fitness challenges</Text><Button label="Create challenge" onPress={() => router.push('/challenges/create')} />
    <View style={{ flexDirection:'row',flexWrap:'wrap',gap:12 }}><Button label="Discover" accessibilityState={{ selected:kind === 'discover' }} variant={kind === 'discover' ? 'primary':'secondary'} onPress={() => setKind('discover')} /><Button label="Invitations" accessibilityState={{ selected:kind === 'invites' }} variant={kind === 'invites' ? 'primary':'secondary'} onPress={() => setKind('invites')} /></View>
</View>} key={kind} data={query.data?.pages.flatMap((page) => page.items) ?? []} keyExtractor={(item) => item.id} contentContainerStyle={{ gap:12,flexGrow:1 }} initialNumToRender={12} windowSize={7}
      renderItem={({ item }) => <ChallengeCard challenge={item} onPress={open} />}
      ListEmptyComponent={query.isPending ? <LoadingIndicator /> : <EmptyState title={query.isError ? 'Could not load challenges' : kind === 'invites' ? 'No pending invitations' : 'Start a fitness challenge'} description={query.isError ? getErrorMessage(query.error) : 'Create a challenge or check back for new ones.'} {...(query.isError ? { actionLabel:'Retry',onAction:() => { void query.refetch(); } } : {})} />}
      refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch(); }}
      ListFooterComponent={query.isFetchingNextPage ? <LoadingIndicator /> : query.isFetchNextPageError ? <Button label="Retry more challenges" onPress={() => { void query.fetchNextPage(); }} /> : null}
      onEndReached={() => { if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage(); }} />
  </Screen>;
}
