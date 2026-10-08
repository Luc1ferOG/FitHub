import NetInfo from '@react-native-community/netinfo';
import { defaultShouldDehydrateQuery, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type PropsWithChildren, useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { queryClient, queryPersister } from '@/lib/query-client';
import { useAppStore } from '@/store/app-store';
import { startQueryPerformanceMonitoring } from '@/services/performance/query-performance';
import { shouldPersistMutation } from '@/services/query/persistence-policy';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export function QueryProvider({ children }: PropsWithChildren) {
  const setIsOffline = useAppStore((state) => state.setIsOffline);

  useEffect(() => {
    const stopMonitoring = __DEV__ ? startQueryPerformanceMonitoring(queryClient) : () => {};
    if (AppState.currentState) onAppStateChange(AppState.currentState);
    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);
    const networkSubscription = NetInfo.addEventListener((networkState) => {
      const isOnline = networkState.isConnected === true && networkState.isInternetReachable === true;
      onlineManager.setOnline(isOnline);
      setIsOffline(!isOnline);
    });

    return () => {
      stopMonitoring();
      appStateSubscription.remove();
      networkSubscription();
    };
  }, [setIsOffline]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24,
        // Drop pre-audit query snapshots that retained transient search pages.
        // Durable workout/session data lives separately in SQLite.
        buster: 'v3-no-mutation-secrets',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.meta?.['persist'] !== false && defaultShouldDehydrateQuery(query),
          shouldDehydrateMutation: shouldPersistMutation,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
