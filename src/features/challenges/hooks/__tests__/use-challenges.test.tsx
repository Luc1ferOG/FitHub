import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook,waitFor } from '@testing-library/react-native';
import type * as ReactModule from 'react';
import { AppState } from 'react-native';
import { useChallengeAction,useChallengeRealtime } from '../use-challenges';
import { challengeService } from '../../services/challenge-dependencies';
import { challengeKeys } from '../../services/challenge-rules';

jest.mock('@/features/auth/context/auth-context',() => ({ useAuth:() => ({ user:{ id:'93000000-0000-0000-0000-000000000001' } }) }));
jest.mock('expo-router',()=>({ useFocusEffect:(effect:()=>void|(()=>void))=>jest.requireActual<typeof ReactModule>('react').useEffect(effect,[effect]) }));
jest.mock('@/store/app-store',()=>({ useAppStore:(select:(state:{ isOffline:boolean })=>unknown)=>select({ isOffline:false }) }));
jest.mock('../../services/challenge-dependencies',() => ({ challengeService:{ manage:jest.fn(),subscribe:jest.fn() } }));
function setup() {
  const client = new QueryClient({ defaultOptions:{ queries:{ retry:false },mutations:{ retry:false, gcTime: Infinity } } });
  function Wrapper({ children }:ReactModule.PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client,Wrapper };
}
describe('challenge hooks',() => {
  beforeEach(() => jest.clearAllMocks());
  it.each(['join','leave','accept','decline','invite'] as const)('invalidates lists and positions after %s',async(action) => {
    jest.mocked(challengeService.manage).mockResolvedValue(undefined); const { client,Wrapper } = setup(); const invalidate = jest.spyOn(client,'invalidateQueries'); const hook = renderHook(() => useChallengeAction('id'),{ wrapper:Wrapper });
    await act(async () => { await hook.result.current.mutateAsync({ action,...(action === 'invite' ? { target:'friend' }: {}) }); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey:[...challengeKeys.root, '93000000-0000-0000-0000-000000000001'] }); hook.unmount(); client.clear();
  });
  it('cleans up realtime and pending debounce timers on unmount',async () => {
    jest.replaceProperty(AppState,'currentState','active');
    const unsubscribe = jest.fn(); jest.mocked(challengeService.subscribe).mockReturnValue(unsubscribe); const { client,Wrapper } = setup();
    const hook = renderHook(() => useChallengeRealtime('72000000-0000-0000-0000-000000000001'),{ wrapper:Wrapper });
    await waitFor(() => expect(challengeService.subscribe).toHaveBeenCalledTimes(1)); hook.unmount(); expect(unsubscribe).toHaveBeenCalledTimes(1); client.clear();
  });
});
