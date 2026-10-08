import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { ForegroundRefresh } from '@/services/realtime/foreground-refresh';
import { useAppStore } from '@/store/app-store';

export function useFocusedRealtime(enabled: boolean,
  subscribe: (changed: () => void) => () => void, refresh: () => Promise<void>) {
  const offline = useAppStore((state) => state.isOffline);
  const lifecycle = useRef<ForegroundRefresh | null>(null);
  useFocusEffect(useCallback(() => {
    if (!enabled || offline) return;
    const current = new ForegroundRefresh(subscribe, refresh);
    lifecycle.current = current;
    current.setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', (state) => current.setActive(state === 'active'));
    return () => { listener.remove(); current.dispose(); lifecycle.current = null; };
  }, [enabled, offline, refresh, subscribe]));
  return useCallback(() => lifecycle.current?.schedule(), []);
}
