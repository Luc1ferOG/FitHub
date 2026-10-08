import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook,waitFor } from '@testing-library/react-native';
import type * as ReactModule from 'react';
import { AppState } from 'react-native';
import { useLeaderboard } from '../use-leaderboard';
import { leaderboardService } from '../../services/leaderboard-dependencies';
import { leaderboardKeys } from '../../services/leaderboard-presentation';
import type { LeaderboardPage } from '../../types/leaderboard';
const owner = '93000000-0000-0000-0000-000000000001';
jest.mock('@/features/auth/context/auth-context',()=>({ useAuth:()=>({ user:{ id:'93000000-0000-0000-0000-000000000001' } }) }));
jest.mock('../../services/leaderboard-dependencies',()=>({ leaderboardService:{ page:jest.fn(),subscribe:jest.fn() } }));
jest.mock('expo-router',()=>({ useFocusEffect:(effect:()=>void|(()=>void))=>jest.requireActual<typeof ReactModule>('react').useEffect(effect,[effect]) }));
jest.mock('@/store/app-store',()=>({ useAppStore:(select:(state:{ isOffline:boolean })=>unknown)=>select({ isOffline:false }) }));
const page:LeaderboardPage = { title:'Friends',version:'1',metric:'workout_count',target:null,participantCount:1,sharing:false,me:null,podium:[],entries:[],nextCursor:null };
it('refresh discards old cursor chains and realtime unsubscribes on unmount',async()=> {
  jest.replaceProperty(AppState,'currentState','active');
  const client = new QueryClient({ defaultOptions:{ queries:{ retry:false } } }); const cleanup = jest.fn();
  jest.mocked(leaderboardService.subscribe).mockReturnValue(cleanup); jest.mocked(leaderboardService.page).mockResolvedValue(page);
  const key = leaderboardKeys.board(owner,'friends','');
  client.setQueryData(key,{ pages:[page,page,page],pageParams:[null,{ value:3,userId:owner,version:'old' },{ value:1,userId:owner,version:'old' }] });
  function Wrapper({ children }:ReactModule.PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(()=>useLeaderboard({ kind:'friends' }),{ wrapper:Wrapper });
  await act(async()=> { await hook.result.current.refresh(); });
  await waitFor(()=>expect(hook.result.current.data?.pages).toHaveLength(1));
  expect(leaderboardService.page).toHaveBeenLastCalledWith({ kind:'friends' },null,expect.any(AbortSignal));
  hook.unmount(); expect(cleanup).toHaveBeenCalledTimes(1); client.clear();
});
