import { Platform } from 'react-native';
import { getNotifications } from './notification-runtime';

const PREFIX = 'fithub-rest-';
export class RestNotifications {
  async requestPermission(): Promise<boolean> {
    const Notifications = getNotifications();
    if (!Notifications) return false;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('workout-rest', {
      name: 'Workout rest timers', importance: Notifications.AndroidImportance.HIGH, sound: 'default',
    });
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  }
  async reconcile(rest: { id: string; name: string; endsAt: number; enabled: boolean; userId?: string | null } | null): Promise<void> {
    const Notifications = getNotifications();
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((item) => item.identifier.startsWith(PREFIX)).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    if (!rest || !rest.enabled || rest.endsAt <= Date.now()) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('workout-rest', { name: 'Workout rest timers', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
    await Notifications.scheduleNotificationAsync({ identifier: `${PREFIX}${rest.id}`, content: {
      title: 'Rest complete', body: `Ready for your next set in ${rest.name}?`, sound: 'default', categoryIdentifier: 'rest_timer_completed', data: { kind: 'workout-rest', sessionId: rest.id, userId: rest.userId ?? null },
    }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(rest.endsAt), channelId: 'workout-rest' } });
  }
}
