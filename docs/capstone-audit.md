# FitHub strict capstone examination

Examined October 8, 2026. Scores below distinguish source evidence from executed application behavior. This is a provisional repository assessment, not a certified device demonstration or production-security review.

## Result

| Criterion | Maximum | Before fixes | After fixes |
| --- | ---: | ---: | ---: |
| Architecture & code quality | 15 | 10.5 | 11.5 |
| Functionality & features | 12 | 6.5 | 7.5 |
| State management & data flow | 8 | 5.5 | 6.5 |
| UI/UX & accessibility | 8 | 5 | 5 |
| Performance & optimization | 4 | 2.5 | 3 |
| Testing & documentation | 3 | 1.5 | 1.5 |
| **Total** | **50** | **31.5** | **35** |

Implemented breadth earns partial credit. Unexecuted component tests, configured coverage gates, source-only accessibility assertions and authored Maestro flows do not earn demonstration marks. The additional fixes improve specific defects, not confidence in an unbuilt application.

## 1. Architecture & code quality — 11.5/15

**Evidence.** [Routes](../src/app/_layout.tsx) delegate to feature screens; feature repository interfaces and services isolate database operations. For example, [WorkoutService](../src/features/workouts/services/workout-service.ts) depends on repository abstractions, while [SupabaseSessionRepository](../src/data/repositories/supabase/supabase-session-repository.ts) implements transport details. Domain calculations, Zod validation, shared UI, typed errors and explicit composition files are present. [tsconfig.json](../tsconfig.json) enables strict checking, unchecked-index protection, exact optional properties and explicit overrides. Production source scanning found no explicit `any` or `@ts-ignore` escapes.

**Missing requirements.** Successful semantic TypeScript/lint results; a reproducible dependency lock; stronger automated dependency-boundary enforcement; evidence that bootstrap/provider failures behave correctly on native builds.

**Bugs/weaknesses.** Auth writes previously inherited a retry policy unsuitable for registration/password requests. Error logging included transport messages/causes, which can contain sensitive information. Lifecycle providers were outside the screen boundary. Achievement/dashboard hooks constructed database implementations directly. Several screen/service files remain densely formatted, making review harder; this audit did not reformat unrelated code to inflate activity.

**Implemented fixes.** Explicit non-retrying Auth mutations, sanitized error logging, a themed provider-level boundary, an explicit `state` override in ErrorBoundary, truthful fallback wording, and service composition files for achievements/dashboard. Query metadata accesses now respect strict index-signature rules; public environment keys have explicit declarations so Expo's required literal dot-access form can remain. Import-time environment/SQLite failures and asynchronous effect errors remain outside what React error boundaries can catch; the new boundary does not claim otherwise.

**Exact changes for maximum marks.** Resolve installation and commit a reviewed lockfile; pass `tsc --noEmit` and Expo lint without suppressed rules. Add automated boundaries preventing presentation imports from data implementations except composition roots. Review dense modules for maintainability where changing them is meaningful. Exercise provider crashes, invalid configuration and SQLite-open failures with an explicit bootstrap/recovery design; never delete persisted sessions as a recovery shortcut.

## 2. Functionality & features — 7.5/12

| Required category | Repository evidence | Remaining demonstration gap |
| --- | --- | --- |
| Authentication / secure sessions | Auth repository/service/manager, profile trigger, recovery and protected routes; [SDK storage](../src/lib/auth-storage.ts) | SecureStore/native SDK integration, locked-device behavior, offline sign-out and recovery redirects need device tests |
| CRUD / API | Transactional workout RPCs, optimistic hooks, friend/challenge APIs, measurement/photo operations | No executed live API/migration/security integration results |
| Realtime | Owner-filtered channels and server-ranked, cursor/versioned leaderboard queries | Two-device updates, reconnect behavior and actual deployment not demonstrated |
| Offline / synchronization | [SQLite session repository](../src/data/local/sqlite-session-repository.ts), durable outbox, idempotent server session identity | Real SQLite core tests pass; native airplane-mode/restart/reconnect flow remains unexecuted |
| Nested navigation / deep links | Auth/tab groups, detail/edit/active routes, [validated destinations](../src/services/navigation/destinations.ts), preserved intents | Cold-start platform links, expired sessions and deleted records need device verification |
| Media / files | Camera/gallery permissions, compression, thumbnails, private bucket and signed URLs | Actual capture/upload/delete/permission and cross-account media denial not demonstrated |
| Advanced UI / gestures | Exercise drag ordering, swipe edit, sheets, Reanimated completion/unlocks | Native gesture conflicts, performance and accessibility alternatives need testing |
| Platform integrations | Notifications, camera, image picker, haptics, SQLite, native auth storage | No installed development/release build or provisioned push project |

**Missing requirements.** Proven Android/iOS workflows, configured EAS push identity/credentials, deployed worker/scheduler, live video assets and executed PostgreSQL RLS/trigger/storage tests. Workout history is explicitly device-local, not a cross-device history browser. Own-profile settings/editing are limited; public profile display is substantially richer than the own-profile landing screen. Optional global leaderboards/calories are not required for credit and were not invented.

**Bugs/weaknesses.** Native Auth tokens previously used unencrypted AsyncStorage. Push unregister failure could stop logout before Auth was attempted. Generic query persistence could serialize a paused login's password. These are substantive security/workflow defects, not polish issues. Database static checks cannot prove migration execution, policy correctness or race safety against PostgreSQL.

**Implemented fixes.** Native opaque SDK values now use a chunked SecureStore adapter with generation commits, Unicode-safe boundaries, migration cleanup, serialized operations and logout tombstones. Partial/uncertain writes, missing chunks and corrupt manifests are regression-tested. Web storage is explicitly not encrypted. Push cleanup rejection no longer prevents an SDK logout attempt. Query snapshots exclude every mutation and discard old snapshots through a new cache buster. No passwords are deliberately stored by app code.

**Security limitations.** Storage tests exercise the adapter protocol with ports, not native encryption. Install SecureStore and rebuild binaries for its backup plugin. A hung push request can still delay logout; the SDK may also fail sign-out offline. This audit deliberately does not use private Supabase SDK APIs to pretend guaranteed offline revocation. Workout SQLite and preferences are not an encrypted medical-record store. Lost/locked native stores, device compromise and uninstall/reinstall semantics need an explicit threat model. [Expo SecureStore documentation](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/) describes the relevant platform limitations.

**Exact changes for maximum marks.** On an isolated backend, apply all 19 migrations and seed; execute all ten rollback SQL suites and add adversarial two-user API/media tests. Provision push project/credentials and deploy the authenticated scheduled worker. Supply licensed working tutorial videos. Demonstrate all eight categories on native builds, including killed-app offline workouts and a second user's realtime leaderboard. Resolve offline/stalled logout through a supported SDK/transport cancellation design and explicit stale-device-token handling, then test account switching. Add server-paginated history/profile editing if presenting those as completed capabilities.

## 3. State management & data flow — 6.5/8

**Evidence.** Zustand stores client preferences, active sessions and routing intentions; TanStack Query owns remote lists/details. [Session store](../src/features/workouts/state/create-session-store.ts) saves before publishing changes. SQLite acknowledgement/outbox persistence, scoped query keys, serialized writes and targeted optimistic rollback preserve identity and unrelated updates. Server scoring/awards remain authoritative rather than trusting client PR/volume flags.

**Missing requirements.** Executed real-library/component cache integration tests, multi-account runtime verification, and concurrent-device conflict demonstrations. Profile last-write policies cannot be demonstrated by a profile editor that is not implemented.

**Bugs/weaknesses.** Workout synchronization did not invalidate the dashboard. Workout templates, friendships and challenge changes left dependent aggregates stale. Legacy sync treated observer exceptions as synchronization failures after acknowledgement and did not classify authentication errors as terminal like the durable branch. Persisted generic mutation variables were inappropriate for this data-flow design.

**Implemented fixes.** A [write-dependency map](../src/services/query/write-invalidation.ts) invalidates only the affected owner's dependent caches. Session observers receive the synced owner rather than invalidating every account. Friend changes refresh affected achievements/leaderboards/dashboard; challenge membership refreshes dependent leaderboard/dashboard data. Legacy observer failures cannot undo receipts, and authentication failures require explicit retry. Mutation replay/persistence belongs to the SQLite worker, not query snapshots.

**Exact changes for maximum marks.** Execute the new TanStack tests and all existing mutation tests with real libraries. Test optimism rollback while unrelated rows change, account switches during an in-flight sync, stale cursors and two-device template conflicts. Add server history paging rather than copying the server history into Zustand. Verify that SQL idempotency also protects challenge scoring and awards after lost responses; core mocks alone cannot establish this.

## 4. UI/UX & accessibility — 5/8

**Evidence.** Shared tokens/themes, light/dark/system choices, responsive safe-area screens, scalable text, touch-target constants, reusable errors/empty/loading states, accessible alternatives to drag/swipe, reduced-motion preferences and native navigation transitions. [Existing screen-by-screen review](ui-ux-audit.md) explicitly lists the unverified five-device matrix. Theme contrast calculations pass for the tested foreground/background pairs.

**Missing requirements.** Screenshots, actual small/large phone visual testing, VoiceOver/TalkBack focus and announcements, keyboard/gesture conflict testing, native modal focus return and full large-text inspection. Passing color formulas cannot establish actual rendered contrast over photographs or all disabled controls.

**Bugs/weaknesses.** Password and confirmation visibility buttons shared the same screen-reader label. Provider failures lacked a themed recovery surface. Authored layouts cannot honestly be called polished solely from source review. The own-profile landing screen remains basic.

**Implemented fixes.** Visibility labels identify the associated field, with a registration component regression test. Provider failures now have a themed boundary; fallback text no longer promises saved-data integrity without evidence. No unrelated typography/card changes were made to appear productive.

**Exact changes for maximum marks.** Run the documented device matrix in all themes, maximum supported font size and reduced motion. Record VoiceOver/TalkBack focus order, sheet focus return, validation announcements, accessible reorder controls and Android back handling. Capture real screenshots and fix observed clipping/contrast/navigation problems, then demonstrate meaningful animations at acceptable frame rates. Do not substitute generated mockups for screenshots.

## 5. Performance & optimization — 3/4

**Evidence.** Target lists use virtualized FlatLists, stable IDs and bounded server pages. Memoized cards/selectors reduce meaningful reference churn. Progress photos have separate 320px thumbnails, bounded compressed originals and non-persisted signed URLs. Leaderboard ranking is computed in PostgreSQL, not repeatedly sorted across a large React list. Focused refresh coordination coalesces bursts and releases channels/timers. [Performance audit](performance-audit.md) reports genuine Node selector benchmarks while explicitly excluding native FPS/memory/bundle claims.

**Missing requirements.** Release-device frame-time and memory measurements, actual bundle analysis, backend query plans/latency under realistic data, and optimized server avatar/exercise variants.

**Bugs/weaknesses.** Achievement lifecycle subscriptions remained active while backgrounded/offline; global write invalidation could trigger unrelated account refreshes. Virtualization bounds mounted views, not total retained query pages. Public avatar URLs may still point at oversized remote originals. The dependency scan is not a tree-shaking or bundle-size measurement.

**Implemented fixes.** Achievement subscriptions/polling now use the tested foreground/online coordinator with suspension cleanup and catch-up on resume. Owner-scoped aggregate invalidation replaces broad sync invalidation. A production dependency scan found no unused direct dependencies requiring removal. No blanket memoization was added.

**Exact changes for maximum marks.** Produce release Android/iOS export/build artifacts; profile the seven target screens on low-end hardware with thousands of rows, large images and realtime bursts. Record baseline/after frame times, memory, query counts and bundle size. Inspect SQL plans/index usage and implement avatar/exercise thumbnail variants where bandwidth measurements justify them. Introduce backward/windowed paging only if measured retention requires it.

## 6. Testing & documentation — 1.5/3

**Evidence.** 62 Jest/RNTL files, 16 dependency-free test files, ten rollback SQL suites, four critical Maestro flows, architecture/setup/security/performance/testing guides and a generated evidence report. The core runner passes **258/258** checks, including actual SQLite persistence and fault-injected storage protocols. The Jest gate targets 70% across production source without excluding screens to inflate results.

**Missing requirements.** Successfully executed Jest/RNTL/integration tests, measured meaningful coverage, live SQL tests, device E2E results, production build logs and actual screenshots. No pass credit is given merely for configuring a gate.

**Bugs/weaknesses.** A workout-picker integration mock omitted the bottom-sheet gesture API/root. No repeatable CI gate or production-export checks were wired into verification. Missing dependencies prevent semantic checking; new native composition therefore remains unverified. The challenge Maestro flow uses creator leave/rejoin rather than demonstrating independent-user participation.

**Implemented fixes.** Updated the picker mock; added real-library tests for paused-password dehydration, cache account isolation, Auth retry overrides, logout cleanup and sanitized logging; added secure-storage and legacy-sync regressions. Added a separate integration command, four Expo production-validation commands and CI. CI intentionally requires a reviewed lockfile: it cannot currently run an unlocked install and claim reproducibility. Generated reports distinguish blocked checks from passing checks.

**Exact changes for maximum marks.** Generate/review the lockfile on a network-enabled machine, then run CI and fix real TS/lint/Jest failures. Inspect coverage branches and exceed 70% with meaningful behavioral tests; do not exclude feature source or count static checks as coverage. Execute the SQL suites and Maestro on a seeded isolated backend, add an independent participant to challenge E2E, and retain native build/accessibility evidence. Keep README links, environment/setup commands and screenshots accurate.

## Verification performed after fixes

Package installation was attempted with `npm install --ignore-scripts --cache .npm-cache --fetch-timeout=15000 --fetch-retries=0`. It failed `ENOTCACHED`: the enforced offline npm cache lacks required package metadata. No lockfile or installed dependency graph was fabricated.

`npm run test:verify` attempts every check and returns nonzero for an incomplete release. Current results:

- Passed: 258 core tests; database static checks; parsing of 196 `.ts` files; dependency/reference scan (no unexplained unused direct dependencies).
- Blocked: TypeScript semantic checking, Expo lint, Jest/coverage, named integration suites, Expo public configuration, SDK dependency compatibility, Android and iOS production JavaScript exports. Required executables are not installed.
- Not run: ten live SQL suites, four Maestro flows, native compilation/installation, real push/media tests and device profiling. No adb, Android build tools, Xcode, Docker, Supabase CLI, psql or Maestro were available; finding Java alone is not a native build environment.
- **Coverage is not measured. No >70% claim is made.** Production exports, even once passing, are not signed APK/IPA or native-compilation proof. [Expo CLI documentation](https://docs.expo.dev/more/expo-cli/) distinguishes export and native run/build commands.

See [generated test report](test-report.md) and local ignored `artifacts/verification.json` / per-check logs. Source/static success cannot replace TypeScript module resolution, TSX compilation or PostgreSQL execution.

## Priority disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| High | Plaintext native Auth storage | Adapter/plugin implemented; native installation/integration verification blocked |
| High | Paused mutation credentials persisted | All mutation dehydration disabled; cache buster advanced; protocol test passes, real-library test authored |
| High | Push cleanup prevents logout on rejection | Auth attempt now proceeds; stalled requests/offline SDK sign-out remain a supported-API/device follow-up |
| High | Missing semantic/build/live-security gates | Commands/CI/reporting added and attempted; installation/backend/device prerequisites remain blockers |
| Medium | Auth retry replay | Explicit Auth policy and safe global default implemented |
| Medium | Sensitive transport logging | Error code only; regression authored |
| Medium | Provider boundary / explicit override | Implemented; bootstrap/async failure modes remain outside boundary scope |
| Medium | Stale dependent summaries / cross-account invalidation | Scoped dependency map wired into workout/social/challenge/award paths |
| Medium | Legacy sync acknowledgement/terminal-error parity | Fixed with passing core regressions and Jest cases |
| Medium | Background/offline achievement channel/poll | Foreground coordinator implemented; coordinator lifecycle tests pass |
| Medium | Hook-level infrastructure construction | Moved into feature composition modules |
| Medium | Ambiguous password toggle / inaccurate recovery promise | Corrected; component regression authored |
| Medium | Broken picker native mock | Corrected; actual Jest execution blocked |
| Medium | Reproducibility and runtime evidence | Safe local preparation complete; cannot generate trusted lock/native/backend evidence in this environment |

No destructive cache/database/session reset, unrequested deployment, private SDK logout workaround, fabricated screenshots, dependency removal without evidence or broad business-rule rewrite was performed. Remaining medium/high items requiring a live backend, native tools, package access or broader SDK/profile/history implementation are explicitly not reported as fixed.

## Exact file manifest for this audit

Added:

- `.github/workflows/quality.yml`
- `docs/capstone-audit.md`
- `scripts/tests/capstone-regressions.test.mjs`
- `src/data/local/secure-session-storage.ts`
- `src/data/local/__tests__/secure-session-storage.test.ts`
- `src/lib/auth-storage.ts`
- `src/types/environment.d.ts`
- `src/features/auth/services/logout-with-cleanup.ts`
- `src/features/auth/services/__tests__/logout-with-cleanup.test.ts`
- `src/features/auth/hooks/__tests__/use-auth-mutations.test.tsx`
- `src/features/achievements/services/achievement-dependencies.ts`
- `src/features/home/services/dashboard-dependencies.ts`
- `src/services/query/persistence-policy.ts`
- `src/services/query/write-invalidation.ts`
- `src/services/query/__tests__/persistence-policy.test.ts`
- `src/services/error-reporting/__tests__/error-reporter.test.ts`

Changed:

- `app.json`
- `package.json`
- `README.md`
- `docs/testing.md`
- `docs/performance-audit.md`
- `docs/test-report.md` (generated)
- `scripts/run-test-verification.mjs`
- `scripts/tests/workout-tracking.test.mjs`
- `src/lib/supabase.ts`
- `src/lib/query-client.ts`
- `src/components/providers/app-providers.tsx`
- `src/components/providers/query-provider.tsx`
- `src/components/feedback/error-boundary.tsx`
- `src/services/error-reporting/error-reporter.ts`
- `src/features/auth/components/password-input.tsx`
- `src/features/auth/hooks/use-auth-mutations.ts`
- `src/features/auth/screens/__tests__/auth-forms.test.tsx`
- `src/features/workouts/hooks/use-workouts.ts`
- `src/features/workouts/components/session-lifecycle-provider.tsx`
- `src/features/workouts/services/session-sync-service.ts`
- `src/features/workouts/services/__tests__/session-sync-service.test.ts`
- `src/features/workouts/components/__tests__/workout-picker.integration.test.tsx`
- `src/features/social/hooks/use-social.ts`
- `src/features/challenges/hooks/use-challenges.ts`
- `src/features/leaderboards/hooks/use-leaderboard.ts`
- `src/features/achievements/hooks/use-achievements.ts`
- `src/features/achievements/components/achievement-lifecycle.tsx`
- `src/features/home/hooks/use-dashboard.ts`
- `src/features/progress/hooks/__tests__/use-photos.test.tsx`
- `src/features/progress/hooks/__tests__/use-measurements.test.tsx`

Ignored execution logs/results live under `artifacts/`; npm attempted-install diagnostics live under `.npm-cache/`. No database migration was changed by this audit.
