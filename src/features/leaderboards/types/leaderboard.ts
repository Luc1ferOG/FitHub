import type { ChallengeMetric } from '@/types/database';
import type { RealtimeState } from '@/features/challenges/types/fitness-challenge';
export type { RealtimeState };
export type LeaderboardScope = { kind:'friends' } | { kind:'challenge'; challengeId:string };
export type RankedUser = { userId:string; displayName:string; username:string; avatarUrl:string|null; value:number; rank:number };
export type LeaderboardCursor = { value:number; userId:string; version:string };
export type LeaderboardPage = {
  title:string; metric:ChallengeMetric; target:number|null; version:string; participantCount:number; sharing:boolean|null;
  me:RankedUser|null; podium:RankedUser[]; entries:RankedUser[]; nextCursor:LeaderboardCursor|null;
};
