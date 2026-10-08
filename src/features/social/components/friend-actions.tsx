import { Alert, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/context/auth-context';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { useFriendMutation, useFriendRelation } from '../hooks/use-social';
import { friendState } from '../services/friend-state';
import type { FriendAction } from '../types/social';

export function FriendActions({ target }: { target: string }) {
  const { user } = useAuth(); const theme = useAppTheme(); const relation = useFriendRelation(target); const mutation = useFriendMutation(target);
  if (!user || user.id === target) return null;
  if (relation.isPending) return <Text style={{ color: theme.colors.textMuted }}>Loading friend status…</Text>;
  if (relation.isError) return <View><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{getErrorMessage(relation.error)}</Text><Button label="Retry friend status" onPress={() => { void relation.refetch(); }} /></View>;
  const state = friendState(user.id, target, relation.data ?? null);
  const perform = (action: FriendAction) => mutation.mutate({ action, relation: relation.data ?? null });
  return <View style={{ gap: 8 }}>
    {state === 'none' ? <Button label="Add Friend" loading={mutation.isPending} onPress={() => perform('send')} /> : null}
    {state === 'outgoing' ? <><Button label="Request Sent" disabled /><Button label="Cancel Request" variant="ghost" loading={mutation.isPending} onPress={() => perform('cancel')} /></> : null}
    {state === 'incoming' ? <><Button label="Accept" disabled={mutation.isPending} onPress={() => perform('accept')} /><Button label="Reject" variant="secondary" disabled={mutation.isPending} onPress={() => perform('reject')} /></> : null}
    {state === 'friends' ? <><Text accessibilityLabel="You are friends" style={{ color: theme.colors.text }}>Friends</Text><Button label="Remove Friend" variant="danger" disabled={mutation.isPending} onPress={() => Alert.alert('Remove friend?', 'You can send a new request later.', [{ text: 'Keep friend', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => perform('remove') }])} /></> : null}
    {mutation.isPending ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>Updating friendship…</Text> : null}
    {mutation.error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{getErrorMessage(mutation.error)}</Text> : null}
  </View>;
}
