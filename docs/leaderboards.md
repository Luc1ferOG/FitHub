# Leaderboards

## Delivered

Challenge detail and leaderboard routes now use the shared leaderboard view. Rows show rank, avatar/fallback, name, username, progress/target and completion percentage. A pinned current-user position remains visible even when that user is outside the loaded pages. Text and borders identify the current user without relying on color. The podium shows the first three server-ordered participants with their actual ranks; ties are never relabeled as distinct first/second/third places.

Friends → Friends leaderboard ranks completed workouts over the inclusive last 30 UTC dates. Sharing is opt-in, default false. Only accepted, opted-in friends and the current viewer appear. The viewer always sees their own score. Friends scores have no artificial challenge target/percentage. No optional global board was added because public worldwide statistics would require a separate consent policy.

Architecture: screens/components → TanStack Query hooks → LeaderboardService → LeaderboardRepository → Supabase adapter. Server state stays in Query, not Zustand. Ranking is never recomputed over a huge list in React. The existing rankScores function is a test/reference model only.

## Data/query design

Migration 013 adds private.daily_workout_scores, an indexed per-user/UTC-day completed-workout-count aggregate. It backfills existing history once; transactional session insert/update/delete triggers adjust the relevant daily counter. Replaying the existing immutable workout-sync receipt does not insert a second session or counter increment. Friends RPCs resolve indexed accepted-friend IDs first, filter opt-in consent, aggregate only those users' 30-day counters, and rank that bounded social graph in PostgreSQL. They never scan every user's workout history.

Challenge reads use the existing indexed cached participant scores/ranks. Active participant count is now also maintained transactionally, so fetching each page does not scan all challenge participants merely to count them. Server reranking updates only rows whose score/completion/rank actually changed; the previous notification behavior is preserved. Reranking still runs on the database and should be load-tested for very large challenges—this is not an O(1) rank-maintenance claim.

Both boards use score-descending/user-ID-ascending keyset pagination (20 rows plus one lookahead). Equal scores share dense rank: 1, 1, 2. Names/avatar changes do not alter tie ordering. RPCs return top-three entries and the viewer's position independently of the current page. They return a version string, and reject a cursor from an older ranking with 40001. Friends versions include the UTC date so rolling-window turnover also invalidates old cursors. This prevents silently mixing reordered pages.

## Realtime and performance

Challenge subscriptions watch the visible challenge parent revision. Friends subscriptions watch only the viewer's RLS-protected leaderboard_revisions row, not everyone else's score/history. Workout, consent, friendship and public identity changes bump the appropriate viewer signals. Unshared workouts do not emit a timing signal to friends. No client can write scores, counters or revision signals.

Realtime bursts coalesce for 500 ms. An event during an in-flight refresh schedules one trailing refresh rather than repeatedly cancelling it. Refresh cancels obsolete multi-page requests, trims the cache to one page, resets its cursor to null, and requests the latest first page; it does not refetch an accumulated giant leaderboard. Initial/one-page requests are reused rather than cancelled. Cursor conflicts use the same coordinator. Loaded pages remain scrollable until refresh; the former five-page eviction window was removed because it could drop earlier rows without backward pagination. Inactive caches expire after ten minutes and are not persisted. Podium/current-user metadata remain available in every page. Channels and a 60-second fallback run only while the screen is focused, foregrounded and online, and are released on suspension/unmount/account changes. See [performance audit](performance-audit.md) for measurements and remaining scale limits.

FlatList virtualizes the window. Row callbacks are stable, list items and podium are memoized, and Query's normal structural sharing helps preserve unchanged row props. Avatars use Expo Image caching/recycling. An accessible load-more button supplements scroll pagination. Shared design tokens support light/dark mode. Example label: “Rank 2, Mark, 13 out of 20 workouts completed, 65 percent complete.” Percentages are capped at 100 while full scores remain visible above the target.

Implementation follows [TanStack infinite-query cache patterns](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) and [Supabase RLS-aware Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes). The checked-in migration adds the owner-only revisions table to the Realtime publication.

## Verification/deployment

Apply `202610060013_leaderboards.sql` after the existing migrations. No extra dependencies or remote writes were made.

- `npm run test:leaderboard-core`: 10 actual TypeScript tests for ties, deterministic order, tie-boundary pagination, descriptive labels, stale-cursor conflicts, bounded refresh, scoped realtime cleanup and burst/trailing refresh coordination. Zod/client boundaries are explicitly stubbed in this dependency-free harness.
- `npm test -- --runInBand`: native rendering/highlight/podium tests, real response-validation tests, and hook cache/subscription tests.
- `npm run db:verify`: static migration/RLS/grant/ordering/version/privacy checks, not execution or proof of SQL correctness.
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/leaderboards.sql`: rollback-only SQL tests with 44 user fixtures for true server ties/order across pages, consent, removed/pending friends, UTC window, unshared-workout signal privacy, private challenge access, own-only signals and stale versions.

Workspace results: all 10 new leaderboard core tests and all 58 existing core tests passed; static database checks passed. TypeScript, Expo lint and Jest were attempted but executables are missing because dependencies are not installed. PostgreSQL/Supabase/Docker are unavailable. Native rendering, SQL execution, concurrent-load tests and live realtime behavior remain unverified; run these checks before production use.

## Files changed

- package.json
- scripts/verify-database.mjs
- src/types/database.ts
- src/features/challenges/components/challenge-leaderboard.tsx
- src/features/challenges/components/challenge-summary.tsx
- src/features/challenges/hooks/use-challenges.ts
- src/features/challenges/screens/challenge-detail-screen.tsx
- src/features/leaderboards/screens/leaderboard-screens.tsx
- src/features/social/screens/social-screens.tsx
- README.md
- supabase/README.md

## Files added

- docs/leaderboards.md
- supabase/migrations/202610060013_leaderboards.sql
- supabase/tests/leaderboards.sql
- scripts/tests/leaderboards.test.mjs
- src/app/friends/leaderboard.tsx
- src/data/repositories/supabase/supabase-leaderboard-repository.ts
- src/features/leaderboards/types/leaderboard.ts
- src/features/leaderboards/repositories/leaderboard-repository.ts
- src/features/leaderboards/validation/leaderboard-response.ts
- src/features/leaderboards/validation/__tests__/leaderboard-response.test.ts
- src/features/leaderboards/services/leaderboard-service.ts
- src/features/leaderboards/services/leaderboard-dependencies.ts
- src/features/leaderboards/services/leaderboard-presentation.ts
- src/features/leaderboards/services/realtime-refresh.ts
- src/features/leaderboards/hooks/use-leaderboard.ts
- src/features/leaderboards/hooks/__tests__/use-leaderboard.test.tsx
- src/features/leaderboards/components/leaderboard-avatar.tsx
- src/features/leaderboards/components/leaderboard-user-row.tsx
- src/features/leaderboards/components/leaderboard-podium.tsx
- src/features/leaderboards/components/friends-sharing-control.tsx
- src/features/leaderboards/components/__tests__/leaderboard-ui.test.tsx
- src/features/leaderboards/screens/leaderboard-screen.tsx
