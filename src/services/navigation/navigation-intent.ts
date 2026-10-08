import { parseDestination, type DestinationPath } from './destinations';
import { isUuid } from '@/validation/uuid';

export type NavigationIntent = { path: DestinationPath; recipientId: string | null; createdAt: number };
export function parseStoredIntent(value: unknown, now: number): NavigationIntent | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  if (typeof data['path'] !== 'string' || typeof data['createdAt'] !== 'number' || !Number.isFinite(data['createdAt']) || data['createdAt'] > now || now - data['createdAt'] > 86400000) return null;
  const recipient = data['recipientId'];
  if (recipient !== null && (typeof recipient !== 'string' || !isUuid(recipient))) return null;
  const path = parseDestination(data['path']);
  return path ? { path, recipientId: recipient, createdAt: data['createdAt'] } : null;
}
export function intendedDestination(intent: NavigationIntent | null, userId: string | null, now: number): DestinationPath | null {
  const valid = parseStoredIntent(intent, now);
  if (!valid || !userId || valid.recipientId && valid.recipientId !== userId) return null;
  return valid.path;
}
