export type AchievementCategory = 'consistency' | 'streaks' | 'strength' | 'social' | 'volume';
export type AchievementMetric = 'workout_count' | 'streak_days' | 'personal_records' | 'friend_count' | 'challenges_joined' | 'challenges_completed' | 'challenge_wins' | 'total_volume';
export type Achievement = { id: string; code: string; title: string; description: string; icon: string; category: AchievementCategory;
  metric: AchievementMetric; target: number; current: number; unlockedAt: string | null; presentedAt: string | null; active: boolean };
export type AchievementBoard = { entries: Achievement[] };
