import type { AuthRepository } from '../repositories/auth-repository';
import type { AuthSession } from '../types/auth';
import type { OfflineIdentityRepository } from '../repositories/offline-identity-repository';
import { AppError } from '@/domain/errors/app-error';

export type AuthSessionState = {
  session: AuthSession | null;
  isInitializing: boolean;
  restorationError: unknown | null;
};

export type AuthSessionStateListener = (state: AuthSessionState) => void;

/**
 * Restores local navigation without letting a late SDK result overwrite a newer
 * auth event. Cached offline identity is not a credential or server authorization.
 */
export class AuthSessionManager {
  constructor(private readonly repository: AuthRepository,
    private readonly offline?: { identity: OfflineIdentityRepository; isOffline: () => boolean }) {}

  start(listener: AuthSessionStateListener): () => void {
    let disposed = false;
    let receivedAuthEvent = false;
    const fallback = () => {
      try { return this.offline?.identity.read() ?? null; } catch { return null; }
    };
    const remember = (session: AuthSession | null) => {
      // Optional cache failures must not prevent valid SDK authentication.
      try { if (session) this.offline?.identity.save(session); else this.offline?.identity.clear(); } catch { /* Device storage is unavailable. */ }
    };
    if (this.offline?.isOffline()) {
      const saved = fallback();
      if (saved) listener({ session: saved, isInitializing: false, restorationError: null });
    }

    const unsubscribe = this.repository.onSessionChange((session, event) => {
      if (disposed) return;
      if (!session && event === 'INITIAL_SESSION') {
        const saved = this.offline?.isOffline() ? fallback() : null;
        if (saved) {
          listener({ session: saved, isInitializing: false, restorationError: null });
        }
        // INITIAL_SESSION null can mean that token refresh failed, not logout.
        // Let getSession distinguish a transient error from authoritative null.
        return;
      }
      receivedAuthEvent = true;
      remember(session);
      listener({ session, isInitializing: false, restorationError: null });
    });

    void this.repository
      .getSession()
      .then((session) => {
        if (!disposed && !receivedAuthEvent) {
          const restored = session ?? (this.offline?.isOffline() ? fallback() : null);
          remember(restored);
          listener({ session: restored, isInitializing: false, restorationError: null });
        }
      })
      .catch((error: unknown) => {
        if (!disposed && !receivedAuthEvent) {
          const networkFailure = error instanceof TypeError || error instanceof AppError && error.code === 'NETWORK';
          const restored = networkFailure ? fallback() : null;
          if (!networkFailure) remember(null);
          listener({ session: restored, isInitializing: false, restorationError: error });
        }
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }
}
