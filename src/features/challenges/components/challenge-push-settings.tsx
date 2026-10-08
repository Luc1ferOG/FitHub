import { View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { getErrorMessage } from '@/utils/errors';
import { useChallengePush } from '../hooks/use-challenge-push';
export function ChallengePushSettings() {
  const mutation = useChallengePush(); const theme = useAppTheme();
  return <View style={{ gap:12 }}><Text accessibilityRole="header" style={[theme.typography.title,{ color:theme.colors.text }]}>Push notifications</Text>
    <Text style={{ color:theme.colors.textMuted }}>Opt in to friend requests, challenge updates and achievement alerts on this device. In-app notifications are recorded regardless of push permission.</Text>
    <Button label="Enable push alerts" disabled={mutation.isPending} onPress={() => mutation.mutate(true)} />
    <Button label="Disable push alerts" variant="secondary" disabled={mutation.isPending} onPress={() => mutation.mutate(false)} />
    {mutation.isSuccess ? <Text accessibilityLiveRegion="polite" style={{ color:theme.colors.text }}>Notification preference saved.</Text> : null}
    {mutation.error ? <Text accessibilityRole="alert" style={{ color:theme.colors.danger }}>{getErrorMessage(mutation.error)}</Text> : null}
  </View>;
}
