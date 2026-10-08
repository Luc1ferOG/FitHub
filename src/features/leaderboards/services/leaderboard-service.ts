import { AppError } from '@/domain/errors/app-error';
import { requireUuid } from '@/validation/uuid';
import type { LeaderboardRepository } from '../repositories/leaderboard-repository';
import type { LeaderboardCursor,LeaderboardScope,RealtimeState } from '../types/leaderboard';
export class LeaderboardService {
  constructor(private readonly repository:LeaderboardRepository) {}
  page(scope:LeaderboardScope,cursor:LeaderboardCursor|null,signal?:AbortSignal) {
    if (scope.kind === 'challenge') requireUuid(scope.challengeId);
    if (cursor) { requireUuid(cursor.userId); if (!Number.isFinite(cursor.value) || cursor.value < 0 || cursor.value > Number.MAX_SAFE_INTEGER || !cursor.version || cursor.version.length > 128 || (scope.kind === 'friends' && !Number.isInteger(cursor.value))) throw new AppError('Invalid leaderboard cursor.','VALIDATION'); }
    return this.repository.page(scope,cursor,signal);
  }
  setSharing(owner:string,enabled:boolean) { requireUuid(owner); return this.repository.setSharing(owner,enabled); }
  subscribe(scope:LeaderboardScope,owner:string,changed:()=>void,status:(value:RealtimeState)=>void) {
    requireUuid(owner); if (scope.kind === 'challenge') requireUuid(scope.challengeId); return this.repository.subscribe(scope,owner,changed,status);
  }
}
