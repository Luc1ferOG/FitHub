/** Narrow synchronous port: committing a logged set must precede publishing it to UI. */
export interface OfflineDatabase {
  exec(sql: string): void;
  run(sql: string, ...values: (string | number | null)[]): void;
  first<T>(sql: string, ...values: (string | number | null)[]): T | null;
  all<T>(sql: string, ...values: (string | number | null)[]): T[];
  transaction(work: () => void): void;
}

export function initializeOfflineDatabase(db: OfflineDatabase): void {
  const version = db.first<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version > 1) throw new Error('This offline database was created by a newer FitHub version. Update the app; saved data has not been overwritten.');
  db.exec(`PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS local_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS local_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS local_sessions_owner ON local_sessions(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS local_sessions_identity ON local_sessions(id,user_id);
    CREATE TABLE IF NOT EXISTS sync_queue (
      local_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type = 'complete-workout'),
      entity TEXT NOT NULL CHECK(entity = 'workout-session'),
      payload TEXT NOT NULL, created_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0 CHECK(retry_count >= 0),
      sync_status TEXT NOT NULL CHECK(sync_status IN ('pending','syncing','synced','failed')),
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      retryable INTEGER NOT NULL DEFAULT 1 CHECK(retryable IN (0,1)), error TEXT,
      FOREIGN KEY(local_id,user_id) REFERENCES local_sessions(id,user_id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS sync_queue_due ON sync_queue(user_id, sync_status, next_attempt_at, created_at);
    CREATE TABLE IF NOT EXISTS offline_cache (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = 1;`);
  // Only called once per process, before any worker starts. Interrupted requests
  // have uncertain outcomes; retry the exact same ID and immutable payload.
  db.run("UPDATE sync_queue SET sync_status = 'pending' WHERE sync_status = 'syncing'");
}

export class SQLiteCacheStorage {
  constructor(private readonly db: OfflineDatabase) {}
  getItem(key: string): string | null {
    return this.db.first<{ value: string }>('SELECT value FROM offline_cache WHERE key = ?', key)?.value ?? null;
  }
  setItem(key: string, value: string): void {
    this.db.run('INSERT INTO offline_cache(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
  }
  removeItem(key: string): void { this.db.run('DELETE FROM offline_cache WHERE key = ?', key); }
  removeByPrefix(prefix: string): void {
    this.db.run('DELETE FROM offline_cache WHERE substr(key,1,?) = ?', prefix.length, prefix);
  }
  valuesByPrefix(prefix: string): string[] {
    return this.db.all<{ value: string }>('SELECT value FROM offline_cache WHERE substr(key,1,?) = ?', prefix.length, prefix).map((row) => row.value);
  }
}
