import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { measurementKeys, useMeasurementMutations, useMeasurements } from '../use-measurements';
import { measurementService } from '../../services/measurement-dependencies';
import { emptyMeasurementForm, parseMeasurementForm } from '../../services/measurement-rules';
import { photoKeys } from '../../services/photo-query-keys';
const owner = '95000000-0000-0000-0000-000000000001';
const id = '95000000-0000-0000-0000-000000000002';
jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: '95000000-0000-0000-0000-000000000001' } }) }));
jest.mock('../../services/measurement-dependencies', () => ({ measurementService: { save: jest.fn(), remove: jest.fn(), list: jest.fn() } }));
it('successful create/edit/delete invalidates all account progress periods and history, not other accounts', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const input = parseMeasurementForm({ ...emptyMeasurementForm(), weightKg: '80' }, 'metric');
  jest.mocked(measurementService.save).mockResolvedValue({ ...input, id, userId: owner });
  jest.mocked(measurementService.remove).mockResolvedValue(undefined);
  const keys = [measurementKeys.history(owner), measurementKeys.dashboard(owner, 'all'), measurementKeys.dashboard(owner, '30d'), photoKeys.compare(owner, 'first', 'second')];
  for (const key of keys) client.setQueryData(key, {});
  const other = measurementKeys.dashboard('other', 'all'); client.setQueryData(other, {});
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(() => useMeasurementMutations(), { wrapper: Wrapper });
  await act(async () => { await hook.result.current.save.mutateAsync({ input }); });
  await act(async () => { await hook.result.current.save.mutateAsync({ input, id }); });
  await act(async () => { await hook.result.current.remove.mutateAsync(id); });
  expect(measurementService.save).toHaveBeenLastCalledWith(owner, input, id);
  expect(measurementService.remove).toHaveBeenCalledWith(owner, id);
  for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  hook.unmount(); client.clear();
});
it('measurement queries are excluded from disk persistence and page server-side', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(measurementService.list).mockResolvedValue({ entries: [], nextOffset: null });
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(() => useMeasurements(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(measurementService.list).toHaveBeenCalledWith(owner, 0, expect.any(AbortSignal));
  expect(client.getQueryCache().find({ queryKey: measurementKeys.history(owner) })?.meta?.['persist']).toBe(false);
  hook.unmount(); client.clear();
});
