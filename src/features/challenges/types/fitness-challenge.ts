import type { ChallengeMetric, ChallengeStatus, ChallengeVisibility } from '@/types/database';

export type FitnessMetric = Exclude<ChallengeMetric, 'distance_m'>;
export type ChallengeInput = {
  title: string; description: string; metric: FitnessMetric; target: number;
  startDate: string; endDate: string; visibility: ChallengeVisibility; exerciseId: string | null;
};
export type FitnessChallenge = {
  id: string; creatorId: string; title: string; description: string; metric: ChallengeMetric;
  target: number; startDate: string; endDate: string; visibility: ChallengeVisibility;
  status: ChallengeStatus; exerciseId: string | null;
};
export type ChallengeMember = { userId: string; currentValue: number; completed: boolean; rank: number | null; leftAt: string | null };
export type LeaderboardEntry = { userId: string; displayName: string; username: string; avatarUrl: string | null; value: number; rank: number; completed: boolean };
export type ChallengeDetails = {
  challenge: FitnessChallenge; creator: { id: string; displayName: string; username: string };
  exerciseName: string | null; participantCount: number; membership: ChallengeMember | null;
  invited: boolean; leaderboard: LeaderboardEntry[]; nextOffset: number | null;
};
export type ChallengeAction = 'join' | 'leave' | 'accept' | 'decline' | 'invite';
export type ChallengePage = { items: FitnessChallenge[]; nextOffset: number | null };
export type RealtimeState = 'connected' | 'connecting' | 'disconnected';
