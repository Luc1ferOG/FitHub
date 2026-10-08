# FitHub database

Migration 015 makes progress photo metadata and objects owner-only and adds recoverable upload/deletion RPCs. It also makes any previously public photo metadata private. See [progress photo notes](../docs/progress-photos.md) before deployment.

Migration 014 adds private body-progress tracking support. Apply it after 013; see [body progress implementation notes](../docs/body-progress.md) for SQL tests, bounds and chart semantics.

The database is defined entirely by ordered SQL migrations. Dashboard changes should be captured in a new migration before they are shared or deployed.

## Apply locally

Install the Supabase CLI and a Docker-compatible runtime, then run:

```sh
supabase start
supabase db reset
supabase db lint
```

`db reset` applies all files under `migrations/` in timestamp order and then runs `seed.sql`.

For a linked hosted project, review the generated diff before deployment:

```sh
supabase db diff
supabase db push --dry-run
supabase db push
```

Regenerate application types after every schema change:

```sh
supabase gen types typescript --local > src/types/database.ts
```

The checked-in TypeScript file is generated-style and currently matches these migrations. The CLI-generated file becomes the source of truth once local Supabase tooling is available.

For mobile authentication, add `fithub://reset-password` to the hosted project's Auth redirect allow list. Local development URLs produced by Expo Go must also be allow-listed when recovery is tested inside Expo Go.

## Exercise catalogue

Migration `202610060005_exercise_library.sql` adds ordered form tips and common mistakes, a trigram index for case-insensitive name search, and deterministic name/ID ordering. The invoker-rights `get_exercise_filter_options` RPC returns distinct primary muscles and equipment values to authenticated callers while preserving RLS.

The updated seed contains coaching text for the original 25 exercises. Its media fields are still nullable: upload dedicated thumbnails and direct-playback tutorial files to `exercise-media`, then set the corresponding HTTPS URLs in `exercises`. The seed leaves media URLs unchanged when reseeded.

## Privacy model

- `profiles` is owner-readable because it contains health and demographic fields.
- `public_profiles` is a security-definer projection containing only public-safe columns.
- Workout history and measurements are owner-only.
- Progress-photo metadata and objects are owner-only after migration 015, including previously public metadata. There is no public progress-photo sharing path in the current application.
- `progress-photos` is a private Storage bucket. Object paths must be `{user_id}/{file}` and database `photo_url`/`thumbnail_url` fields store those paths rather than expiring signed URLs.
- Achievement awards and notification contents have no client insert policy. Trusted server code or database automation must create them.
- Challenge progress cannot be inserted directly. Trusted synchronization/automation derives it from completed sessions and prevents the same session from being counted twice in one challenge. `record_challenge_progress` is not executable by authenticated clients after the challenge migrations.
- RLS and trigger helpers live in the non-exposed `private` schema. Only deliberately granted read/membership/aggregate RPCs are callable by clients; privileged scoring, award and delivery workers remain server-only.

## Units

Canonical database units are independent of profile display preference:

- weights and volume: kilograms
- body measurements: centimetres
- distance: metres
- duration: seconds

Clients convert values only for display and input. This keeps calculations and leaderboards comparable.

## Deletion behavior

- Deleting an Auth user cascades through their profile and owned private data.
- Deleting a workout preserves completed history by setting `workout_sessions.workout_id` to `null`.
- Exercise deletion is restricted while templates or sessions reference it.
- Deleting a session nulls the optional challenge-progress source reference but preserves the historical leaderboard event.
- Deleting an achievement definition is restricted while users hold it.

## Workout management

Achievements require migrations 016–017 (separate commits for enum additions). See [achievement implementation notes](../docs/achievements.md) for server-only evaluation, event workers, Realtime, acknowledgment, optional push delivery, and the rollback-only `supabase/tests/achievements.sql` regression script. Apply migrations before the updated seed.

Migration 013 adds private daily friends-score aggregates, opt-in sharing, owner-only realtime revisions, cached challenge participant counts and versioned keyset leaderboard RPCs. See [leaderboard implementation notes](../docs/leaderboards.md) and `supabase/tests/leaderboards.sql` for security/ordering tests and deployment details.

Fitness challenges require migrations 009–012. See [the challenge implementation notes](../docs/fitness-challenges.md) for UTC date/grace-period rules, protected participation/scoring RPCs, RLS, Realtime, scheduled deadline events, optional Edge push deployment and rollback SQL regression tests.

Migration `202610060006_workout_management.sql` adds `save_workout` and `delete_workout` aggregate RPCs. Apply it before using the workout builder. Both use an empty search path and explicit `auth.uid()` ownership checks; edits/deletes lock the parent row and compare the original `updated_at` value. The save operation validates 1–100 exercises and uses array order for contiguous positions. Any failing exercise insert rolls back metadata and all exercise changes.

Only authenticated users may execute these functions. Earlier authenticated table-level and column-level workout write privileges are revoked to prevent partial aggregate writes outside the RPCs. Existing RLS continues to control reads. Do not restore those direct write grants in later migrations without preserving the aggregate invariants. Service-role maintenance remains privileged. Exercise guides remain shared read-only reference data.

Template deletion cascades to its template exercises, while session references become null and history is retained. Duplicating is implemented by reading an accessible template and saving a private copy as the authenticated caller. Run `npm run db:verify` for static checks; this does not replace applying the migration and checking anonymous, owner, non-owner and stale-version requests against PostgreSQL.

After applying migrations and seeds locally, run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workout-management.sql` as the local PostgreSQL admin. This rollback-only regression script checks anonymous/non-owner rejection, revoked table and column grants, required exercises, stale edits/deletes, atomic rollback, ordered duplicate occurrences, and preserved session history. It uses test Auth users and must not be run against production. It is a standalone SQL script, not a `supabase test db` pgTAP suite.

## Workout tracking and synchronization

Migration `202610060007_workout_tracking.sql` makes finalized workout history an immutable aggregate. The mobile app generates and durably stores the session, exercise-occurrence and set UUIDs before upload. `sync_workout_session(p_user_id, p_session_id, p_payload)` requires that the authenticated user match the persisted session owner, serializes submissions with a profile row lock, and commits the session, sets, server-derived PR flags, eligible challenge changes, achievement awards and private receipt in one transaction.

`private.workout_sync_receipts` has RLS and no client grants. A replay with the same session ID and canonical payload returns that receipt; a changed payload conflicts. This covers the crash/connection-loss window after server commit but before the client receives or persists the response. The table/column write grants for sessions, session exercises and sets are explicitly revoked so clients cannot supply volume/PR flags or edit history after rewards have been derived. Privileged service-role maintenance must preserve receipt/effect consistency. Templates can still be deleted without deleting logged history; deleted or newly inaccessible templates are stored as a null reference on synchronization.

`get_workout_exercise_history` is SECURITY INVOKER, explicitly scopes historical sessions to `auth.uid()`, and accepts at most 100 distinct requested exercise IDs. It returns best single-set volume and the latest completed sets, not every historical workout. Volume/PRs use kg × reps; zero-weight bodyweight sets have zero volume. Sync confirms PRs against currently committed history, so offline estimates and multi-device delivery order can differ. Only still-active, joined challenges whose UTC period includes the workout are credited; distance metrics are not logged by this tracker. Achievements are evaluated from server data, including longest UTC workout streak, never supplied client award lists.

Run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workout-tracking.sql` against the local migrated/seeded database as postgres. This rollback-only script checks idempotency, ownership, revoked client grants, server volume/PR calculation, first-workout achievement, challenge credit, previous performance and aggregate rollback. It is not a pgTAP suite and must not be run in production. `npm run db:verify` remains a static audit, not a PostgreSQL execution test.
