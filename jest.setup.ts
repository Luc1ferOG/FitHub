import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import 'react-native-gesture-handler/jestSetup';
import { AppState } from 'react-native';

// The native preset cannot determine a device's foreground state in Node.
Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true, configurable: true });

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-haptics', () => ({
  AndroidHaptics: { Confirm: 'confirm' }, NotificationFeedbackType: { Success: 'success' },
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));
