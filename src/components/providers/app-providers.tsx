import { type PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider } from '@/theme';
import { ErrorBoundary } from '@/components/feedback/error-boundary';
import { AccessibilityPreferencesProvider } from '@/hooks/use-accessibility-preferences';
import { AuthProvider } from '@/features/auth/context/auth-context';
import { SessionLifecycleProvider } from '@/features/workouts/components/session-lifecycle-provider';
import { NotificationLifecycle } from './notification-provider';
import { AchievementLifecycle } from '@/features/achievements/components/achievement-lifecycle';

import { QueryProvider } from './query-provider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AccessibilityPreferencesProvider><AppThemeProvider>
            <ErrorBoundary><AuthProvider><SessionLifecycleProvider><NotificationLifecycle /><AchievementLifecycle />{children}</SessionLifecycleProvider></AuthProvider></ErrorBoundary>
          </AppThemeProvider></AccessibilityPreferencesProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
