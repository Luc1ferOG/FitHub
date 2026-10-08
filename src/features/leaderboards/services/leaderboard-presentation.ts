import type { ChallengeMetric } from '@/types/database';
import type { RankedUser } from '../types/leaderboard';
export const LEADERBOARD_PAGE_SIZE = 20;
export function leaderboardAmount(metric:ChallengeMetric,value:number):string {
  return (metric === 'duration_seconds' ? value/60:value).toLocaleString(undefined,{ maximumFractionDigits:2 });
}
export function leaderboardUnit(metric:ChallengeMetric):string {
  return metric === 'workout_count' ? 'workouts' : metric === 'volume_kg' ? 'kg' : metric === 'repetitions' ? 'repetitions' : metric === 'duration_seconds' ? 'minutes':'metres';
}
export function completionPercent(value:number,target:number|null):number|null {
  return target !== null && target > 0 ? Math.max(0,Math.min(100,value/target*100)):null;
}
export function leaderboardLabel(entry:RankedUser,metric:ChallengeMetric,target:number|null,isMe:boolean):string {
  const amount = leaderboardAmount(metric,entry.value); const unit = leaderboardUnit(metric); const percentage = completionPercent(entry.value,target);
  return `Rank ${entry.rank}, ${entry.displayName}${isMe ? ', you':''}, ${target !== null ? `${amount} out of ${leaderboardAmount(metric,target)} ${unit} completed, ${Math.round(percentage ?? 0)} percent complete` : `${amount} ${unit} completed in the last 30 UTC days`}.`;
}
export function firstLeaderboardPage<T>(data:{ pages:T[]; pageParams:unknown[] }|undefined):{ pages:T[]; pageParams:null[] }|undefined {
  // A bounded window may start at a nonzero cursor. Always restart with null,
  // never carry the old version/cursor into a ranking refresh.
  return data ? { pages:data.pages.slice(0,1),pageParams:data.pages.length ? [null]:[] }:undefined;
}
export const leaderboardKeys = {
  root:['leaderboards'] as const,
  board:(owner:string,kind:string,id:string) => ['leaderboards',owner,kind,id] as const,
};
