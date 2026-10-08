import type { AuthSession } from '../types/auth';

/** Local routing identity only; NEVER a credential or a grant of server access. */
export interface OfflineIdentityRepository {
  read(): AuthSession | null;
  save(session: AuthSession): void;
  clear(): void;
}
