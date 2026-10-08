import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { useDebouncedSearch, useFriendMutation } from '../use-social';
import { socialKeys } from '../../services/friend-state';
import { socialService } from '../../services/social-dependencies';
import type { Friendship } from '../../types/friendship';

jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('../../services/social-dependencies', () => ({ socialService: { change: jest.fn() } }));
const relation: Friendship = { id: 'request', requesterId: 'target', addresseeId: 'owner', status: 'pending', createdAt: 'now' };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const key = socialKeys.relation('owner', 'target'); client.setQueryData(key, relation);
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, key, hook: renderHook(() => useFriendMutation('target'), { wrapper: Wrapper }) };
}
describe('social query lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());
  it('debounces and cancels earlier input timers', () => {
    jest.useFakeTimers();
    const hook = renderHook(({ input }) => useDebouncedSearch(input), { initialProps: { input: 'al' } });
    act(() => jest.advanceTimersByTime(200)); hook.rerender({ input: 'alice' });
    act(() => jest.advanceTimersByTime(200)); expect(hook.result.current).toBe('');
    act(() => jest.advanceTimersByTime(150)); expect(hook.result.current).toBe('alice');
    hook.unmount(); jest.useRealTimers();
  });
  it.each(['accept','reject','cancel','remove'] as const)('rolls back optimistic %s without changing other targets', async (action) => {
    let rejectWrite: (reason: Error) => void = () => undefined;
    jest.mocked(socialService.change).mockImplementation(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    const { client, key, hook } = setup(); const other = socialKeys.relation('owner','other'); client.setQueryData(other, null);
    act(() => hook.result.current.mutate({ action, relation }));
    await waitFor(() => expect(client.getQueryData(key)).not.toEqual(relation));
    await act(async () => rejectWrite(new Error('Network unavailable')));
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(client.getQueryData(key)).toEqual(relation); expect(client.getQueryData(other)).toBeNull();
    hook.unmount(); client.clear();
  });
  it.each(['send','accept','reject','cancel','remove'] as const)('invalidates account lists after %s', async (action) => {
    jest.mocked(socialService.change).mockResolvedValue(null); const { client, hook } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await act(async () => { await hook.result.current.mutateAsync({ action, relation }); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: socialKeys.root('owner') }); hook.unmount(); client.clear();
  });
});
