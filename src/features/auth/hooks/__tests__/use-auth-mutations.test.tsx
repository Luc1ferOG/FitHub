import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { authService } from '../../services/auth-dependencies';
import { useLoginMutation } from '../use-auth-mutations';

jest.mock('../../services/auth-dependencies', () => ({ authService: { login: jest.fn() } }));
jest.mock('@/services/notifications/challenge-push-dependencies', () => ({ challengePushService: { disable: jest.fn() } }));

it('does not retry a failed login even when the injected client retries other mutations', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 2, retryDelay: 1, gcTime: Infinity } } });
  jest.mocked(authService.login).mockRejectedValue(new Error('Incorrect credentials'));
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useLoginMutation(), { wrapper });
  try {
    act(() => hook.result.current.mutate({ email: 'alex@example.test', password: 'SecurePass42!' }));
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(client.getMutationCache().getAll()[0]?.options.meta?.['persist']).toBe(false);
  } finally { hook.unmount(); client.clear(); }
});
