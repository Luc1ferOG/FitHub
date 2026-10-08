import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotifications } from './notification-runtime';
import { AppError } from '@/domain/errors/app-error';
import type { PushDeviceRepository } from './push-device-repository';

const TOKEN_KEY = 'fithub:challenge-push-token';
export class ChallengePushService {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly repository: PushDeviceRepository) {}
  private serialize(operation: () => Promise<void>): Promise<void> {
    const next = this.queue.catch(() => undefined).then(operation);
    this.queue = next; return next;
  }
  enable(): Promise<void> { return this.serialize(() => this.enableDevice()); }
  disable(): Promise<void> { return this.serialize(() => this.disableDevice()); }
  // Explicit opt-in only; requesting push permission is not a login side effect.
  private async enableDevice(): Promise<void> {
    if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') throw new AppError('Push notifications require a native development or production build.','VALIDATION');
    const Notifications = getNotifications();
    if (!Notifications) throw new AppError('Notifications are unavailable on this device.', 'VALIDATION');
    const projectId = Constants.easConfig?.projectId;
    if (!projectId) throw new AppError('Configure the EAS project ID before enabling push notifications.','VALIDATION');
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('challenges',{ name:'Fitness challenges',importance:Notifications.AndroidImportance.DEFAULT });
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && !(await Notifications.requestPermissionsAsync()).granted) throw new AppError('Notification permission was denied. Enable it in device settings.','VALIDATION');
    const { data:token } = await Notifications.getExpoPushTokenAsync({ projectId });
    // Keep a pending token if registration response/storage acknowledgement is interrupted.
    await AsyncStorage.setItem(TOKEN_KEY,token);
    await this.repository.register(token);
  }
  private async disableDevice(): Promise<void> {
    const token = await AsyncStorage.getItem(TOKEN_KEY); if (!token) return;
    await this.repository.unregister(token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}
