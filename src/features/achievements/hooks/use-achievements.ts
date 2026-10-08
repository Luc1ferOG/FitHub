import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/auth-context';
import { achievementService } from '../services/achievement-dependencies';
export { achievementService } from '../services/achievement-dependencies';
export const achievementKeys = { board: (owner: string) => ['achievements', owner, 'board'] as const };
export function useAchievements() {
  const { user } = useAuth(); const owner = user?.id ?? '';
  return useQuery({ queryKey: achievementKeys.board(owner), queryFn: ({ signal }) => achievementService.list(owner, signal),
    enabled: Boolean(owner), staleTime: 30_000, meta: { persist: false } });
}
