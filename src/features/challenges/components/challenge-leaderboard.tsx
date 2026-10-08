import { LeaderboardUserRow } from '@/features/leaderboards/components/leaderboard-user-row';
import type { ChallengeMetric } from '@/types/database';
import type { LeaderboardEntry } from '../types/fitness-challenge';
export function LeaderboardRow({ entry,metric,isMe,target = null }: { entry:LeaderboardEntry; metric:ChallengeMetric; isMe:boolean; target?:number|null }) {
  return <LeaderboardUserRow entry={entry} metric={metric} target={target} currentUserId={isMe ? entry.userId:''} />;
}
