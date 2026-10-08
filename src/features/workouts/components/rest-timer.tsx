import { Switch, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import { Button, Card } from '@/components/ui';
import { useAppTheme } from '@/theme';
import type { ActiveWorkoutSession, SessionAction } from '../types/workout-session';
import { useSessionLifecycle } from './session-lifecycle-provider';

export function formatDuration(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(value / 60), remaining = value % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}
export function RestTimer({ session, now, onAction }: { session: ActiveWorkoutSession; now: number; onAction: (action: SessionAction) => void }) {
  const theme = useAppTheme();
  const { enableNotifications, notificationError } = useSessionLifecycle();
  const remaining = session.restEndsAt === null ? null : Math.max(0, Math.ceil((session.restEndsAt - now) / 1000));
  return <Card><View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[theme.typography.body, { color: theme.colors.text }]}>Auto-start rest after each set</Text>
      <Switch trackColor={{ false: theme.colors.border, true: theme.colors.primary }} style={{ minHeight: 48, minWidth: 48 }} accessibilityLabel="Automatically start rest timer after completing a set" value={session.autoRest} onValueChange={(value) => onAction({ type: 'auto-rest', value })} />
    </View>
    {remaining !== null ? <>
      <Text accessibilityLabel={`Rest remaining: ${remaining} seconds`} style={[theme.typography.heading, { color: theme.colors.text }]}>Rest {formatDuration(remaining)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Button label="Skip rest" variant="secondary" onPress={() => onAction({ type: 'skip-rest' })} />
        <Button label="+30 seconds" accessibilityLabel="Add thirty seconds to rest timer" variant="secondary" onPress={() => onAction({ type: 'extend-rest', now: Date.now() })} />
      </View>
    </> : <Text style={{ color: theme.colors.textMuted }}>Rest timer ready.</Text>}
    <Button label={session.notifyRest ? 'Disable background rest alerts' : 'Enable background rest alerts'} variant="ghost" onPress={() => {
      if (session.notifyRest) onAction({ type: 'notify-rest', value: false });
      else void enableNotifications().then((allowed) => { if (allowed) onAction({ type: 'notify-rest', value: true }); });
    }} />
    {notificationError ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>{notificationError}</Text> : null}
  </View></Card>;
}
