import type { ActiveWorkoutSession } from '../types/workout-session';

export type SessionHistoryItem = Pick<ActiveWorkoutSession, 'id' | 'name' | 'startedAt' | 'submittedAt' | 'syncStatus'>;
export type SessionHistoryPage = { items: SessionHistoryItem[]; total: number };

// One instance per owner/page. Retain row metadata, not another copy of sets.
export function createSessionHistorySelector(owner: string, limit: number) {
  let previous = new Map<string, SessionHistoryItem>();
  let page: SessionHistoryPage = { items: [], total: 0 };
  const matches = (row: SessionHistoryItem, session: ActiveWorkoutSession) =>
    row.name === session.name && row.startedAt === session.startedAt &&
    row.submittedAt === session.submittedAt && row.syncStatus === session.syncStatus;
  return (sessions: readonly ActiveWorkoutSession[]): SessionHistoryPage => {
    let changed = false;
    let count = 0;
    for (const session of sessions) {
      if (session.userId !== owner) continue;
      count++;
      const row = previous.get(session.id);
      if (!row || !matches(row, session)) changed = true;
    }
    if (!changed && count === previous.size) return page;
    const next = new Map<string, SessionHistoryItem>();
    for (const session of sessions) {
      if (session.userId !== owner) continue;
      const old = previous.get(session.id);
      next.set(session.id, old && matches(old, session) ? old : {
        id: session.id, name: session.name, startedAt: session.startedAt,
        submittedAt: session.submittedAt, syncStatus: session.syncStatus,
      });
    }
    previous = next;
    page = { total: count, items: [...next.values()].sort((a, b) => b.startedAt - a.startedAt ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, Math.max(0, limit)) };
    return page;
  };
}
