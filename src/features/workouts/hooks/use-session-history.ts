import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/auth-context';
import { sessionRepository } from '../services/session-dependencies';

export const sessionHistoryKey = (userId: string, ids: readonly string[]) => ['workout-history', userId, [...new Set(ids)].sort()] as const;
export function useSessionHistory(ids: readonly string[]) {
  const { user } = useAuth();
  return useQuery({ queryKey: sessionHistoryKey(user?.id ?? '', ids), enabled: Boolean(user) && ids.length > 0,
    queryFn: ({ signal }) => sessionRepository.history(ids, signal), staleTime: 60000 });
}
