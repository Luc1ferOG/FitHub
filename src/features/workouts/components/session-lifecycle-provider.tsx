import { useQueryClient } from '@tanstack/react-query';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/context/auth-context';
import { RestNotifications } from '@/services/notifications/rest-notifications';
import { useAppStore } from '@/store/app-store';
import { sessionRepository } from '../services/session-dependencies';
import { SessionSyncService } from '../services/session-sync-service';
import { sessionStore, syncQueueRepository, useSessionStore } from '../state/session-store';
import { writeInvalidationKeys } from '@/services/query/write-invalidation';

type Lifecycle = { syncing: boolean; notificationError: string | null; retrySync: () => Promise<void>; enableNotifications: () => Promise<boolean> };
const Context = createContext<Lifecycle | null>(null);

export function SessionLifecycleProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const client = useQueryClient();
  const offline = useAppStore((state) => state.isOffline);
  const sessions = useSessionStore((state) => state.sessions);
  const hydrated = useSessionStore((state) => state.hydrated);
  const [syncing, setSyncing] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const notificationQueue = useRef(Promise.resolve());
  const currentUser = useRef(user?.id);
  useEffect(() => { currentUser.current = user?.id; }, [user?.id]);
  const canSync = useCallback((owner: string) => currentUser.current === owner && !useAppStore.getState().isOffline, []);
  const notifications = useMemo(() => new RestNotifications(), []);
  const worker = useMemo(() => new SessionSyncService(sessionRepository, {
    sessions: () => sessionStore.getState().sessions,
    acknowledge: (id, owner, receipt) => sessionStore.getState().acknowledge(id, owner, receipt),
    fail: (id, owner, message) => sessionStore.getState().fail(id, owner, message),
  }, Date.now, (owner) => {
    for (const queryKey of writeInvalidationKeys('workout-session', owner)) void client.invalidateQueries({ queryKey });
  // The worker stores this authorization callback; its constructor never calls it.
  // eslint-disable-next-line react-hooks/refs
  }, { queue: syncQueueRepository, canSync }), [canSync, client]);
  const run = useCallback(async (force = false) => {
    if (!user || offline || !sessionStore.getState().hydrated) return;
    setSyncing(true);
    try { await worker.sync(user.id, force); } catch { /* Local storage error is surfaced by the store. */ }
    finally { setSyncing(false); }
  }, [offline, user, worker]);
  const pendingKey = sessions.filter((session) => session.userId === user?.id && session.submittedAt !== null && session.syncStatus !== 'synced')
    .map((session) => `${session.id}:${session.syncStatus}`).join('|');
  useEffect(() => { sessionStore.getState().restore(); }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled && hydrated && pendingKey) void run(); });
    return () => { cancelled = true; };
  }, [hydrated, pendingKey, run]);
  useEffect(() => {
    const interval = setInterval(() => { if (AppState.currentState === 'active') void run(); }, 15000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void run(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [run]);
  const active = sessions.find((session) => session.userId === user?.id && session.submittedAt === null);
  const restId = active?.id ?? null, endsAt = active?.restEndsAt ?? null;
  const enabled = active?.notifyRest ?? false, restName = active?.name ?? '';
  useEffect(() => {
    // Serialize cancellation/scheduling so rapid +30/skip actions cannot leave old alerts.
    notificationQueue.current = notificationQueue.current.catch(() => undefined).then(async () => {
      try { await notifications.reconcile(restId && endsAt ? { id: restId, name: restName, endsAt, enabled, userId: active?.userId ?? null } : null); setNotificationError(null); }
      catch { setNotificationError('Rest alerts could not be scheduled. The on-screen timer still works.'); }
    });
  }, [active?.userId, enabled, endsAt, notifications, restId, restName]);
  const enableNotifications = useCallback(async () => {
    try {
      const allowed = await notifications.requestPermission();
      setNotificationError(allowed ? null : 'Rest alerts are unavailable or permission was denied. You can enable notifications in device settings.');
      return allowed;
    } catch { setNotificationError('Could not enable rest alerts. The on-screen timer still works.'); return false; }
  }, [notifications]);
  const retrySync = useCallback(() => run(true), [run]);
  const value = useMemo(() => ({ syncing, notificationError, retrySync, enableNotifications }), [syncing, notificationError, retrySync, enableNotifications]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSessionLifecycle(): Lifecycle {
  const context = useContext(Context);
  if (!context) throw new Error('SessionLifecycleProvider is required');
  return context;
}
