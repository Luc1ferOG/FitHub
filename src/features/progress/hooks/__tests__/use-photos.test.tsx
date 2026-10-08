import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { photoKeys, usePhotoImage, usePhotoMutations, usePhotos } from '../use-photos';
import type { ProgressPhoto } from '../../types/progress-photo';
import { photoService } from '../../services/photo-dependencies';
jest.mock('@/features/auth/context/auth-context', () => ({ useAuth: () => ({ user: { id: '96000000-0000-0000-0000-000000000001' } }) }));
jest.mock('../../services/photo-dependencies', () => ({ photoService: { list: jest.fn(), remove: jest.fn(), urlForPhoto: jest.fn() } }));
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
const owner = '96000000-0000-0000-0000-000000000001';
it('does not persist photo metadata or failed mutations, and failed deletion refreshes recoverable rows', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.mocked(photoService.list).mockResolvedValue({ entries: [], nextOffset: null });
  jest.mocked(photoService.remove).mockRejectedValue(new Error('Retry deletion'));
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const hook = renderHook(() => ({ list: usePhotos(), mutations: usePhotoMutations() }), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.list.isSuccess).toBe(true));
  expect(client.getQueryCache().find({ queryKey: photoKeys.list(owner) })?.meta?.['persist']).toBe(false);
  await act(async () => { await expect(hook.result.current.mutations.remove.mutateAsync('photo')).rejects.toThrow('Retry deletion'); });
  expect(client.getMutationCache().getAll()[0]?.meta?.['persist']).toBe(false);
  expect(photoService.list).toHaveBeenCalledTimes(2);
  hook.unmount(); client.clear();
});
it('reuses a fresh signed URL after virtualized unmount and does not fetch while blurred', async () => {
  mockFocused = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const photo: ProgressPhoto = { id: 'photo', userId: owner, photoPath: 'full.jpg', thumbnailPath: 'thumb.jpg',
    takenAt: '2026-10-07', pose: 'front', notes: '', status: 'ready', checksum: null };
  jest.mocked(photoService.urlForPhoto).mockResolvedValue('https://example.test/signed');
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  const first = renderHook(() => usePhotoImage(photo, true), { wrapper: Wrapper });
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
  first.unmount();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); // Exercise a real zero-observer gap.
  const second = renderHook(() => usePhotoImage(photo, true), { wrapper: Wrapper });
  expect(second.result.current.data).toBe('https://example.test/signed');
  expect(photoService.urlForPhoto).toHaveBeenCalledTimes(1);
  expect(client.getQueryCache().find({ queryKey: photoKeys.url(owner, photo.id, true) })?.meta?.['persist']).toBe(false);
  second.unmount(); mockFocused = false;
  const hidden = renderHook(() => usePhotoImage({ ...photo, id: 'other' }, true), { wrapper: Wrapper });
  expect(hidden.result.current.fetchStatus).toBe('idle'); expect(photoService.urlForPhoto).toHaveBeenCalledTimes(1);
  hidden.unmount(); client.clear(); mockFocused = true;
});
