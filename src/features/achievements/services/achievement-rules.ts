import type { Achievement } from '../types/achievement';
export function thresholdReached(current: number, target: number): boolean {
  return Number.isFinite(current) && Number.isFinite(target) && target > 0 && current >= target;
}
export function achievementProgress(achievement: Achievement) {
  const current = Math.max(0, Number.isFinite(achievement.current) ? achievement.current : 0);
  return { current, displayed: Math.min(current, achievement.target), percent: Math.min(100, current / achievement.target * 100) };
}
export function progressLabel(achievement: Achievement): string {
  const progress = achievementProgress(achievement);
  const amount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const unit = achievement.metric === 'total_volume' ? ' kg' : achievement.metric === 'streak_days' ? ' best-ever consecutive days' : achievement.metric === 'workout_count' ? ' workouts' : achievement.metric === 'personal_records' ? ' personal records' : achievement.metric === 'challenges_completed' ? ' challenges completed' : achievement.metric === 'challenge_wins' ? ' finalized wins' : achievement.metric === 'challenges_joined' ? ' challenges joined' : ' friends';
  return `${amount(progress.displayed)} / ${amount(achievement.target)}${unit}`;
}
export function pendingUnlocks(entries: readonly Achievement[], hidden: ReadonlySet<string>): Achievement[] {
  return entries.filter((entry) => entry.unlockedAt !== null && entry.presentedAt === null && !hidden.has(entry.id))
    .sort((a, b) => (a.unlockedAt ?? '').localeCompare(b.unlockedAt ?? '') || a.code.localeCompare(b.code));
}
