interface LogoutPort { logout(): Promise<void> }
interface PushCleanupPort { disable(): Promise<void> }

/** Push cleanup is best effort; its failure must not prevent an Auth logout attempt. */
export async function logoutWithCleanup(auth: LogoutPort, push: PushCleanupPort): Promise<void> {
  try { await push.disable(); } catch { /* The push service retains its token for cleanup retry. */ }
  await auth.logout();
}
