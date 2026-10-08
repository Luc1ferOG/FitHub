import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { notificationTarget } from '@/services/navigation/destinations';
import { AppError } from '@/domain/errors/app-error';

export const notificationCategories = ['rest_timer_completed', 'friend_request', 'challenge_invite', 'challenge_ending_soon', 'achievement_unlocked'] as const;
export type NotificationCategory = typeof notificationCategories[number];
export class NotificationService {
  initialize(): () => void {
    if (Platform.OS === 'web') return () => undefined;
    Notifications.setNotificationHandler({ handleNotification: async (notification) => {
      const kind = notification.request.content.data['kind'];
      const visible = (kind !== 'workout-rest' && kind !== 'rest_timer_completed') || AppState.currentState !== 'active';
      return { shouldPlaySound: visible, shouldSetBadge: false, shouldShowBanner: visible, shouldShowList: visible };
    } });
    return () => Notifications.setNotificationHandler(null);
  }
  async configure(): Promise<void> {
    if (Platform.OS === 'web') return;
    await Promise.all(notificationCategories.map((category) => Notifications.setNotificationCategoryAsync(category, [
      { identifier: 'open', buttonTitle: 'Open FitHub', options: { opensAppToForeground: true } },
    ])));
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('challenges', { name: 'FitHub updates', importance: Notifications.AndroidImportance.DEFAULT });
      await Notifications.setNotificationChannelAsync('workout-rest', { name: 'Workout rest timers', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
    }
  }
  async scheduleLocal(category: NotificationCategory, title: string, body: string,
    data: Record<string, string>, at?: Date): Promise<string | null> {
    if (!notificationTarget({ ...data, kind: category })) throw new AppError('Invalid notification destination.', 'VALIDATION');
    if (Platform.OS === 'web' || !(await Notifications.getPermissionsAsync()).granted) return null;
    await this.configure();
    const channelId = category === 'rest_timer_completed' ? 'workout-rest' : 'challenges';
    return Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default', categoryIdentifier: category, data: { ...data, kind: category } },
      trigger: at ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId } : { channelId } });
  }
}
