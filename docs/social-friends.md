# Social friends

Entry: Profile → Friends → Find people / Pending requests. `/user/[id]` remains the public-profile deep-link destination.

Screens → TanStack Query hooks → SocialService → SocialRepository → Supabase adapter. Components never query Supabase. No server state enters Zustand. Search waits 350 ms, requires 2–80 characters, literally matches username/display name, and fetches 20 rows plus a pagination sentinel. SQL trigram indexes support substring search. Zod validates responses. Lists use virtualized FlatList, cached thumbnails, pull-to-refresh, loading/empty/error states and pagination.

States: self, none (including declined), outgoing, incoming, friends. Only recipients accept/reject; senders can cancel; either accepted friend can remove, with confirmation. The service guards invalid actions; migration 008 enforces the authoritative state machine. It revokes table and column write grants, locks each unordered pair even before a row exists, checks JWT identity and expected request ID, and retains the existing unordered-pair unique index/self-request CHECK. Declined requests may be resent with a fresh ID so stale actions cannot affect the new request. Crossed requests require explicit acceptance, not automatic friendship.

Optimistic acceptance/rejection/removal/cancellation affect only the target relation cache. Failure restores that relation; paginated list membership is refetched. Sending never invents a request ID. Writes serialize per pair, have no automatic retry, and invalidate account-scoped social queries after settlement. Account keys differ, and the existing auth provider clears caches on logout/account switch. Pull-to-refresh handles other-device changes; there is no new realtime subscription.

Public profiles expose only the existing narrow public_profiles view, up to 50 earned achievements, public workout-template count, and achievement count. No private history, measurements, birthdate or email. Achievement awards remain server-only; the narrow badge RPC does not grant direct user_achievements access.

Verification commands:

- `npm run test:social-core`: actual TypeScript service/state/adapter tests without native dependencies; only the external Zod response boundary is stubbed.
- `npm test -- --runInBand`: Jest rendering, debounce/navigation, optimistic rollback/invalidation and real response schemas.
- `npm run db:verify`: static migration/security checks, not SQL execution.
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/social-friends.sql`: rollback-only SQL regression tests on a migrated/seeded local Supabase database. Apply migration 008 before using the feature. Sequential crossed requests are tested; multi-connection concurrency still needs a live database stress test.

Changed files:

- package.json
- scripts/verify-database.mjs
- src/types/database.ts
- src/features/profile/screens/profile-screens.tsx
- src/features/social/screens/social-screens.tsx

Added files:

- docs/social-friends.md
- supabase/migrations/202610060008_social_friends.sql
- supabase/tests/social-friends.sql
- scripts/tests/social-friends.test.mjs
- src/app/friends/search.tsx
- src/data/repositories/supabase/supabase-social-repository.ts
- src/features/social/types/social.ts
- src/features/social/repositories/social-repository.ts
- src/features/social/services/friend-state.ts
- src/features/social/services/social-service.ts
- src/features/social/services/social-dependencies.ts
- src/features/social/validation/social-response.ts
- src/features/social/hooks/use-social.ts
- src/features/social/components/user-card.tsx
- src/features/social/components/friend-actions.tsx
- src/features/social/components/social-list-feedback.tsx
- src/features/social/screens/user-search-screen.tsx
- src/features/social/screens/public-profile-screen.tsx
- src/features/social/hooks/__tests__/use-social.test.tsx
- src/features/social/components/__tests__/friend-actions.test.tsx
- src/features/social/screens/__tests__/user-search-screen.test.tsx
- src/features/social/screens/__tests__/public-profile-screen.test.tsx
- src/features/social/validation/__tests__/social-response.test.ts

Workspace verification: social core 10/10 passed; existing exercise/workout/tracking core suites 35/35 passed; static database checks passed (16 RLS-protected tables, 23 hardened definer functions). TypeScript, Expo lint and Jest commands were attempted but their executables are unavailable because dependencies are not installed. SQL regression and native UI tests remain unexecuted here. These results are not a substitute for installed-dependency type checks or live database validation.
