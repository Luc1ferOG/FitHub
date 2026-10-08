import { useEffect } from 'react';
import { NotificationService } from '@/services/notifications/notification-service';
import { listenForNotificationResponses } from '@/services/notifications/notification-response-listener';
import { useNavigationIntentStore } from '@/store/navigation-intent-store';

export function NotificationLifecycle() {
  useEffect(() => {
    useNavigationIntentStore.getState().restore();
    const service = new NotificationService();
    const cleanup = service.initialize();
    void service.configure().catch(() => undefined);
    const stop = listenForNotificationResponses(({ path, recipientId }) => useNavigationIntentStore.getState().capture(path, recipientId));
    return () => { stop(); cleanup(); };
  }, []);
  return null;
}
