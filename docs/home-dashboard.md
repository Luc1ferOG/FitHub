# Home dashboard

Home replaces the starter page with six compact sections: today, quick start, weekly activity, up to three challenges, the latest badge, and up to eight recent events. Start Workout opens template selection; a recent template opens its existing detail/start workflow. Saved local workouts retain the existing resume UI. Calories are omitted because there is no supported calorie source.

## Data boundary and security

`HomeScreen → useDashboard → DashboardService → DashboardRepository → SupabaseDashboardRepository → get_home_dashboard`.

Apply migration `202610070018_home_dashboard.sql` after migrations 001–017. The single RPC returns one consistent snapshot instead of independent widget requests. It takes only a validated PostgreSQL timezone, never a caller-supplied owner. Its hardened SECURITY DEFINER function explicitly scopes every private source to `auth.uid()` and restricts challenge cards to active eligible memberships and existing visibility rules. Cross-user achievement titles are already public through `get_social_profile`; this feed additionally requires a currently accepted friendship. No private friend workout history, health data, images, or email is exposed. Anonymous execution is revoked.

Weekly totals cover Monday through today in the device's timezone, using completed, synchronized workouts and completion timestamps. Midnight boundaries are independently converted to timestamptz, preserving daylight-saving transitions. Challenge dates remain inclusive UTC calendar dates. Volume stays canonical kg, with reusable unit conversion for the preferred display units. Offline pending sessions do not count prematurely or double count; the screen explains this.

Indexes support owner/completion, owner/recent-template, owner/recent-achievement and active membership queries. Lists are bounded server-side: three templates, three challenges, five candidates per activity source, eight final events, deterministically sorted by time and ID. Historical summaries aggregate the user's data, not every user's data; no React-wide leaderboard recalculation is involved. At substantially larger scale, profile these aggregates and friend-feed joins before introducing incremental summaries.

## Query and presentation

One account/timezone/local-day-scoped TanStack Query snapshot, 30-second stale time, cancellation forwarding, reconnect refresh, focus refresh, a focused minute refresh, and pull-to-refresh. Sensitive snapshots are excluded from disk cache persistence. Returning from CRUD/tracking screens refreshes the aggregate instead of duplicating feature caches into Zustand. Account changes use distinct keys and the existing authentication cache cleanup. Local session state stays in the existing persistent Zustand store.

FlatList virtualizes the six sections, with bounded children and no nested scrolling. Memoized section components, theme tokens, large reusable buttons, header semantics, screen-reader progress values, static reduced-motion-safe skeleton blocks, and readable empty/error states are included. Failed refreshes preserve the last in-memory snapshot with an explicit warning. Challenge activity entries display owner-scoped stored notifications, including updates about challenges that may have since ended; they do not fetch or expose current private challenge details.

## Verification

Run `node --experimental-vm-modules --test --test-isolation=none scripts/tests/home-dashboard.test.mjs` for greeting, units, UTC deadlines, progress, cache isolation, service/repository transport and static SQL boundaries. The stripped-TypeScript transport harness stubs response parsing; it does not substitute for Zod/Jest or live SQL checks.

Jest component tests cover weekly totals, quick-start/template navigation and active status. `supabase/tests/home-dashboard.sql` is a rollback-only integration fixture for identity isolation, confirmed totals and invalid timezone/unauthenticated rejection. Run against migrated local Supabase as postgres with ON_ERROR_STOP. Full TypeScript/lint/Jest checks and actual PostgreSQL execution require tools/dependencies absent in this workspace; device scrolling, contrast and screen-reader behavior still need device verification.

## Exact file manifest

Added:

- `supabase/migrations/202610070018_home_dashboard.sql`
- `supabase/tests/home-dashboard.sql`
- `src/features/home/types/dashboard.ts`
- `src/features/home/validation/dashboard-response.ts`
- `src/features/home/repositories/dashboard-repository.ts`
- `src/features/home/services/dashboard-service.ts`
- `src/features/home/services/dashboard-rules.ts`
- `src/features/home/hooks/use-dashboard.ts`
- `src/features/home/components/dashboard-section.tsx`
- `src/features/home/components/dashboard-skeleton.tsx`
- `src/features/home/components/__tests__/dashboard-section.test.tsx`
- `src/data/repositories/supabase/supabase-dashboard-repository.ts`
- `scripts/tests/home-dashboard.test.mjs`
- `docs/home-dashboard.md`

Changed:

- `src/features/home/screens/home-screen.tsx`
- `src/types/database.ts`
- `scripts/verify-database.mjs`
- `README.md`
