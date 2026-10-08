# Offline workout capability

## Workflow and scope

Sign in and open a workout while connected once. Its complete template is saved in an account-scoped SQLite cache independently of TanStack Query's 24-hour cache lifetime. Offline you can find cached owner pages or downloaded owned templates, open a cached template, start, log sets, review, add notes, and save. Active drafts and completed sessions survive closing and reopening the app. Never-opened templates and uncached pages require an initial connection; a new installation cannot register/authenticate offline.

Logging/finishing do not invoke network mutations. SQLite commits before Zustand publishes changes. Storage failure retains the previous saved state and shows a recovery error. Inputs, completion flags, notes, provisional PR history and absolute timer deadlines restore after reopening. Timer ticks do not write to disk. Server-calculated achievements and challenge changes await synchronization.

Template CRUD, social writes, media uploads and push registration still require a connection. Other cached server reads use existing TanStack persistence. Device appearance settings remain persistent and offline. Upgrading an older release should be done while connected once to populate the new identity/template caches; old TanStack snapshots are not automatically imported as trusted identities/templates.

## Architecture

```text
Workout hooks → WorkoutService → OfflineWorkoutRepository
                                 ├─ account-scoped SQLite cache
                                 └─ SupabaseWorkoutRepository

Logging → Zustand session store → SQLiteSessionRepository
                                   └─ transaction: session + outbox

Reconnect/foreground → SessionSyncService → atomic queue claim
                                          → SessionRepository / Supabase RPC
                                          → transaction: receipt + queue ack
```

`fithub-offline.db` uses WAL, FULL synchronous durability, foreign keys and schema version 1. Tables: `local_metadata`, `local_sessions`, `sync_queue`, `offline_cache`. Owner/due indexes support queue reads. A composite session-owner foreign key prevents cross-account outbox rows.

Queue fields: `local_id`, `user_id`, `type` (`complete-workout`), `entity` (`workout-session`), immutable JSON `payload`, `created_at`, `retry_count`, `sync_status` (`pending`, `syncing`, `synced`, `failed`), `next_attempt_at`, `retryable`, `error`. The local ID is the remote session UUID and idempotency key.

The old `@fithub/workout-sessions-v1` SQLite KV snapshot is validated and imported once transactionally; its original bytes are retained for recovery. Corrupt data is neither overwritten nor marked imported. Unfinished drafts have no queued operation. Existing synced sessions get synced entries. Only changed session rows are written, with immutable-object serialization memoized inside the repository; failed transactions do not update the successful-write cache.

The durable template cache removes stale pages after successful writes and details after deletion/revoked access. Network failures retain usable cached data. Confirmed permission failures do not fall back to private cached data. Detail query keys include the account ID.

## Synchronization and conflicts

The worker runs on reconnect, resume, pending changes and a 15-second foreground interval. It is single-flight, checks current account/connectivity before each operation and atomically claims entries. Requests abort/time out after 30 seconds. Interrupted `syncing` rows become `pending` at the next process initialization.

Transient failures retry after 5, 10, 20, 40, 80, 160 seconds, then at most every 300 seconds. Retry counts/deadlines survive restart. Validation, authorization, authentication and payload conflicts require explicit retry. Failed workouts are never dropped. Acknowledgment disk failures retry the same remote ID; receipt persistence and queue acknowledgment commit together. Cache observer errors cannot reverse successful synchronization.

| Data | Conflict rule |
| --- | --- |
| Active draft | Local device authoritative; no remote overwrite of ongoing logging. |
| Completed session absent remotely | Upload the locally completed frozen aggregate. |
| Same remote ID and canonical payload | Return original receipt; no duplicate workout, credit or unlock. |
| Same ID with different payload, or history without receipt | Retain local data and show conflict; never overwrite remote history. |
| Cached template | Latest successfully fetched server version wins; editable templates keep expected-version checks. |
| Editable profile/server settings | Last server-accepted write wins using server timestamps, not device-clock ordering. The current profile is read-only; no offline profile-write replay is introduced. |
| Device appearance | Last local preference change wins and persists on this device; no false cross-device synchronization. |

Apply all existing Supabase migrations, including the latest `sync_workout_session` definition in `202610060017_achievement_system.sql`. It checks `auth.uid()`, serializes account submissions, validates the aggregate, stores a canonical payload hash/private receipt, and atomically applies history/challenge/achievement changes. No new PostgreSQL migration is needed. Do not replace it with direct client history writes.

The status strip shows `Offline`, pending workout count or synchronization status without blocking navigation. Detailed errors/manual retry remain in the summary. Network sync is foreground/reconnect based, not an OS background-task guarantee; reconnect while suspended is handled on resume.

## Authentication and privacy

The SDK owns credentials, session persistence and token refresh. Auxiliary SQLite routing identity contains only user ID, email and expiry metadata, never passwords/JWTs/refresh tokens. It permits local navigation when an expired SDK session cannot refresh during a transient outage, but cannot authorize a server request. Reconnect rechecks SDK authorization; signed-out events and authoritative rejection clear identity. Newer auth events win over stale restoration promises.

Pending workouts remain scoped to their original account after logout; another account cannot browse/sync them. Returning to the original account restores them. SQLite is sandboxed local health data, **not encrypted**. Encryption/backup policy remains a deployment requirement if demanded by your data-protection policy. Uninstall/clearing app storage loses unsynchronized data. Automatic history/receipt pruning is not introduced.

Adapters follow the [Expo SDK 54 SQLite API](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) and [Supabase React Native session guidance](https://supabase.com/docs/guides/auth/quickstarts/react-native), leaving [session retrieval/refresh](https://supabase.com/docs/reference/javascript/auth-getsession) to the SDK.

## Verification

`npm run test:offline-core`: 26 tests execute production TypeScript logic against real Node SQLite, including actual file close/reopen, transaction rollback, queue claims, account isolation, transient/terminal failures, timeout, persisted backoff, lost responses, acknowledgment disk failure, duplicates, migration preservation, cache discovery and auth restoration. Zod parsing and the Zustand container are stubbed in this harness; added Jest cache tests use real Zod. These are not native integration tests.

All 197 dependency-free core tests pass. `npm run db:verify` passes existing static security checks, not PostgreSQL execution. Typecheck, lint and Jest were attempted but cannot start: `tsc`, `expo` and `jest` are missing in this dependency-uninstalled workspace.

After installing dependencies, run those commands and verify on iOS/Android:

1. Sign in, open an owned template, disconnect, start and log sets.
2. Force-close/reopen offline; check values, timer deadlines and account identity.
3. Finish/save offline, close/reopen again; check summary/pending count.
4. Reconnect and rapidly toggle connectivity twice; check exactly one remote session/receipt.
5. Simulate lost response/server outage; check retry backoff and another restart.
6. Switch accounts; check private cached workouts/pending history stay isolated.
7. Check expired/revoked credentials, disk-full recovery, rest alerts and large text.

## Exact file manifest

Added:

- `src/domain/offline/sync-operation.ts`
- `src/data/local/offline-database.ts`
- `src/data/local/sqlite-offline-database.ts`
- `src/data/local/sqlite-session-repository.ts`
- `src/data/local/sqlite-sync-queue-repository.ts`
- `src/data/local/offline-workout-repository.ts`
- `src/data/local/sqlite-offline-identity-repository.ts`
- `src/data/local/offline-identity-dependencies.ts`
- `src/data/local/__tests__/offline-workout-repository.test.ts`
- `src/features/auth/repositories/offline-identity-repository.ts`
- `src/features/workouts/validation/cached-workout-schema.ts`
- `src/validation/database-uuid-schema.ts`
- `scripts/tests/offline-capability.test.mjs`
- `docs/offline-capability.md`

Changed:

- `package.json`
- `README.md`
- `src/components/feedback/offline-banner.tsx`
- `src/components/providers/query-provider.tsx`
- `src/store/app-store.ts`
- `src/data/repositories/supabase/supabase-auth-repository.ts`
- `src/data/repositories/supabase/supabase-session-repository.ts`
- `src/features/auth/context/auth-context.tsx`
- `src/features/auth/repositories/auth-repository.ts`
- `src/features/auth/services/auth-dependencies.ts`
- `src/features/auth/services/auth-session-manager.ts`
- `src/features/workouts/components/session-lifecycle-provider.tsx`
- `src/features/workouts/hooks/use-workouts.ts`
- `src/features/workouts/hooks/__tests__/use-workouts.test.tsx`
- `src/features/workouts/repositories/local-session-repository.ts`
- `src/features/workouts/repositories/session-repository.ts`
- `src/features/workouts/screens/workout-detail-screen.tsx`
- `src/features/workouts/services/session-sync-service.ts`
- `src/features/workouts/services/workout-cache.ts`
- `src/features/workouts/services/workout-dependencies.ts`
- `src/features/workouts/state/create-session-store.ts`
- `src/features/workouts/state/session-store.ts`
