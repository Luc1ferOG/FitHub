import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/auth-context';
import { dashboardService as service } from '../services/dashboard-dependencies';
import { dashboardKeys } from '../services/dashboard-rules';
import { dashboardClock } from '../services/dashboard-clock';
import { useAppStore } from '@/store/app-store';
export function useDashboard() {
  const { user } = useAuth();
  const owner = user?.id ?? '';
  const client = useQueryClient();
  const offline = useAppStore((state) => state.isOffline);
  const [clock, setClock] = useState(() => dashboardClock());
  const { now, timezone, day } = clock;
  const query = useQuery({ queryKey: dashboardKeys.snapshot(owner, timezone, day),
    queryFn: ({ signal }) => service.load(timezone, signal), enabled: Boolean(user),
    staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false, meta: { persist: false } });
  useFocusEffect(useCallback(() => {
    const refresh = () => {
      const next = dashboardClock();
      setClock(next);
      // fetchQuery deduplicates the initial observer request, respects staleTime,
      // and uses today's key even when midnight/timezone change creates a key.
      if (owner && !offline) void client.fetchQuery({ queryKey: dashboardKeys.snapshot(owner, next.timezone, next.day),
        queryFn: ({ signal }) => service.load(next.timezone, signal), staleTime: 30_000, gcTime: 5 * 60_000,
        meta: { persist: false } }).catch(() => { /* The query presents errors. */ });
    };
    if (AppState.currentState === 'active') refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 60_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [client, offline, owner]));
  return { ...query, now };
}
