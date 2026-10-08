import { useInfiniteQuery,useMutation,useQueryClient,type InfiniteData } from '@tanstack/react-query';
import { useCallback,useEffect,useMemo,useState } from 'react';
import { useFocusedRealtime } from '@/hooks/use-focused-realtime';
import { AppError } from '@/domain/errors/app-error';
import { useAuth } from '@/features/auth/context/auth-context';
import { isUuid } from '@/validation/uuid';
import { challengeKeys } from '@/features/challenges/services/challenge-rules';
import { leaderboardService } from '../services/leaderboard-dependencies';
import { firstLeaderboardPage,leaderboardKeys } from '../services/leaderboard-presentation';
import type { LeaderboardCursor,LeaderboardPage,LeaderboardScope,RealtimeState } from '../types/leaderboard';
export function useLeaderboard(scope:LeaderboardScope) {
  const { user } = useAuth(); const owner = user?.id ?? ''; const kind = scope.kind; const id = scope.kind === 'challenge' ? scope.challengeId:'';
  const client = useQueryClient(); const key = useMemo(()=>leaderboardKeys.board(owner,kind,id),[owner,kind,id]);
  const stableScope = useMemo<LeaderboardScope>(()=>kind === 'friends' ? { kind }:{ kind,challengeId:id },[kind,id]);
  const [realtime,setRealtime] = useState<RealtimeState>('connecting');
  const query = useInfiniteQuery({ queryKey:key,enabled:Boolean(user) && (kind === 'friends' || isUuid(id)),initialPageParam:null as LeaderboardCursor|null,
    staleTime:30000,gcTime:10 * 60_000,meta:{ persist:false },refetchOnWindowFocus:false,refetchOnReconnect:false,
    retry:(count,error)=>!(error instanceof AppError && error.code === 'CONFLICT') && count < 2,
    queryFn:({ pageParam,signal })=>leaderboardService.page(stableScope,pageParam,signal),getNextPageParam:(page)=>page.nextCursor ?? undefined });
  const refresh = useCallback(async()=> {
    const data = client.getQueryData<InfiniteData<LeaderboardPage,LeaderboardCursor|null>>(key);
    // Cancel only when discarding a cursor chain, not the initial/one-page fetch.
    if (data && (data.pages.length > 1 || data.pageParams[0] !== null)) {
      await client.cancelQueries({ queryKey:key,exact:true });
      client.setQueryData<InfiniteData<LeaderboardPage,LeaderboardCursor|null>>(key,(current)=>firstLeaderboardPage(current));
    }
    await client.invalidateQueries({ queryKey:key,exact:true },{ cancelRefetch:false });
    if (kind === 'challenge') await client.invalidateQueries({ queryKey:challengeKeys.detail(owner,id),exact:true },{ cancelRefetch:false });
  },[client,id,key,kind,owner]);
  const subscribe = useCallback((changed:()=>void)=>leaderboardService.subscribe(stableScope,owner,changed,setRealtime),[owner,stableScope]);
  const schedule = useFocusedRealtime(isUuid(owner) && (kind === 'friends' || isUuid(id)),subscribe,refresh);
  useEffect(()=> { if (query.error instanceof AppError && query.error.code === 'CONFLICT') schedule(); },[query.error,schedule]);
  return { ...query,realtime,refresh };
}
export function useLeaderboardSharing() {
  const { user } = useAuth(); const client = useQueryClient();
  return useMutation({ retry:false,mutationFn:(enabled:boolean)=>leaderboardService.setSharing(user?.id ?? '',enabled),
    onSettled:()=>client.invalidateQueries({ queryKey:['leaderboards', user?.id ?? ''] }) });
}
