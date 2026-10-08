import { FlatList, View } from 'react-native';
import { useMemo } from 'react';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, ModalSurface } from '@/components/ui';
import { LoadingIndicator, EmptyState } from '@/components/feedback';
import { useFriendList } from '@/features/social/hooks/use-social';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { useChallengeAction } from '../hooks/use-challenges';
export function InviteFriendsPicker({ challengeId,onClose }: { challengeId:string; onClose:() => void }) {
  const theme = useAppTheme(); const friends = useFriendList('friends'); const action = useChallengeAction(challengeId);
  const items = useMemo(() => friends.data?.pages.flatMap((page) => page.items) ?? [], [friends.data]);
  return <ModalSurface title="Invite friends" onClose={onClose} busy={action.isPending} presentation="sheet" scroll={false} closeLabel="Close invitations">
    {action.error ? <Text accessibilityRole="alert" style={{ color:theme.colors.danger }}>{getErrorMessage(action.error)}</Text> : null}
    {action.isSuccess ? <Text accessibilityLiveRegion="polite" style={{ color:theme.colors.text }}>Invitation saved. Existing members or pending invites are not duplicated.</Text> : null}
    <FlatList data={items} keyExtractor={(item) => item.profile.id} initialNumToRender={10} maxToRenderPerBatch={8} windowSize={7} contentContainerStyle={{ gap:12 }}
      renderItem={({ item }) => <View style={{ gap:8 }}><Text style={{ color:theme.colors.text }}>{item.profile.displayName} · @{item.profile.username}</Text><Button label={`Invite ${item.profile.displayName}`} disabled={action.isPending} onPress={() => action.mutate({ action:'invite',target:item.profile.id })} /></View>}
      ListEmptyComponent={friends.isPending ? <LoadingIndicator /> : <EmptyState title={friends.isError ? 'Could not load friends' : 'No friends to invite'} description={friends.isError ? getErrorMessage(friends.error) : 'Connect with friends before inviting them.'} {...(friends.isError ? { actionLabel:'Retry',onAction:() => { void friends.refetch(); } } : {})} />}
      ListFooterComponent={friends.isFetchingNextPage ? <LoadingIndicator /> : friends.isFetchNextPageError ? <Button label="Retry more friends" onPress={() => { void friends.fetchNextPage(); }} /> : null}
      onEndReached={() => { if (friends.hasNextPage && !friends.isFetching && !friends.isFetchNextPageError) void friends.fetchNextPage(); }} />
  </ModalSurface>;
}
