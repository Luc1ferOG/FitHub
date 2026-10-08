# Achievements

FitHub now defines 17 active badges across consistency, streaks, strength, social, and volume. Previously earned badges retain their identity and unlock date. The old five-PR badge is retired: it is visible only to users who already earned it and is never newly awarded.

## Ownership and flow

Confirmed domain facts → central database evaluator → unique award + notification → repository → AchievementService → TanStack Query → screen/app-wide animated modal.

- Screens never query Supabase or decide whether a user deserves an award. AchievementService validates event identity and reconciles trusted facts through an owner-authorized RPC; event messages contain no trusted counts.
- WorkoutCompleted and PersonalRecordCreated are emitted when the immutable workout receipt is inserted. Session synchronization calls the same central evaluator, retaining achievement results in the workout summary. Replaying the same receipt cannot repeat effects.
- FriendAdded is emitted for both users when a friendship becomes accepted. ChallengeJoined is emitted for joining or creating a challenge. ChallengeCompleted is emitted when the target is reached; repeated completion/rejoining counts the same challenge only once. ChallengeWon is emitted by scheduled finalization.
- PostgreSQL uniqueness on awards and event keys prevents duplicate unlocks and duplicate social facts. The evaluator locks the owner's profile, using the same order as workout synchronization.
- The durable event worker runs each minute, even without an open app. The foreground lifecycle subscribes to owner-filtered events and award INSERTs, coalesces bursts, reconciles on reconnect/resume, and polls every 30 seconds as a fallback. Unmount/account changes dispose timers and subscriptions.
- TanStack Query owns badges and progress; nothing is copied to Zustand. Achievement queries are excluded from disk persistence. Modal dismissal state is transient UI state, isolated per account.

## Rules

| Metric | Active thresholds |
| --- | --- |
| Confirmed completed workouts | 1, 5, 10, 50, 100 |
| Best-ever streak of distinct UTC workout-start dates | 3, 7, 30 |
| Confirmed completed PR sets | 1, 10 |
| Ever accepted a friendship | 1 |
| Distinct challenges joined/created | 1 |
| Distinct challenge targets reached | 5 |
| Finalized qualified first-place challenge finishes | 1 |
| Completed set volume, kg × repetitions | 10,000; 100,000; 1,000,000 kg |

Multiple workouts on one UTC date count once toward streaks. Gaps split streaks, and a later gap does not erase the best-ever streak. Arrival order of offline workouts is irrelevant to date grouping. Volume uses canonical kg; unweighted bodyweight repetitions contribute zero volume. PR semantics follow the existing server-confirmed single-set volume record, not a new estimated one-rep-max rule.

A challenge target reached counts as completion, regardless of final position. Wins require rank 1, target reached, active membership, completed challenge status, and expiration of the inclusive seven-day late-sync window. Qualified ties co-win. The finalized-challenge marker prevents later departures or administrative changes from inventing replacement winners. Awards and accepted social milestones are permanent; leaving challenges/removing friends does not remove earned badges.

Unlock dates record when the server recognizes the milestone, not a reconstructed historic date. Applying this catalog can therefore award newly introduced badges retroactively. Existing awards are marked already presented during migration to avoid replaying old modals.

## UI and delivery

The virtualized achievements screen separates Unlocked/Locked, displays dates and progress, supports pull-to-refresh/error/empty/loading states, and uses memoized accessible themed cards. Profile includes an Achievements shortcut.

An app-wide Animated modal queues saved, unacknowledged awards. It respects reduced-motion preferences. Continue acknowledges the award through an owner-only, idempotent RPC. Close for now hides it only for this app session; the badge itself remains saved. Failed acknowledgment is retryable and cannot lose the award. Presentation is at-least-once across crashes/devices; an award may be seen again if the app closes before acknowledgment.

Each new award inserts one in-app notification and enqueues push messages for already opted-in devices using the existing durable push outbox. No additional permission prompt is introduced. Achievement notification taps open the achievement screen only for the matching signed-in account. Push delivery needs the existing deployed challenge-notifications Edge worker and its scheduler/secrets; pg_cron alone does not call Expo's push API. Delivery is at-least-once under network retries, while award/in-app notification creation is unique.

## Database boundaries

Apply migrations 016 and 017 in order; enum additions must commit before use. Migration 017 installs the catalog, central evaluator, triggers, event/metric tables, acknowledgment RPCs, Realtime publication, scheduled worker/finalizer, and replacement workout-sync integration. Seed data mirrors the catalog. No changes to already-applied migrations are required.

Authenticated users can SELECT only their own event/metric/award rows, and cannot write them. Only owner-checked RPCs expose reading/reconciliation/acknowledgment. Workers/finalization and private functions are not callable by authenticated/anonymous clients. SECURITY DEFINER functions have an empty search path.

The event ledger intentionally has no profile/source FK: producers can hold a challenge/friendship lock belonging to several users and must not acquire another profile lock. Source rows already validate identities; only trusted functions write events. Profile deletion explicitly removes its events, and the worker prunes orphan events. Source deletion does not erase lifetime milestones. Finalization and evaluation run in separate job/RPC transactions so challenge locks are never held while acquiring profile locks. The worker marks only captured event IDs processed, avoiding loss of concurrently arriving events.

Privileged service-role maintenance can bypass client safeguards and must preserve confirmed history, event facts, and final winner snapshots. The ledger grows with domain events; production operations should monitor queue age/volume. Processed social facts cannot simply be deleted without migrating their lifetime aggregates.

## Verification

- `npm run test:achievement-core`: **61 passed**, including below/exact/above for all 17 thresholds, catalog parity, service validation, repository arguments/errors, Realtime cleanup, presentation ordering and static SQL contracts. Real TypeScript rules/services/adapters run in Node; native dependencies and response parsing are stubbed at boundaries.
- All dependency-free core suites together: **155 passed**.
- `npm run db:verify`: passed static checks. This is not a SQL parser or PostgreSQL execution test.
- Jest component tests cover accessible locked/unlocked cards and screen sections/loading/retry.
- `supabase/tests/achievements.sql` is a rollback-only PostgreSQL regression script: every catalog threshold below/exact/above, streak gaps/duplicates, incomplete PR exclusion, duplicate notifications/unlocks, workout replay/event integration, friendship removal, qualified tied wins/grace/finalization, own acknowledgment, forged writes, RLS and account cleanup.
- TypeScript, Expo lint and Jest were attempted but cannot execute here: dependencies are absent. Offline installation fails with ENOTCACHED. Supabase/PostgreSQL tools are also absent, so SQL and device UI tests remain unrun.

After installing dependencies, run:

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:achievement-core
npm run db:verify
# Local migrated/seeded Supabase only, as postgres; never production:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/achievements.sql
```

## Exact file manifest for this change

Added:

- `supabase/migrations/202610060016_achievement_enums.sql`
- `supabase/migrations/202610060017_achievement_system.sql`
- `supabase/tests/achievements.sql`
- `src/domain/events/achievement-event.ts`
- `src/data/repositories/supabase/supabase-achievement-repository.ts`
- `src/features/achievements/repositories/achievement-repository.ts`
- `src/features/achievements/services/achievement-service.ts`
- `src/features/achievements/services/achievement-rules.ts`
- `src/features/achievements/validation/achievement-response.ts`
- `src/features/achievements/hooks/use-achievements.ts`
- `src/features/achievements/components/achievement-card.tsx`
- `src/features/achievements/components/achievement-unlock-modal.tsx`
- `src/features/achievements/components/achievement-lifecycle.tsx`
- `src/features/achievements/components/__tests__/achievement-card.test.tsx`
- `src/features/achievements/screens/__tests__/achievements-screen.test.tsx`
- `src/services/notifications/achievement-notification-navigation.ts`
- `scripts/tests/achievements.test.mjs`
- `docs/achievements.md`

Changed:

- `src/features/achievements/types/achievement.ts`
- `src/features/achievements/screens/achievements-screen.tsx`
- `src/components/providers/app-providers.tsx`
- `src/features/profile/screens/profile-screens.tsx`
- `src/types/database.ts`
- `supabase/seed.sql`
- `supabase/functions/challenge-notifications/index.ts`
- `scripts/verify-database.mjs`
- `package.json`
- `README.md`
- `supabase/README.md`
