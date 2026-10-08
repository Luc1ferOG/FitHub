import type { WorkoutSummary } from '@/domain/entities/workout';
import type { WorkoutPage } from '../types/workout';

/** Change only an existing row: never invent page membership for a new workout. */
export function optimisticWorkoutPage(page: WorkoutPage, id: string, next: WorkoutSummary | null): WorkoutPage {
  return { ...page, items: page.items.flatMap((item) => item.id === id ? next ? [next] : [] : [item]) };
}
/** Restore just the affected row, preserving unrelated concurrent updates. */
export function rollbackWorkoutPage(current: WorkoutPage, before: WorkoutPage, id: string): WorkoutPage {
  const index = before.items.findIndex((item) => item.id === id);
  const original = before.items[index];
  if (!original) return current;
  const items = current.items.filter((item) => item.id !== id);
  items.splice(Math.min(index, items.length), 0, original);
  return { ...current, items };
}
export const workoutKeys = {
  all: ['workouts'] as const,
  lists: (ownerId: string) => ['workouts', 'owner', ownerId] as const,
  list: (ownerId: string, offset: number) => ['workouts', 'owner', ownerId, offset] as const,
  detail: (id: string, ownerId?: string) => ownerId === undefined ? ['workouts', 'detail', id] as const : ['workouts', 'detail', id, ownerId] as const,
  mutation: (ownerId: string) => ['workouts', 'write', ownerId] as const,
};
