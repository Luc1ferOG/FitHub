import { AppError } from '@/domain/errors/app-error';
import { requireUuid } from '@/validation/uuid';
import type { ChallengeRepository } from '../repositories/challenge-repository';
import type { ChallengeAction, ChallengeInput, RealtimeState } from '../types/fitness-challenge';
import { challengeInputSchema } from '../validation/challenge-schema';
import { targetToStorage } from './challenge-rules';

function requireOffset(offset: number) { if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new AppError('Invalid page.','VALIDATION'); }
export class ChallengeService {
  constructor(private readonly repository: ChallengeRepository, private readonly now: () => Date = () => new Date()) {}
  list(kind: 'discover' | 'invites', offset: number, signal?: AbortSignal) { requireOffset(offset); return this.repository.list(kind,offset,signal); }
  async detail(id: string, offset: number, signal?: AbortSignal) { requireUuid(id); requireOffset(offset); const data = await this.repository.detail(id,offset,signal); if (!data) throw new AppError('Challenge unavailable.','NOT_FOUND'); return data; }
  create(values: ChallengeInput) {
    const input = challengeInputSchema.parse(values);
    if (input.startDate < this.now().toISOString().slice(0,10)) throw new AppError('Start date must be today or later (UTC).','VALIDATION');
    return this.repository.create({ ...input,target:targetToStorage(input.metric,input.target) });
  }
  manage(id: string, action: ChallengeAction, target: string | null = null) { requireUuid(id); if (target) requireUuid(target); if (action === 'invite' && !target) throw new AppError('Choose a friend to invite.','VALIDATION'); return this.repository.manage(id,action,target); }
  subscribe(id: string, changed: () => void, status: (state: RealtimeState) => void) { requireUuid(id); return this.repository.subscribe(id,changed,status); }
}
