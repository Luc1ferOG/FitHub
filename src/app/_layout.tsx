import { Redirect, Stack, useSegments, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useAccessibilityPreferences } from '@/hooks/use-accessibility-preferences';
import { useAppTheme } from '@/theme';

import { ErrorBoundary, LoadingIndicator } from '@/components/feedback';
import { OfflineBanner } from '@/components/feedback/offline-banner';
import { AppProviders } from '@/components/providers/app-providers';
import { useAuth } from '@/features/auth/context/auth-context';
import { resolveAuthRoute } from '@/features/auth/services/auth-route-guard';
import { useNavigationIntentStore } from '@/store/navigation-intent-store';
import { intendedDestination } from '@/services/navigation/navigation-intent';
import { parseDestination } from '@/services/navigation/destinations';

export default function RootLayout() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
    </AppProviders>
  );
}

function RootNavigator() {
  const theme = useAppTheme(); const { reduceMotion } = useAccessibilityPreferences();
  const { session, isInitializing } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const navigation = useRootNavigationState();
  const intent = useNavigationIntentStore((state) => state.intent);
  const hydrated = useNavigationIntentStore((state) => state.hydrated);
  // Intent expiry is an authorization-time wall-clock check, not a visual value.
  // eslint-disable-next-line react-hooks/purity
  const destination = intendedDestination(intent, session?.user.id ?? null, Date.now());
  useEffect(() => {
    if (!hydrated || isInitializing) return;
    if (!session && parseDestination(pathname)) {
      // Native links/taps already replace intents explicitly. An incidental
      // pathname/alias change must not erase a notification's recipient scope.
      if (!intent) useNavigationIntentStore.getState().capture(pathname);
    } else if (session && intent && (pathname === destination || intent.recipientId && intent.recipientId !== session.user.id)) {
      useNavigationIntentStore.getState().clear();
    }
  }, [destination, hydrated, intent, isInitializing, pathname, session]);
  const decision = resolveAuthRoute({
    isInitializing: isInitializing || !hydrated,
    isAuthenticated: session !== null,
    firstSegment: segments[0],
    intendedRoute: pathname === destination ? null : destination,
  });

  const blocked = decision.type !== 'allow';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {decision.type === 'redirect' && navigation?.key ? <Redirect href={decision.href} /> : null}
      <View style={{ flex: 1, opacity: blocked ? 0 : 1 }} pointerEvents={blocked ? 'none' : 'auto'} accessibilityElementsHidden={blocked} importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>
      <OfflineBanner />
      <Stack screenOptions={{ headerBackTitle: 'Back', animation: reduceMotion ? 'none' : Platform.OS === 'ios' ? 'default' : 'fade_from_bottom', headerTitleStyle: theme.typography.title, headerTintColor: theme.colors.text, headerStyle: { backgroundColor: theme.colors.surface }, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'Choose new password' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
      </View>
      {blocked ? <View style={StyleSheet.absoluteFill}><LoadingIndicator fullScreen label={decision.type === 'loading' ? 'Restoring your session' : 'Opening your destination'} /></View> : null}
    </View>
  );
}
