# FitHub performance audit

Audit completed October 8, 2026. Changes target known identity, cache and lifecycle issues. No scoring, rankings, achievement rules, synchronization payloads or database schema changed. Native frame rate, decoded-image memory, production bundle size and real backend latency have **not** been measured in this workspace.

## Seven-screen review

| Area | Existing strengths | Changes / decisions |
| --- | --- | --- |
| Exercise library | Server pages of 20, debounced search, memoized cards, stable IDs, FlatList 6 initial / 8 per batch / window 7; cached details | Keep old results mounted during debounce with an explicit updating label; avoid repeated image teardown on each keystroke. Short-lived, non-persisted search/filter caches; iOS early image resizing. |
| Friends and user search | Server pagination, debounce, memoized UserCard, owner-scoped keys | Cache flattened pages and stabilize render callbacks. Keep search rows during debounce. Stop automatic end-of-list retries after a failed next page. FlatList 10 initial / 8 per batch / window 7. Public avatar caching retained. |
| Leaderboard | Server dense ranks, score/UUID versioned cursors, podium/current user fetched independently; no React sorting | Focus/foreground/online-only subscriptions and fallback timer. Single-flight burst refreshes; conflicts use the same coordinator. Reset obsolete multi-page chains without cancelling initial/one-page requests. Remove one-way five-page eviction that prevented scrolling back to earlier rows. |
| Progress photos | Private bucket, 1600px compressed originals, separate 320px JPEG thumbnails, virtualized date grid | Reuse signed-URL queries for five minutes instead of gcTime 0. Disable URL polling when blurred/backgrounded. Stabilize image styles so selection does not rerender image children. Four rows per batch. Guard load-more against concurrent refresh. Missing legacy thumbnails show an error instead of downloading originals in the grid. |
| Workout history | Durable local sessions and virtualized display | Owner-scoped, stable metadata-only selector; memoized rows; stable separator/callbacks. Load 30 local rows at a time without deleting earlier rows or saved sessions. Set/notes edits that do not change displayed metadata do not publish a new history selection. |
| Challenge participants | Detail/leaderboard routes share server-ranked, paginated leaderboard; bounded participant preview | Reuse leaderboard lifecycle improvements. Legacy challenge realtime hook now uses the shared focused coordinator instead of independent overlapping invalidations. Invitation picker reuses flattened friend pages and tunes batches. |
| Dashboard | One consolidated snapshot RPC, capped templates/challenges/activity, six virtualized sections | Stale-aware fetchQuery reuses in-flight requests instead of unconditional focus refetch. Clock/timezone changes fetch the current date's key, not yesterday's captured key. Stable owner-ID dependencies; five-minute inactive cache. Existing small section memos retained without adding deep equality or blanket hooks. |

FlatList remains appropriate without evidence supporting another native list dependency. It does not accept FlashList's estimatedItemSize. No fabricated fixed getItemLayout: rows wrap and must support dynamic text. Rendering counts/window sizes are starting settings, **not device-tuned results**. Images load when virtualized rows mount; no eager prefetch of entire galleries/lists. No list videos autoplay.

## Measurements reproduced locally

Run `npm run performance:benchmark`. Node v24.21.0, Windows x64; 50 warmups plus 250 measured updates per scenario. The script reconstructs the old filter/sort implementation and executes the actual new TypeScript selector. Updated session objects contain changed notes but unchanged visible history metadata. Input-copy time is excluded for both implementations.

| Sessions / order | Before median / p95 (ms) | After median / p95 (ms) |
| --- | --- | --- |
| 500 chronological | 0.022 / 0.040 | 0.027 / 0.029 |
| 500 shuffled | 0.102 / 0.162 | 0.032 / 0.044 |
| 5,000 chronological | 0.227 / 0.328 | 0.235 / 0.276 |
| 5,000 shuffled | 0.747 / 0.959 | 0.277 / 0.322 |

Ordered histories have essentially unchanged CPU cost, with a slight median regression in this run. Unordered histories avoid repeated sorting. In all four scenarios, before returned 250 changed references; after returned **zero**. This establishes selector stability, not a measured React render count or FPS improvement. The new selector still scans O(n), retains O(n) small metadata, and pays a new projection/sort when displayed metadata changes or pagination/owner changes. Cold load, persistence validation and rendering are excluded. Do not enforce wall-clock benchmark thresholds in CI; machine load/JIT vary.

Deterministic lifecycle tests send 1,000 events before a refresh and another 1,000 while it is in flight: one initial refresh plus one trailing refresh. Inactive lifecycles own zero channels/timers; late callbacks cannot restart work. These are actual scheduler executions with fake clocks, not native network measurements.

## Images and privacy

Public exercise thumbnails and avatars retain Expo Image memory/disk caching and stable recycling keys. Explicit bounded containers already allow default downscaling. `enforceEarlyResizing` additionally requests early container-sized resizing on iOS; this is not a guarantee about every platform's decoder or a reduction in network bytes. See [Expo SDK 54 Image](https://docs.expo.dev/versions/v54.0.0/sdk/image/).

Private photo pixels retain cachePolicy none. Signed URL query data stays only in the owner-scoped in-memory query cache, never in AsyncStorage; logout/account change already clears it. URLs expire after 300 seconds, become stale after 210 seconds, and refresh at 240 seconds only for focused, foreground observers. Inactive queries are collected after 300 seconds. A renewed URL can recover from failure of an earlier URL. Remounts reuse a still-fresh URL but still download uncached photo bytes; this privacy/performance tradeoff is intentional. No public URLs or disk-persisted private-image cache were introduced.

Uploads already generate 320px thumbnails at JPEG quality 0.65 and originals capped at 1600px/quality 0.75, enforce byte limits, and release processing contexts/scratch files. These useful existing optimizations were retained. External avatar URLs can still reference large originals: early resizing does **not** solve their bandwidth cost. Producing versioned avatar/exercise variants at upload/CDN level is a remaining media-pipeline task; arbitrary URL parameters or paid Storage transformations were not assumed.

## Query and refresh policy

| Query | staleTime | inactive gcTime | Persistence / refresh |
| --- | --- | --- | --- |
| Exercise search/filter pages | 5 min | 10 min | Not persisted; no automatic app-focus/reconnect multi-page refetch |
| Exercise detail / filter catalog | 30 min / 1 hour | Existing 24 hours | Existing offline cache retained |
| User search | 30 sec | 5 min | Not persisted; debounce + explicit search/remount |
| Friends/request lists | 60 sec | 10 min | Not persisted; mutations invalidate; pull-to-refresh/remount |
| Leaderboard | 30 sec | 10 min | Not persisted; focused realtime + 60-sec fallback + explicit refresh |
| Photo metadata pages | 60 sec | 10 min | Not persisted; mutations/pull-to-refresh/remount |
| Private photo URLs | 210 sec | 300 sec | Not persisted; focused refresh, no background polling |
| Dashboard | 30 sec | 5 min | Not persisted; stale-aware focused refresh every minute |

Bulk infinite-query automatic app-focus/reconnect refetches are disabled for these lists because they otherwise refetch every accumulated page sequentially. See [TanStack infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries). Pending paused fetches can still resume on connectivity restoration. Friends/photos/exercise lists update on mutations where applicable, explicit refresh and stale remount, not every app resume; this is an intentional freshness/network tradeoff. Explicit pull-to-refresh for those lists can still refetch all loaded pages; unlike a background storm, it is user-requested. Leaderboard refresh always restarts the cursor chain instead.

No maxPages added to forward-only lists: evicting their first pages without a previous-page implementation makes earlier results disappear. Loaded page metadata grows as users deliberately scroll, then inactive caches expire. Extremely long browsing sessions still need measured backward paging or a deliberate paged-window UI. Virtualization bounds mounted views, not total query data.

The global 24-hour gcTime remains for offline-compatible persisted server queries; it was not indiscriminately reduced. The subsequent capstone audit advanced the cache buster to v3-no-mutation-secrets: old query snapshots are discarded, and mutations are never persisted because their variables can contain credentials. Durable SQLite workouts, sessions, outbox, routing intents, preferences and SDK credential storage are separate. Dependent dashboard/leaderboard aggregates now receive owner-scoped write invalidation; achievement channels and polling are foreground/online-only.

## Lifecycles and rerenders

`useFocusedRealtime` owns a `ForegroundRefresh` instance. Blur, offline detection, inactive/background state, account change and unmount remove its channel, pending debounce and polling interval. Resume subscribes once and schedules catch-up. In-flight requests may finish; suspension suppresses trailing work rather than deleting persisted data. Supabase repositories already suppress late callbacks and remove channels; those guards were preserved.

The workout display clock now stops ticking on blur/background, updates immediately on resume, and removes its AppState listener on cleanup. Elapsed/rest time still uses persisted absolute timestamps, so suspending display ticks does not pause training or notifications. Dashboard focus timers/listeners, global NetInfo/AppState listeners and development monitoring unsubscribe on cleanup. Existing video players release on detail blur/unmount and pause on background; camera permission listeners and notification listeners retain their cleanup. No evidence of an unmount leak was established; hidden-screen resource work was the concrete finding.

Memos added only at identity-sensitive boundaries: flattened pages, row callbacks, history metadata/rows and private-photo image style/source (loading feedback does not recreate an unchanged source). The small dashboard still rerenders some sections on its minute clock; no costly comparator added without a native trace. Business calculations, forms and arbitrary leaf controls were not blanketed in useMemo/useCallback.

## Bundle and monitoring

Run `npm run performance:dependencies`. A static production reference/config scan found **33 referenced runtime dependencies**, plus **5 necessary native/web integration dependencies**: Expo Router splash integration, native screens, Reanimated worklets, React Native Web and React DOM. Zero removal candidates found. No dependencies added/removed; no icon pack, video library, camera implementation or chart library replaced without measurement. Tree-shaking, native APK/IPA size, route-loading and Hermes startup behavior require a real release export/build, not source counts. The script does not claim to resolve peer versions or measure package weight.

Development QueryProvider subscribes to query-cache events and emits aggregate diagnostics at most once per minute with new fetches: total fetch starts/failures, bounded in-flight count, p95 query duration and cached-query count. It retains at most 256 starts and 120 duration samples, no query objects/payloads. Output contains no keys, identifiers, credentials, signed URLs or error text. Duration includes retries/pauses, not just HTTP time. The monitor/listener/timer are disposed with the provider. Release builds do not start monitoring; no remote analytics transport was added.

## Verification and remaining work

- `node --experimental-vm-modules --test --test-isolation=none scripts/tests/*.test.mjs`: **239 passed**. Eight new performance tests plus the missing-thumbnail regression. Native APIs and some schema boundaries are stubbed by existing core harnesses; this is not the full Jest/RNTL suite.
- `npm run performance:benchmark`: passed; figures above are one reproducible run, not native measurements.
- `npm run performance:dependencies`: passed; no removal candidates.
- `npm run performance:syntax`: 176 .ts files parsed, **syntax only**, no TSX/module resolution/type checking.
- `npm run db:verify`: static security/integrity checks passed. No SQL changes or live database load test.
- Typecheck, Expo lint and Jest were attempted: executables tsc/expo/jest are absent because dependencies are not installed. New/updated RNTL tests for dashboard deduplication, photo URL reuse/blur, workout clock cleanup, debounce and realtime hook cleanup remain **unexecuted**.

Largest remaining local-history scaling risk: SQLite restoration still reads all session JSON into Zustand, and each save validates the full session collection. UI pagination/projection does **not** fix those costs. Optimizing this safely requires paged metadata reads and incremental validation that preserves duplicate-ID/one-active-workout invariants and outbox atomicity; those durability safeguards were not weakened for the audit.

Before release, install dependencies and run typecheck, lint, Jest and existing Maestro flows. Use release Android/iOS builds plus React Native DevTools/Hermes profiling on representative small Android/iPhone devices. For each list, use large permitted fixtures, scroll ten pages, change filters, navigate away/back and repeat twenty times. Record before/after JS/UI frame time, commit counts, blank cells, image bytes/decoded memory, network calls and channel/listener counts. Keep requests throttled while focused; verify zero new subscription work on blur/background/offline. Compare memory after returning to the same screen and GC, not just a growing high-water mark.

Profile cold startup separately, and obtain a Metro bundle/source map export plus native build size before considering dependency replacement or lazy-loading changes. Inspect the global achievement lifecycle's periodic reconcile/board refresh and mutation invalidation breadth against actual query diagnostics; neither was changed speculatively. Do not present source-level fixes as proof that the release meets a frame-budget or memory target.

## Exact file manifest for this audit

Added:

```text
docs/performance-audit.md
scripts/audit-dependencies.mjs
scripts/benchmark-performance.mjs
scripts/check-typescript-syntax.mjs
scripts/tests/performance-audit.test.mjs
src/features/home/hooks/__tests__/use-dashboard.test.tsx
src/features/home/services/dashboard-clock.ts
src/features/workouts/components/session-history-row.tsx
src/features/workouts/hooks/__tests__/use-workout-clock.test.tsx
src/features/workouts/hooks/use-workout-clock.ts
src/features/workouts/services/session-history-selector.ts
src/hooks/use-focused-realtime.ts
src/services/performance/query-performance.ts
src/services/realtime/foreground-refresh.ts
src/services/realtime/realtime-refresh.ts
```

Changed:

```text
README.md
docs/leaderboards.md
package.json
scripts/tests/progress-photos.test.mjs
src/components/providers/query-provider.tsx
src/features/challenges/components/invite-friends-picker.tsx
src/features/challenges/hooks/__tests__/use-challenges.test.tsx
src/features/challenges/hooks/use-challenges.ts
src/features/exercises/components/exercise-card.tsx
src/features/exercises/hooks/use-exercises.ts
src/features/exercises/screens/__tests__/exercise-library-screen.test.tsx
src/features/exercises/screens/exercise-library-screen.tsx
src/features/home/hooks/use-dashboard.ts
src/features/leaderboards/components/leaderboard-avatar.tsx
src/features/leaderboards/hooks/__tests__/use-leaderboard.test.tsx
src/features/leaderboards/hooks/use-leaderboard.ts
src/features/leaderboards/screens/leaderboard-screen.tsx
src/features/leaderboards/services/leaderboard-presentation.ts
src/features/leaderboards/services/realtime-refresh.ts
src/features/progress/components/photo-grid-card.tsx
src/features/progress/components/private-photo-image.tsx
src/features/progress/hooks/__tests__/use-photos.test.tsx
src/features/progress/hooks/use-photos.ts
src/features/progress/screens/photo-gallery-screen.tsx
src/features/progress/services/photo-service.ts
src/features/social/components/user-card.tsx
src/features/social/hooks/use-social.ts
src/features/social/screens/social-screens.tsx
src/features/social/screens/user-search-screen.tsx
src/features/workouts/hooks/use-workout-session.ts
src/features/workouts/screens/session-history-screen.tsx
```

No files deleted, no user data removed, no Supabase deployment or external writes performed.
