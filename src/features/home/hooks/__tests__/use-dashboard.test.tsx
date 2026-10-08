import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useDashboard } from '../use-dashboard';
import { DashboardService } from '../../services/dashboard-service';
import type { HomeDashboard } from '../../types/dashboard';

jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('@/store/app-store', () => ({ useAppStore: (select: (state: { isOffline: boolean }) => unknown) => select({ isOffline: false }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]) }));
jest.mock('@/data/repositories/supabase/supabase-dashboard-repository', () => ({ SupabaseDashboardRepository: jest.fn() }));
const data: HomeDashboard = { generatedAt: '2026-10-07T10:00:00Z', localDay: '2026-10-07', profile: null,
  today: { workouts: 0 }, week: { workouts: 0, durationSeconds: 0, volumeKg: 0 }, activeChallengeCount: 0,
  templates: [], challenges: [], latestAchievement: null, activity: [] };

it('deduplicates mount/focus and ignores refreshed auth object identity', async () => {
  jest.replaceProperty(AppState, 'currentState', 'active');
  const load = jest.spyOn(DashboardService.prototype, 'load').mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(() => useDashboard(), { wrapper: Wrapper });
  try {
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { hook.rerender(); });
    expect(load).toHaveBeenCalledTimes(1);
  } finally { hook.unmount(); client.clear(); load.mockRestore(); jest.restoreAllMocks(); }
});
