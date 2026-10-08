import { z } from 'zod';
import type { AuthSession } from '@/features/auth/types/auth';
import type { OfflineIdentityRepository } from '@/features/auth/repositories/offline-identity-repository';
import type { OfflineCacheStorage } from './offline-workout-repository';
import { databaseUuidSchema } from '@/validation/database-uuid-schema';

const identitySchema = z.object({ user: z.object({ id: databaseUuidSchema, email: z.string().nullable() }), expiresAt: z.number().nullable() });
export class SQLiteOfflineIdentityRepository implements OfflineIdentityRepository {
  private readonly key = 'last-authenticated-identity';
  constructor(private readonly storage: OfflineCacheStorage) {}
  read(): AuthSession | null {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    try { return identitySchema.parse(JSON.parse(raw) as unknown); } catch { return null; }
  }
  save(session: AuthSession): void { this.storage.setItem(this.key, JSON.stringify(identitySchema.parse(session))); }
  clear(): void { this.storage.removeItem(this.key); }
}
