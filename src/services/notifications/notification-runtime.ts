import Constants from 'expo-constants';
import type * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export function supportsNotifications(): boolean {
  return Platform.OS !== 'web' && !(
    Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient'
  );
}

/** The package's push exports initialize at import time, even for local-only callers. */
export function getNotifications(): typeof Notifications | null {
  if (!supportsNotifications()) return null;
  // Metro requires a literal synchronous import; keep native initialization behind the guard.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof Notifications;
}
