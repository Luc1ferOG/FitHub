import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/auth-context';
import type { Friendship } from '../types/friendship';
import type { FriendAction, FriendListKind } from '../types/social';
import { socialKeys, optimisticRelation } from '../services/friend-state';
import { socialService } from '../services/social-dependencies';
import { normalizeSearch } from '../services/social-service';
import { isUuid } from '@/validation/uuid';
import { writeInvalidationKeys } from '@/services/query/write-invalidation';

export function useDebouncedSearch(input: string) {
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(normalizeSearch(input)), 350); return () => clearTimeout(timer); }, [input]);
  return search;
}
export function useUserSearch(search: string) {
  const { user } = useAuth();
  return useInfiniteQuery({ queryKey: socialKeys.search(user?.id ?? '', search), initialPageParam: 0,
    enabled: Boolean(user) && search.length >= 2 && search.length <= 80, staleTime: 30000, gcTime: 5 * 60_000,
    meta: { persist: false }, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ pageParam, signal }) => socialService.search(search, pageParam, signal), getNextPageParam: (page) => page.nextOffset ?? undefined });
}
export function useFriendList(kind: FriendListKind) {
  const { user } = useAuth();
  return useInfiniteQuery({ queryKey: socialKeys.list(user?.id ?? '', kind), initialPageParam: 0, enabled: Boolean(user), staleTime: 60000,
    gcTime: 10 * 60_000, meta: { persist: false }, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ pageParam, signal }) => socialService.list(kind, pageParam, signal), getNextPageParam: (page) => page.nextOffset ?? undefined });
}
export function usePublicProfile(target: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: socialKeys.profile(user?.id ?? '', target), enabled: Boolean(user && isUuid(target)), staleTime: 60000,
    queryFn: ({ signal }) => socialService.profile(target, signal) });
}
export function useFriendRelation(target: string) {
  const { user } = useAuth(); const owner = user?.id ?? '';
  return useQuery({ queryKey: socialKeys.relation(owner, target), enabled: Boolean(user && target), staleTime: 10000,
    queryFn: ({ signal }) => socialService.relation(owner, target, signal) });
}
export function useFriendMutation(target: string) {
  const { user } = useAuth(); const owner = user?.id ?? ''; const client = useQueryClient();
  const key = socialKeys.relation(owner, target);
  return useMutation({ mutationKey: socialKeys.write(owner, target), scope: { id: `friend:${owner}:${target}` }, retry: false,
    mutationFn: (command: { action: FriendAction; relation: Friendship | null }) => socialService.change(owner, target, command.action, command.relation),
    onMutate: async ({ action }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Friendship | null>(key);
      const optimistic = client.isMutating({ mutationKey: socialKeys.write(owner, target) }) === 1 && previous !== undefined && action !== 'send';
      if (optimistic) client.setQueryData(key, optimisticRelation(previous ?? null, action));
      return { previous, optimistic };
    },
    onError: (_error, _command, context) => { if (context?.optimistic) client.setQueryData(key, context.previous); },
    onSuccess: (relation) => { if (client.isMutating({ mutationKey: socialKeys.write(owner, target) }) === 1) client.setQueryData(key, relation); },
    onSettled: () => Promise.all([socialKeys.root(owner), ...writeInvalidationKeys('friendship', owner)]
      .map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}
