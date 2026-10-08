import type { LeaderboardCursor,LeaderboardPage,LeaderboardScope,RealtimeState } from '../types/leaderboard';
export interface LeaderboardRepository {
  page(scope:LeaderboardScope,cursor:LeaderboardCursor|null,signal?:AbortSignal):Promise<LeaderboardPage>;
  setSharing(owner:string,enabled:boolean):Promise<void>;
  subscribe(scope:LeaderboardScope,owner:string,changed:()=>void,status:(value:RealtimeState)=>void):()=>void;
}
