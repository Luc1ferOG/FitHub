import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { useLeaderboardSharing } from '../hooks/use-leaderboard';
export function FriendsSharingControl({ sharing }:{ sharing:boolean }) {
  const theme = useAppTheme(); const mutation = useLeaderboardSharing();
  return <View style={{ gap:8 }}><Text style={{ color:theme.colors.textMuted }}>Only accepted friends who opt in appear here. Your own score is always visible to you. Sharing exposes only your completed-workout count over the last 30 UTC days.</Text>
    <Button label={sharing ? 'Stop sharing my leaderboard score':'Share my score with friends'} variant="secondary" loading={mutation.isPending} onPress={()=>mutation.mutate(!sharing)} />
    {mutation.error ? <Text accessibilityRole="alert" style={{ color:theme.colors.danger }}>{getErrorMessage(mutation.error)}</Text>:null}
  </View>;
}
