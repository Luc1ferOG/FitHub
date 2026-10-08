export const achievementEventTypes = ['WorkoutCompleted', 'PersonalRecordCreated', 'FriendAdded', 'ChallengeJoined', 'ChallengeCompleted', 'ChallengeWon'] as const;
export type AchievementEventType = typeof achievementEventTypes[number];
/** An authoritative event hint. Scores/counts are deliberately absent. */
export type AchievementDomainEvent = { type: AchievementEventType; userId: string; eventId: string; sourceId: string; occurredAt: string };
