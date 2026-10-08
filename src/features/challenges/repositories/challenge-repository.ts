import type { ChallengeAction, ChallengeDetails, ChallengeInput, ChallengePage, RealtimeState } from '../types/fitness-challenge';
export interface ChallengeRepository {
  list(kind: 'discover' | 'invites', offset: number, signal?: AbortSignal): Promise<ChallengePage>;
  detail(id: string, offset: number, signal?: AbortSignal): Promise<ChallengeDetails | null>;
  create(input: ChallengeInput): Promise<string>;
  manage(id: string, action: ChallengeAction, target: string | null): Promise<void>;
  subscribe(id: string, changed: () => void, status: (state: RealtimeState) => void): () => void;
}
