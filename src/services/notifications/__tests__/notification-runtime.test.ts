import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotifications } from '../notification-runtime';
import { RestNotifications } from '../rest-notifications';
import { NotificationService } from '../notification-service';
import { listenForNotificationResponses } from '../notification-response-listener';
import { ChallengePushService } from '../challenge-push';

jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'storeClient' } }));
jest.mock('expo-notifications', () => { throw new Error('Unsupported module must not initialize in Expo Go'); });

describe('Android Expo Go notification fallback', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });
  afterEach(() => jest.restoreAllMocks());

  it('does not initialize the native notifications module', () => {
    expect(Constants.executionEnvironment).toBe('storeClient');
    expect(getNotifications()).toBeNull();
    expect(() => new NotificationService().initialize()()).not.toThrow();
    expect(() => listenForNotificationResponses(jest.fn())()).not.toThrow();
  });

  it('keeps rest timer scheduling and permission requests non-blocking', async () => {
    const rest = new RestNotifications();
    await expect(rest.requestPermission()).resolves.toBe(false);
    await expect(rest.reconcile(null)).resolves.toBeUndefined();
    await expect(new NotificationService().configure()).resolves.toBeUndefined();
  });

  it('explains that push opt-in requires a development build without registering', async () => {
    const repository = { register: jest.fn(), unregister: jest.fn() };
    await expect(new ChallengePushService(repository).enable()).rejects.toThrow('development or production build');
    expect(repository.register).not.toHaveBeenCalled();
  });

  it('also avoids importing the native module on web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    expect(getNotifications()).toBeNull();
  });
});
