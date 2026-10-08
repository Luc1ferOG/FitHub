import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useFocusedRealtime } from '@/hooks/use-focused-realtime';
import { useAuth } from '@/features/auth/context/auth-context';
import { isUuid } from '@/validation/uuid';
import { challengeService } from '../services/challenge-dependencies';
import { challengeKeys } from '../services/challenge-rules';
import type { ChallengeAction, ChallengeInput, RealtimeState } from '../types/fitness-challenge';
import { writeInvalidationKeys } from '@/services/query/write-invalidation';

export function useChallenges(kind: 'discover' | 'invites') {
  const { user } = useAuth();
  return useInfiniteQuery({ queryKey:challengeKeys.list(user?.id ?? '',kind),enabled:Boolean(user),initialPageParam:0,staleTime:30000,
    queryFn:({ pageParam,signal }) => challengeService.list(kind,pageParam,signal),getNextPageParam:(page) => page.nextOffset ?? undefined });
}
export function useChallenge(id: string) {
  const { user } = useAuth();
  return useInfiniteQuery({ queryKey:challengeKeys.detail(user?.id ?? '',id),enabled:Boolean(user && isUuid(id)),initialPageParam:0,staleTime:10000,maxPages:1,
    queryFn:({ pageParam,signal }) => challengeService.detail(id,pageParam,signal),getNextPageParam:(page) => page.nextOffset ?? undefined });
}
export function useChallengeRealtime(id: string) {
  const { user } = useAuth(); const owner = user?.id ?? ''; const client = useQueryClient(); const [state,setState] = useState<RealtimeState>('connecting');
  const subscribe = useCallback((changed:()=>void)=>challengeService.subscribe(id,changed,setState),[id]);
  const refresh = useCallback(async()=> { await client.invalidateQueries({ queryKey:challengeKeys.detail(owner,id),exact:true },{ cancelRefetch:false }); },[client,id,owner]);
  useFocusedRealtime(isUuid(owner) && isUuid(id),subscribe,refresh);
  return state;
}
export function useCreateChallenge() {
  const client = useQueryClient(); const { user } = useAuth(); const owner = user?.id ?? '';
  return useMutation({ retry:false,mutationFn:(input: ChallengeInput) => challengeService.create(input),
    onSuccess:() => Promise.all([['challenges', owner], ...writeInvalidationKeys('challenge', owner)]
      .map((queryKey) => client.invalidateQueries({ queryKey }))) });
}
export function useChallengeAction(id: string) {
  const client = useQueryClient(); const { user } = useAuth();
  return useMutation({ retry:false,scope:{ id:`challenge:${user?.id ?? ''}:${id}` },mutationFn:({ action,target }: { action: ChallengeAction; target?: string }) => challengeService.manage(id,action,target ?? null),
    onSettled:() => Promise.all([['challenges', user?.id ?? ''], ...writeInvalidationKeys('challenge', user?.id ?? '')]
      .map((queryKey) => client.invalidateQueries({ queryKey }))) });
}
