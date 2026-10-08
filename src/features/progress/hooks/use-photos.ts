import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/features/auth/context/auth-context';
import { photoService } from '../services/photo-dependencies';
import type { PhotoMetadata, PreparedPhoto, ProgressPhoto } from '../types/progress-photo';
import { photoKeys } from '../services/photo-query-keys';
export { photoKeys } from '../services/photo-query-keys';
const privateOptions = { meta: { persist: false } };
export function usePhotos() {
  const { user } = useAuth(); const owner = user?.id ?? '';
  return useInfiniteQuery({ ...privateOptions, queryKey: photoKeys.list(owner), enabled: Boolean(user), initialPageParam: 0,
    staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ pageParam, signal }) => photoService.list(owner, pageParam, signal), getNextPageParam: (page) => page.nextOffset ?? undefined });
}
export function usePhoto(id: string) {
  const { user } = useAuth();
  return useQuery({ ...privateOptions, queryKey: photoKeys.detail(user?.id ?? '', id), enabled: Boolean(user && id), queryFn: ({ signal }) => photoService.get(user?.id ?? '', id, signal) });
}
export function usePhotoImage(photo: ProgressPhoto, thumbnail: boolean) {
  const { user } = useAuth();
  const focused = useIsFocused();
  return useQuery({ ...privateOptions, queryKey: photoKeys.url(user?.id ?? '', photo.id, thumbnail), enabled: Boolean(user && photo.status === 'ready' && focused),
    staleTime: 210000, gcTime: 300000, refetchInterval: focused ? 240000 : false, refetchIntervalInBackground: false, retry: false,
    queryFn: () => photoService.urlForPhoto(user?.id ?? '', photo, thumbnail) });
}
export function usePhotoComparison(first: string, second: string) {
  const { user } = useAuth();
  return useQuery({ ...privateOptions, queryKey: photoKeys.compare(user?.id ?? '', first, second), enabled: Boolean(user && first && second),
    queryFn: ({ signal }) => photoService.compare(user?.id ?? '', first, second, signal) });
}
export function usePhotoMutations() {
  const { user } = useAuth(); const owner = user?.id ?? ''; const client = useQueryClient();
  const refresh = async () => { await client.cancelQueries({ queryKey: photoKeys.root(owner) }); await client.invalidateQueries({ queryKey: photoKeys.root(owner) }); };
  const upload = useMutation({ ...privateOptions, networkMode: 'always', retry: false,
    mutationFn: ({ id, metadata, prepared }: { id: string; metadata: PhotoMetadata; prepared: PreparedPhoto }) => photoService.upload(owner, id, metadata, prepared), onSettled: refresh });
  const remove = useMutation({ ...privateOptions, networkMode: 'always', retry: false, mutationFn: (id: string) => photoService.remove(owner, id),
    onMutate: async (id) => { await client.cancelQueries({ queryKey: photoKeys.root(owner) }); client.removeQueries({ queryKey: [...photoKeys.root(owner), 'url', id] }); },
    onSettled: refresh });
  return { upload, remove };
}
