# Fitness challenges

## Feature and architecture

The Challenges tab now discovers visible challenges and pending invitations. Users create challenges, select a specific exercise for repetitions, join/leave, accept/decline invitations, and view scores/positions on paginated live leaderboards. Creators invite accepted friends from the detail screen. Dates are explicit ISO dates; the create form is scrollable and validates through React Hook Form/Zod. All leaderboard values are read-only.

Presentation → query hooks → ChallengeService → ChallengeRepository → Supabase adapter. Database writes are ownership-checked RPCs; screens never access Supabase. Query keys include the account, challenge ID, and list mode. Infinite queries fetch 20 rows plus a lookahead. Membership is not optimistically invented because invite acceptance, access checks and ranking are server-authoritative.

## Scoring decisions

- Workout Count: one per completed saved workout (the existing sync RPC requires at least one completed set).
- Total Workout Volume: sum of completed-set reps × canonical kg weights.
- Exercise Repetitions: completed-set repetitions for the selected exercise ID, not every exercise in a session.
- Workout Minutes: target input/display in minutes; database target/progress in seconds. Creation converts once at the service boundary.
- Start/end dates are inclusive UTC calendar dates. A workout must start after participation begins and both start and finish inside the date interval.
- Offline workouts may arrive through the inclusive seventh UTC date after the end date. The challenge closes for new joins at its normal end; rankings remain provisional during the grace period. Victory-achievement eligibility waits until that period ends.
- Leaving sets left_at rather than deleting the participant/scoring ledger. Left users disappear from ranks and participant counts. Rejoining keeps earned points and begins a new eligibility window; replaying a prior workout cannot add points again.
- Ties share dense rank, with user ID as the deterministic display-order tiebreaker. Scores are not capped at the target; the progress bar is capped at 100%.
- Legacy repetition challenges lacking an exercise ID continue counting all repetitions; newly created repetition challenges require an exercise. Legacy distance challenges remain readable but are not offered by the create form.

Migration 010 replaces the workout sync function while preserving its immutable receipt, transaction, ownership, PR and achievement logic. Migration 009 derives progress from owned saved sessions and enforces unique (challenge,user,session) scoring. It revokes direct challenge/member writes and client execution of record_challenge_progress. Nonqualifying workouts return no score without failing workout persistence. Challenge row locks serialize progress and membership changes.

## Security and realtime

Public/friends/invite-only map to the existing visibility enum public/friends/private. Pending invitees may read details; only eligible users join. Creator invitations require an accepted friendship; invitations are distinct from participation and are deduplicated. Only the caller can accept/decline their invitation or leave their own participation. Private challenge visibility is enforced by RLS, including the detail RPC. Source progress records are readable only by their owner, so leaderboard viewers do not receive private workout session IDs.

Each leaderboard recalculation increments the visible challenge's leaderboard_version. Screens subscribe to UPDATE events for that parent, invalidate their paginated details, coalesce event bursts, refetch on subscription/reconnection, and remove channels/timers when unmounted or the account changes. A 60-second refresh is a fallback for missed/background events. This avoids relying on filtered DELETE payloads; leaving is a soft update. Migration 009 adds challenges to the Realtime publication. This uses Supabase's [RLS-aware Postgres Changes mechanism](https://supabase.com/docs/guides/realtime/postgres-changes).

## Notifications and deployment

In-app notifications are inserted transactionally for invites, accepted friends joining, another participant overtaking the user's score, reaching the target, ending within 24 hours, and the challenge ending. Unique per-user event keys prevent duplicate inbox events; repeats of unchanged joins/invites do not spam. Per-user goals and challenge end use kind completed, with distinct event keys/messages.

Migration 012 installs a five-minute pg_cron deadline job, so ending-soon/end inbox notifications are automatic without a mobile client. This migration requires a Supabase Postgres environment supporting pg_cron. Run migrations 009–012 in order before launching the feature.

Settings exposes explicit device push opt-in/out. Push token registration is authenticated and RLS-protected; no server key is bundled. This device unregisters before logout (if unregistering fails, logout asks the user to reconnect to avoid leaving a previous account's push address attached). The centralized notification lifecycle now handles all taps and foreground display, preserving recipient-scoped destinations through login. See [notifications and deep linking](notifications-deep-links.md).

Push delivery requires deployment configuration; it is not activated against a remote project by these edits:

1. Configure an EAS project ID and native push credentials; use a development/production build, not Expo Go, for delivery validation. Follow [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
2. Deploy `supabase/functions/challenge-notifications` using Supabase CLI. The checked-in config disables gateway JWT verification for this function only; the function enforces its own POST-only, constant-time hashed CHALLENGE_CRON_SECRET authorization check. It never accepts a user JWT as worker authority.
3. Set a strong CHALLENGE_CRON_SECRET server secret and optionally EXPO_ACCESS_TOKEN for Expo enhanced push security. Supabase injects SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY on the server. Never put these keys into EXPO_PUBLIC variables.
4. Admin-provision Vault secrets fithub_project_url and fithub_challenge_cron_secret (the latter matches the function secret). Then execute `supabase/deploy/challenge-push-cron.sql`. It refuses to schedule without both secrets and schedules a one-minute worker call using pg_net. The pattern follows [Supabase scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
5. Enable alerts in Settings on a signed-in device. The worker consumes a private durable per-notification/device outbox with row leases, bounded retries/backoff and receipt checks; DeviceNotRegistered removes dead tokens. Inspect failed jobs and cron runs operationally. A successful push ticket is not proof of device delivery; the worker checks [Expo push receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

Inbox events/scoring are idempotent. External push transport is at-least-once: an interrupted acknowledgement can cause repeated pushes. Leases prevent normal concurrent delivery, not every possible transport duplicate. Events created before a device opts in remain in the inbox and are not retroactively pushed.

## Verification

- `npm run test:challenge-core`: 13 actual TypeScript rules/service/adapter/realtime/push-classification tests. Only Zod and external client boundaries are explicitly stubbed; actual input schemas are tested by Jest.
- `npm test -- --runInBand`: adds native tests for real creation validation, participation controls, position/progress rendering, mutation invalidation and subscription cleanup.
- `npm run db:verify`: static checks across migrations, RLS, RPC/grant boundaries, deduplication, locking and push leases. This is not a SQL parser/runtime security proof.
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fitness-challenges.sql`: rollback-only real SQL tests for automated four-metric scoring, replay/rejoin protection, prejoin/date rejection, invitations, friendship eligibility, ranks/notifications and private access.
- `deno check supabase/functions/challenge-notifications/index.ts`: worker type check once Deno and module access are available.

Workspace results: 13 challenge core tests and 45 existing core tests passed; static database checks passed. TypeScript, Expo lint and Jest were attempted but their executables are missing (dependencies are not installed). PostgreSQL/Supabase/Docker and Deno are unavailable, so SQL execution, native UI tests, worker type checking, multi-connection stress tests and actual push delivery remain unverified. Run those before considering this production-ready.

## Changed files

- package.json
- scripts/verify-database.mjs
- src/types/database.ts
- src/components/providers/app-providers.tsx
- src/features/auth/hooks/use-auth-mutations.ts
- src/features/profile/screens/profile-screens.tsx
- src/features/challenges/screens/challenge-screens.tsx
- src/features/challenges/types/challenge.ts
- src/features/leaderboards/screens/leaderboard-screens.tsx
- supabase/config.toml
- supabase/tests/workout-tracking.sql
- README.md
- supabase/README.md

## Added files

- docs/fitness-challenges.md
- scripts/tests/fitness-challenges.test.mjs
- supabase/migrations/202610060009_fitness_challenges.sql
- supabase/migrations/202610060010_challenge_sync_integration.sql
- supabase/migrations/202610060011_challenge_push_jobs.sql
- supabase/migrations/202610060012_challenge_deadline_schedule.sql
- supabase/tests/fitness-challenges.sql
- supabase/deploy/challenge-push-cron.sql
- supabase/functions/_shared/push-delivery.ts
- supabase/functions/challenge-notifications/index.ts
- src/validation/uuid.ts
- src/data/repositories/supabase/supabase-challenge-repository.ts
- src/data/repositories/supabase/supabase-push-device-repository.ts
- src/services/notifications/push-device-repository.ts
- src/services/notifications/challenge-push.ts
- src/services/notifications/challenge-push-dependencies.ts
- src/services/notifications/challenge-notification-navigation.ts
- src/services/notifications/__tests__/challenge-push.test.ts
- src/features/challenges/types/fitness-challenge.ts
- src/features/challenges/repositories/challenge-repository.ts
- src/features/challenges/services/challenge-rules.ts
- src/features/challenges/services/challenge-service.ts
- src/features/challenges/services/challenge-dependencies.ts
- src/features/challenges/validation/challenge-schema.ts
- src/features/challenges/validation/__tests__/challenge-schema.test.ts
- src/features/challenges/hooks/use-challenges.ts
- src/features/challenges/hooks/use-challenge-push.ts
- src/features/challenges/hooks/__tests__/use-challenges.test.tsx
- src/features/challenges/components/challenge-form.tsx
- src/features/challenges/components/challenge-card.tsx
- src/features/challenges/components/challenge-leaderboard.tsx
- src/features/challenges/components/challenge-summary.tsx
- src/features/challenges/components/invite-friends-picker.tsx
- src/features/challenges/components/challenge-push-settings.tsx
- src/features/challenges/components/challenge-notification-lifecycle.tsx
- src/features/challenges/components/__tests__/challenge-summary.test.tsx
- src/features/challenges/screens/challenge-list-screen.tsx
- src/features/challenges/screens/create-challenge-screen.tsx
- src/features/challenges/screens/challenge-detail-screen.tsx
