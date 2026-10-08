import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { queryClient, queryPersister } from '@/lib/query-client';
import { useAppStore } from '@/store/app-store';

import { authService, authSessionManager } from '../services/auth-dependencies';
import type { AuthSessionState } from '../services/auth-session-manager';
import type { AuthSession, AuthUser } from '../types/auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isInitializing: boolean;
  restorationError: unknown | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthSessionState = {
  session: null,
  isInitializing: true,
  restorationError: null,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthSessionState>(initialState);
  const previousUserId = useRef<string | null | undefined>(undefined);
  const offline = useAppStore((store) => store.isOffline);

  // Recheck SDK authorization on reconnect; dispose stale restoration promises
  // and let newer SIGNED_OUT/SIGNED_IN events win over restoration.
  useEffect(() => authSessionManager.start(setState), [offline]);

  useEffect(() => {
    const nextUserId = state.session?.user.id ?? null;
    const identityChanged =
      previousUserId.current !== undefined && previousUserId.current !== nextUserId;

    if (identityChanged || (!state.isInitializing && nextUserId === null)) {
      queryClient.clear();
      void queryPersister.removeClient();
    }
    previousUserId.current = nextUserId;
  }, [state.isInitializing, state.session?.user.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const setRefreshForStatus = (status: typeof AppState.currentState) => {
      if (status === 'active') authService.startAutoRefresh();
      else authService.stopAutoRefresh();
    };

    setRefreshForStatus(AppState.currentState);
    const subscription = AppState.addEventListener('change', setRefreshForStatus);
    return () => {
      subscription.remove();
      authService.stopAutoRefresh();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: state.session,
      user: state.session?.user ?? null,
      isInitializing: state.isInitializing,
      restorationError: state.restorationError,
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
