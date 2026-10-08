import type { NotificationResponse } from 'expo-notifications';
import { getNotifications } from './notification-runtime';
import { notificationTarget, type NotificationTarget } from '@/services/navigation/destinations';

/** One listener for both launch responses and live taps. Never navigate on receipt. */
export function listenForNotificationResponses(open: (target: NotificationTarget) => void): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => undefined;
  let active = true;
  const seen = new Set<string>();
  const receive = (response: NotificationResponse | null) => {
    if (!active || !response || ![Notifications.DEFAULT_ACTION_IDENTIFIER, 'open'].includes(response.actionIdentifier)) return;
    const request = response.notification.request;
    // Rest alerts reuse their identifier across sets; delivery date distinguishes
    // a new alert from the launch/live duplicate of the same response.
    const key = `${request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
    if (seen.has(key)) return;
    const target = notificationTarget(request.content.data);
    if (!target) return;
    seen.add(key);
    if (seen.size > 100) seen.delete(seen.values().next().value ?? '');
    open(target);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(receive);
  void Notifications.getLastNotificationResponseAsync().then(receive).catch(() => undefined);
  return () => { active = false; subscription.remove(); };
}
