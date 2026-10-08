import { kilogramsToPounds } from '@/utils/units';
export function greeting(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
export function volumeLabel(kg: number, units: 'metric' | 'imperial'): string {
  return `${Math.round(units === 'imperial' ? kilogramsToPounds(kg) : kg).toLocaleString()} ${units === 'imperial' ? 'lb' : 'kg'}`;
}
export function challengeRemaining(endDate: string, now: Date): string {
  const remaining = Date.parse(`${endDate}T00:00:00Z`) + 86_400_000 - now.getTime();
  if (remaining <= 0) return 'Ended';
  if (remaining < 86_400_000) { const hours = Math.ceil(remaining / 3_600_000); return `${hours} hour${hours === 1 ? '' : 's'} left`; }
  const days = Math.ceil(remaining / 86_400_000); return `${days} day${days === 1 ? '' : 's'} left`;
}
export function progressPercentage(current: number, target: number): number {
  return target > 0 ? Math.max(0, Math.min(100, Math.round(current / target * 100))) : 0;
}
export const dashboardKeys = { all: ['home-dashboard'] as const,
  snapshot: (owner: string, timezone: string, day: string) => ['home-dashboard', owner, timezone, day] as const };
