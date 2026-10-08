import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';

import { useAppStore } from '@/store/app-store';
import { useAppTheme } from '@/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { useSessionStore } from '@/features/workouts/state/session-store';
import { useSessionLifecycle } from '@/features/workouts/components/session-lifecycle-provider';

export function OfflineBanner() {
  const isOffline = useAppStore((state) => state.isOffline);
  const theme = useAppTheme();
  const { user } = useAuth();
  const { syncing } = useSessionLifecycle();
  const pending = useSessionStore((state) => state.sessions.filter((session) => session.userId === user?.id && session.submittedAt !== null && session.syncStatus !== 'synced').length);

  if (!user || (!isOffline && !pending)) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
    >
      <Text style={[theme.typography.caption, styles.text, { color: theme.colors.textMuted }]}>
        {isOffline ? 'Offline · ' : ''}{pending ? `${pending} workout${pending === 1 ? '' : 's'} ${syncing ? 'synchronizing' : 'waiting to sync'}` : 'Cached workouts and workout logging are available'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    textAlign: 'center',
  },
});
