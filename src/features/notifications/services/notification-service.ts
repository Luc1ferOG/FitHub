export type NotificationPermission = 'denied' | 'granted' | 'undetermined';

export interface NotificationService {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  registerDevice(userId: string): Promise<void>;
  unregisterDevice(userId: string): Promise<void>;
}
