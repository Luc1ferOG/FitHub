# FitHub

**FitHub – Fitness Challenge Hub** is a university capstone mobile application for planning workouts, recording training, tracking personal progress and building consistency through social fitness challenges. It targets Android and iOS with React Native, Expo and strict TypeScript.

Feature implementations, SQL migrations and test suites are included. This is a capstone implementation, not a verified production release: dependency-free checks pass, but full Jest coverage, TypeScript, lint, live PostgreSQL and native-device checks remain blocked or unexecuted. See the [test report](docs/test-report.md) for current counts and the [strict capstone audit](docs/capstone-audit.md) for grading evidence and remaining requirements.

## Features

- **Authentication:** registration, login/logout, email confirmation, password recovery, session restoration and protected routes.
- **Exercise library:** debounced search; muscle, equipment and difficulty filters; paginated browsing; instructions, form tips, common mistakes and optional video tutorials.
- **Custom workouts:** create, edit, duplicate and delete templates; configure sets, reps, weight, rest and notes; drag-to-reorder with accessible move buttons.
- **Workout tracking:** elapsed/rest timers, editable sets, completion feedback, previous performance, provisional PRs, summaries and locally saved history.
- **Social fitness:** user search, public-safe profiles, friend requests, acceptance/rejection and friend management.
- **Challenges:** workout count, lifted volume, exercise repetitions and workout minutes; public, friends-only or invite-only participation; automatic scoring from saved workouts.
- **Leaderboards:** server-ranked challenge boards, opt-in friends boards, tied ranks, podiums and current-user highlighting.
- **Body progress:** weight, body fat and circumference measurements; metric/imperial entry; comparisons and period-based charts.
- **Progress photos:** camera/gallery capture, private uploads, date/pose grouping, fullscreen viewing and before/after comparison with available measurements.
- **Achievements:** 17 active badges across consistency, streaks, strength, social and volume categories; centralized event-driven evaluation and unlock presentation.
- **Notifications and links:** local rest alerts, in-app events, optional push delivery and authenticated notification/deep-link navigation.
- **Home dashboard:** consolidated workout/activity totals, recent templates, active challenges, latest achievement and bounded activity feed.
- **Offline-first workout logging:** cached templates, durable active sessions, completed-workout queue and idempotent synchronization after reconnect.
- **Shared design system:** light/dark/system themes, reusable controls, loading/empty/error states and reduced-motion-aware feedback.

Seeded exercises contain coaching text but do not ship reviewed tutorial videos or thumbnail assets. Missing media is handled explicitly. Calorie estimation and a global leaderboard are not implemented.

## Screenshots

Screenshots have not been captured yet. Add genuine screenshots from the native app under `docs/screenshots/`; do not substitute mockups for working features or include real emails, health data, access tokens or private photos.

| Placeholder filename | Screenshot to include |
| --- | --- |
| `01-authentication.png` | Login or registration, including clear field labels and validation feedback |
| `02-home-light.png` | Home greeting, weekly activity and quick-start cards in light mode |
| `03-home-dark.png` | The same dashboard in dark mode |
| `04-exercise-library.png` | Search/filter controls and a populated exercise list |
| `05-workout-builder.png` | Exercise configuration and reorder handles |
| `06-active-workout.png` | Completed set, volume/progress, rest timer and subtle offline indicator |
| `07-workout-summary.png` | Saved duration, sets, reps, volume and server-confirmed rewards |
| `08-challenge-leaderboard.png` | Challenge goal, participant progress, podium and highlighted current user |
| `09-body-progress.png` | Latest measurement, changes and a readable chart |
| `10-photo-comparison.png` | Consented demonstration photos or clearly labeled synthetic fixtures, dates and comparison values |
| `11-achievements.png` | Unlocked/locked badges and progress toward a locked goal |

Use a consistent device frame/size, supply descriptive alt text when embedding the images, and include a small-screen/large-text example in the capstone appendix. See the [capture checklist](docs/screenshots/README.md).

## Technology Stack

| Technology | Role in FitHub |
| --- | --- |
| React Native 0.81 / React 19 | Native Android/iOS UI with shared feature components |
| Expo SDK 54 | Native integrations, configuration plugins, development tooling and bundling |
| TypeScript | Strict contracts between UI, services, domain models and repositories |
| Expo Router | File-based authentication, tabs, nested routes and native deep-link handling |
| Supabase / PostgreSQL | Auth, relational persistence, RLS, transactional RPCs, Realtime and Storage |
| Zustand | Client-owned workout drafts, appearance preferences and local navigation/UI state |
| TanStack Query | Server fetching, account-scoped caching, pagination, mutations and invalidation |
| React Hook Form / Zod | Local form state, actionable validation and typed input schemas |
| Reanimated / Gesture Handler | Set/achievement feedback, reduced-motion support and workout reordering |
| Expo SQLite / AsyncStorage / NetInfo | Durable offline data/outbox, persisted preferences/query cache and connectivity signals |
| Expo Camera, Image Picker, Image Manipulator, Image, Video, Notifications | Capture, compression, image/video presentation and notification delivery |
| Jest / React Native Testing Library / Maestro | Unit, component, integration and real-device workflow tests |

`package.json` is authoritative for dependency versions; these versions describe this repository, not the latest available releases.

## Architecture

FitHub is organized by feature, with shared infrastructure outside feature modules. Thin route files delegate to screens; screens use hooks and services rather than calling Supabase. Shared controls handle presentation and accessibility without owning domain rules.

```text
Expo Router routes / feature screens / reusable components
                         |
                         v
                Feature hooks and forms
                 /                    \
       TanStack Query             Zustand client state
                 \                    /
                         v
                  Service layer
            (rules and orchestration)
                         |
                         v
          Repository interfaces + domain models
                         ^
                         | implemented by
                  Data-layer adapters
                 /                   \
        Supabase / PostgreSQL       SQLite / local cache
```

The **repository pattern** isolates persistence behind typed contracts. Supabase adapters translate database records/errors into application models; SQLite adapters manage local durability. Services receive interfaces through composition roots, allowing tests to substitute repositories and a future backend to replace Supabase without rewriting screens.

The **service layer** centralizes workout rules, unit conversion, social transitions, challenge orchestration and achievement events. Security-sensitive facts—ownership, scoring, PR confirmation and unlocks—are validated again or derived by trusted database functions. Client validation improves usability; it is never an authorization boundary.

Form state stays in React Hook Form. Cross-feature infrastructure handles error normalization, notifications, media, foreground lifecycle and query monitoring. New feature directories should be introduced only when needed, not filled with empty abstractions.

## Database

Ordered migrations in `supabase/migrations/` define tables, constraints, indexes, RLS, Storage policies and transactional RPCs. `supabase/seed.sql` contains 25 exercises and 17 active achievements plus one retained legacy definition. No real user accounts or private progress photos are seeded.

```text
auth.users -> profiles
profiles   -> workouts -> workout_exercises -> exercises
profiles   -> workout_sessions -> workout_session_exercises -> workout_sets
                   |
                   +-> optional workout template reference
profiles   <-> friendships <-> profiles
profiles   -> challenges -> challenge_participants <- profiles
                 |
                 +-> challenge_progress -> optional workout_session
profiles   -> body_measurements / progress_photos / notifications
profiles   -> user_achievements <- achievements
```

- Profiles reference Auth identities. Private profile health/demographic fields are owner-readable; the `public_profiles` projection exposes only public-safe columns.
- Workout templates contain ordered exercise occurrences, allowing the same exercise with different configurations. Sessions preserve independent exercise/set history.
- Challenges hold metric/target/date/visibility rules; participant rows hold current progress and server-calculated ranks. Scoring evidence prevents the same session being credited twice.
- Friendships enforce one unordered user pair and controlled request transitions. Achievement awards are unique per user/achievement.
- Private receipts, event/notification jobs and leaderboard aggregates support idempotency and efficient queries without exposing privileged writes to clients.

Foreign keys, unique/check constraints and bounded values enforce integrity. Authenticated clients cannot directly award achievements or manufacture challenge progress/history totals. RLS and identity-checked RPCs enforce owner boundaries. Deleting a workout template removes its template children but sets the session template reference to null, preserving history. Referenced exercises cannot be deleted casually.

Canonical units are **kilograms, centimetres, metres and seconds**; lifted volume is kg × reps. Display preferences do not change stored units. Challenge dates and workout streaks use UTC. See the [database guide](supabase/README.md) and [challenge rules](docs/fitness-challenges.md) for policy/deletion details.

## Authentication

Registration validates username, display name, email, password and confirmation with Zod. The Auth repository sends username/display-name metadata; a database trigger creates the profile transactionally with beginner experience and metric units. When email confirmation is enabled, registration explains the next step instead of assuming an authenticated session.

Supabase's SDK owns session persistence, token refresh and PKCE recovery. `AuthSessionManager` resolves restoration and auth events; route guards keep protected content hidden while initialization is unresolved. Passwords remain in transient form/request memory and are not saved in application documents or logs.

The native Supabase SDK storage adapter now uses Expo SecureStore, not plaintext AsyncStorage. Large opaque SDK values are split into Unicode-safe chunks; a committed manifest selects the complete generation. Existing AsyncStorage credentials migrate only after encrypted writes succeed, and a logout tombstone prevents stale legacy credentials from being restored. Web previews retain AsyncStorage's unencrypted threat model. Cached offline identity is only a local routing aid; it cannot authorize server requests, and synchronization requires valid SDK authorization.

Install the added SecureStore dependency and rebuild native binaries to apply its Android backup configuration. Storage protocol regressions pass, but device Keychain/Keystore behavior, locked-device access and Auth SDK integration still require native verification. SecureStore is not the persistence store for irreplaceable workout data; see its [platform and persistence limitations](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).

Query-cache snapshots never persist mutations: paused mutation variables may include passwords. Offline workout writes use SQLite instead. Auth mutations explicitly disable retries. Push-token cleanup failure no longer prevents an SDK logout attempt; offline SDK logout and stalled network requests still need device/SDK verification before claiming guaranteed offline sign-out.

Configure `fithub://reset-password` in the Supabase Auth redirect allowlist. Deep links support `fithub://challenge/{id}`, `fithub://workout/{id}` and `fithub://user/{id}`. Logged-out users go to Login with their validated intended destination preserved; after login it takes precedence over Home. Invalid, inaccessible or deleted records show an understandable unavailable state. Notification intents are recipient-scoped. Details are in [notifications and deep links](docs/notifications-deep-links.md).

## Offline Support

After signing in and downloading a workout once, users can open it, start/log/finish a session, close the app and restore it without internet. SQLite stores account-scoped templates, session documents and a durable synchronization outbox independently of expiring server-query snapshots. Zustand publishes workout changes only after persistence commits successfully.

Each queued completed-workout operation contains local/user IDs, type/entity, immutable payload, creation time, retry count, next attempt, status and error metadata. Statuses are `pending`, `syncing`, `synced` and `failed`.

```text
Log locally -> commit session -> finish/review -> commit frozen session + outbox
                                                           |
                                          reconnect / foreground / explicit retry
                                                           |
                                   claim operation -> authenticated sync RPC
                                                           |
                                     commit server history, effects and receipt
                                                           |
                                 commit local receipt + queue acknowledgment
```

The worker uses single-flight processing, durable claims and bounded exponential backoff for transient failures. A stable session UUID and canonical payload receipt prevent duplicate sessions, challenge credit or achievement unlocks—even when the server commits but its response is lost. Conflicting payloads or terminal authorization/validation errors retain local data for visible recovery rather than overwriting history.

Local drafts remain authoritative on their device. Completed aggregates upload if not already present; matching remote submissions reuse the original receipt. Template edits use server versions and stale-write checks. Profile/settings writes are not added to the offline queue; the implemented queue handles finalized workouts only.

Registration, uncached data, template/social writes and media uploads require connectivity. Sync resumes on reconnect/foreground, not continuously while the OS suspends the app. SQLite is sandboxed but unencrypted; uninstalling/clearing app storage loses unsynchronized data. See [offline design and conflict rules](docs/offline-capability.md).

## Realtime Features

Saved workouts update eligible challenge progress automatically on the server. Supabase Realtime signals leaderboard/membership changes, and a shared refresh coordinator coalesces bursts into bounded, single-flight refetches. SQL calculates dense tied ranks, stable ordering and versioned paginated results; React renders returned ranks rather than sorting a huge participant list after every event.

Subscriptions/fallback timers run only for relevant focused, foreground, online screens and are released on blur/unmount. Versioned cursors are reset after ranking changes; fallback refresh handles missed events/reconnects. Friends leaderboard sharing is opt-in. See [leaderboard architecture](docs/leaderboards.md) for pagination and privacy.

## Media Handling

Expo Camera and Image Picker handle camera/gallery permissions, limited/denied access and cancellation. Images are converted to compressed JPEGs: originals are capped at a 1600-pixel long edge with a smaller fallback, and dedicated thumbnails at 320 pixels. Byte limits prevent oversized uploads; processing resources and owned scratch files are released.

Progress-photo objects live in the **private** `progress-photos` bucket with owner-scoped Storage policies and metadata. Database URL-named fields store object paths, not public URLs or expiring signed links. Owner-authenticated reads create short-lived signed URLs; these are bearer access links and must not be logged or shared. Signed URLs remain in non-persisted, account-scoped memory, and private image disk caching is disabled.

Recoverable reservation/upload/finalization and staged deletion handle uncertain network responses. The gallery loads thumbnails, while full-resolution media is requested for fullscreen/compare. Measurements are compared only when the selected dates have data; the app does not infer body measurements from images. Exercise tutorials use directly playable media URLs, manual playback, native controls/fullscreen where supported, background pause and disposal when leaving the screen. See [photo security and lifecycle](docs/progress-photos.md).

## State Management

**Zustand = client state.** It owns active workout drafts, local preferences, connectivity presentation and pending navigation intent. These represent user/device state, not another copy of server records. Critical workout state persists through SQLite; appearance/query persistence uses the appropriate local adapters.

**TanStack Query = server state.** It owns fetching, cache freshness, pagination, cancellation, mutations and invalidation. Keys include account/entity/filter/search context as appropriate. Safe optimistic template/social changes roll back on failure; server-generated identities and irreversible media workflows wait for authoritative responses. Private query state is cleared when identity changes.

The persisted query cache selectively retains successful data for offline reads and excludes transient searches/private signed URLs. It complements, but does not replace, the durable workout database/outbox. Avoid mirroring server lists in Zustand or turning every form field into global state.

## Accessibility

- Shared controls provide descriptive labels, hints, semantic roles and disabled/busy/selected states.
- Touch targets use the shared minimum; platform/layout-aware controls provide larger targets where appropriate.
- Screen readers receive meaningful set, chart, progress and leaderboard descriptions; decorative icons are excluded.
- Theme tokens standardize contrast, typography and spacing across light/dark/system modes.
- Flexible layouts, wrapping text, safe areas and keyboard avoidance support small screens and larger font settings.
- Reduced-motion preferences limit nonessential animation; accessible move buttons provide an alternative to drag-and-drop.
- Loading, empty, permission-denied and error states explain recovery without relying on color alone.

These are implementation practices, not a claim of certified accessibility compliance. VoiceOver/TalkBack, contrast and large-text checks on target devices remain necessary. See the [screen-by-screen UI/UX audit](docs/ui-ux-audit.md).

## Performance

The implementation uses tuned **FlatList**, not an uninstalled FlashList dependency. Long collections have stable IDs, bounded pages/batches and memoized rows where identity stability matters. Search is debounced; normalized filters participate in query keys. Detail/summary projections avoid downloading every record or full image for a thumbnail.

Public avatars/exercise thumbnails use Expo Image caching/recycling; private photos use optimized thumbnails without persistent pixel caching. Query stale/collection times and selective persistence reduce unnecessary requests. The dashboard uses one consolidated snapshot RPC instead of a separate request per widget. History selectors preserve metadata identity when set/notes edits do not change visible rows; timer ticks are isolated from full tracker rerenders.

Foreground/focus-aware lifecycle management cleans up listeners, subscriptions, timers and video players. Realtime event bursts are coalesced; failed pagination requires deliberate retry. Development-only monitoring emits bounded aggregate query timings/counts without keys, payloads or signed URLs. Native FPS, memory, bundle size and backend latency have not been established by JavaScript-only checks.

```sh
npm run performance:benchmark
npm run performance:dependencies
npm run test:performance-core
```

See the [performance audit](docs/performance-audit.md) for measurements, tradeoffs and remaining device profiling.

## Testing

Unit tests cover volume/duration/PR semantics, challenge eligibility/progress, ranking ties, achievements, unit conversions, validation and offline retry/persistence. React Native Testing Library tests accessible forms/cards, loading/error behavior, selection and navigation. Client integration workflows use real services with external repository boundaries replaced; rollback-only SQL tests exercise actual RPCs, constraints, RLS and automatic scoring on local PostgreSQL.

Maestro defines four native E2E scenarios: registration/login → Home; workout creation → exercise selection → save/start/finish/summary; challenge creation/join/leaderboard; measurement entry → progress. These use an isolated backend and real native build, not mocked networking.

```sh
npm run test:core          # Dependency-free Node 24+ behavior/SQLite/static checks
npm test -- --runInBand    # Jest + React Native Testing Library
npm run test:coverage      # Coverage report; 70% gate in all four dimensions
npm run typecheck
npm run lint
npm run db:verify          # Static migration/security checks, not SQL execution
npm run test:database      # Migrated local DB + psql + FITHUB_TEST_DATABASE_URL
npm run test:e2e           # Maestro + device/native build + isolated test fixtures
npm run test:verify        # Combined checks and report; incomplete checks exit nonzero
```

Current counts are recorded in the [test report](docs/test-report.md). Core tests include static checks and some library-boundary stubs, so their count is not native validation or coverage. **70% is an enforced target, not a measured result.** Package installation was blocked by an incomplete offline npm cache; Jest, TypeScript and Expo lint executables are missing. Maestro/live SQL/native checks remain unavailable. Setup, mock policy and fixture provisioning are in the [testing guide](docs/testing.md).

`npm run test:integration` runs explicitly named client integration suites. Production validation commands are `production:config`, `production:dependencies`, `production:android` and `production:ios`; exports validate production JavaScript bundling, not signed APK/IPA installation or native compilation. The combined verification runner attempts all four. The new CI workflow requires a reviewed `package-lock.json` and deliberately fails until one can be generated on a network-enabled machine; it does not claim reproducibility from an unlocked install.

## Installation

### Prerequisites

Install Git, **Node.js 24+** (required for the dependency-free runner), npm, a [Supabase CLI installation](https://supabase.com/docs/guides/local-development/cli/getting-started) available as `supabase` on PATH, and a running Docker-compatible container runtime for the local backend. Android native builds require Android SDK/JDK tooling; local iOS builds require macOS/Xcode. Maestro and `psql` are needed only for their corresponding tests. The [Supabase local-development guide](https://supabase.com/docs/guides/local-development) documents CLI/container setup.

### 1. Clone and install packages

Replace `YOUR_REPOSITORY_URL` with this capstone's actual Git remote; no published remote URL is assumed.

```sh
git clone YOUR_REPOSITORY_URL fithub
cd fithub
npm install
```

This workspace does not currently include a generated lockfile because installation was blocked. Once installation succeeds, review and commit the resulting lockfile; use `npm ci` for reproducible subsequent installs. Package installation requires network access or a complete npm cache.

### 2. Create local environment configuration

On macOS/Linux:

```sh
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.local
```

Edit `.env.local` with the **public project API URL and anonymous client key** from your local instance/project. `.env.local` is ignored. Do not use the service-role key. See Environment Variables below; values are validated at app startup.

### 3. Start Supabase, apply migrations and seed

The repository already includes `supabase/config.toml`; do not reinitialize/overwrite it. From the repository root, with Docker running:

```sh
supabase start
supabase db reset
supabase db lint
```

**Warning:** `supabase db reset` destroys data in the selected local development database. Use a disposable local instance; do not use reset against a hosted/production project. The command applies every migration in order and automatically runs `supabase/seed.sql`, as configured in `config.toml`. No separate manual seed is required locally. Do not skip the separate achievement-enum migrations.

Use the API URL/client key reported by your local setup to finish `.env.local`; keep administrative credentials private. Local Studio normally uses port 54323 and the API 54321. For an Android emulator, the API host address is generally `10.0.2.2`, not the emulator's `localhost`; physical devices need a reachable host address on a trusted network. Restrict development backend access and never expose admin credentials or the local stack publicly.

For a **new isolated hosted project** instead, create the project in Supabase, select its URL/public anonymous key, then review/apply migrations and seed with the linked CLI workflow:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run --include-seed
supabase db push --include-seed
```

These commands change the linked remote database: confirm the intended project and review migrations/seed first. Auth redirect/email settings and optional push secrets/schedules require separate configuration. Follow the [CLI deployment reference](https://supabase.com/docs/reference/cli/supabase-db-push) and [database guide](supabase/README.md). Exercise tutorial/thumbnail media must be uploaded and curated separately.

### 4. Configure Auth and optional delivery

Allow `fithub://reset-password` in Supabase Auth redirect settings. Configure email confirmation and email delivery appropriate to your environment; do not disable production confirmation to make tests pass. Native link destinations still require valid authentication and RLS authorization.

In-app notifications/database challenge scoring work independently of remote push delivery. Optional remote push requires an Expo/EAS project ID, native platform credentials, explicit user permission, the Edge function and its protected scheduler/secrets. Do not assume those services are provisioned by `db reset`. Follow [notification deployment](docs/notifications-deep-links.md) and [challenge deployment](docs/fitness-challenges.md). SDK 54 remote push is unavailable in Android Expo Go; see [Expo Notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/).

### 5. Start Expo or compile the native app

```sh
npm start
```

Use Expo's terminal instructions to open a supported runtime. For the native app identity/custom scheme used by Maestro, compile and install the application:

```sh
npx expo run:android
```

On macOS with Xcode, use `npx expo run:ios` instead. These commands generate/build native projects and start Metro; follow [Expo local debug-build prerequisites](https://docs.expo.dev/guides/local-app-development/). Rebuild when native permission/config plugins change. Expo Go is useful only for compatible previews, not the `com.fithub.app` E2E target or complete push verification. Restart Metro after changing public environment values.

### 6. Validate your setup

Run the Testing commands, then manually verify registration/email recovery, seeded exercise browsing, a saved workout, offline app restart and cross-account privacy. Full verification requires the installed dependencies, local test backend and native device; the commands have not all succeeded in the current restricted workspace.

## Environment Variables

Only names and purposes are documented; never commit actual credentials. `EXPO_PUBLIC_*` values are bundled into the client and must be safe to disclose. Public API keys identify the project/client; RLS and authentication—not key secrecy—protect user data.

| Scope | Name | Purpose |
| --- | --- | --- |
| App / `.env.local` | `EXPO_PUBLIC_SUPABASE_URL` | Supabase API URL reachable from the device |
| App / `.env.local` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous client key; never a service-role key |
| Edge runtime | `SUPABASE_URL` | Backend endpoint for trusted delivery worker |
| Edge runtime, secret | `SUPABASE_SERVICE_ROLE_KEY` | Privileged worker credential; server only |
| Edge runtime, secret | `CHALLENGE_CRON_SECRET` | Authenticates protected scheduled Edge requests |
| Edge runtime, optional secret | `EXPO_ACCESS_TOKEN` | Expo push-service authorization when enabled |
| Test shell, private | `FITHUB_TEST_DATABASE_URL` | Admin connection to disposable loopback PostgreSQL for rollback suites |
| Test shell | `FITHUB_RUN_E2E` | Set to `1` to include Maestro in `test:verify` |
| E2E shell | `E2E_RUN_ID`, `E2E_EMAIL` | Unique fixture suffix and provisioned actor email |
| E2E shell, secret | `E2E_PASSWORD` | Test-only actor password |
| E2E provisioning shell | `E2E_SUPABASE_URL` | Loopback local Auth admin endpoint |
| E2E provisioning shell, secret | `E2E_SUPABASE_SERVICE_ROLE_KEY` | Local-only fixture provisioner credential; never bundled |

Keep Edge secrets in server-side secret management and test credentials in private shell/CI settings, not the app environment. The protected push scheduler also uses named Vault secrets described in its deployment script. Do not publish console output containing keys/tokens or signed photo URLs. `.env.example` contains placeholders only.

## Project Structure

```text
src/
  app/                   Thin Expo Router routes: (auth), (tabs), nested screens
  components/            Shared controls, feedback, layouts and providers
  config/                Validated environment configuration
  constants/             Shared constants and storage identifiers
  data/                  Supabase adapters, local SQLite adapters and mappings
  domain/                Backend-independent entities, errors, events, offline contracts
  features/
    auth/ exercises/ workouts/ social/ challenges/ leaderboards/
    progress/ achievements/ home/ profile/ notifications/
  hooks/                 Cross-feature lifecycle/accessibility hooks
  lib/                   Configured third-party clients
  services/              Shared media, notification, navigation, realtime infrastructure
  store/                 Client/global Zustand stores
  testing/               Shared integration fixtures
  theme/                 Tokens, theme definitions and provider
  types/                 Shared models and generated-style database contracts
  utils/                 Pure utilities, including unit conversions
  validation/            Shared boundary/input schemas
supabase/
  migrations/            Ordered schema, integrity, automation and security changes
  seed.sql               Exercise and achievement reference data
  tests/                 Rollback-only database regression suites
  functions/             Trusted notification delivery worker
  deploy/                Optional push scheduler deployment
.maestro/                Critical device flows and shared login helper
scripts/                 Verification, core tests and performance tooling
docs/                    Feature designs, audits, test evidence and screenshot checklist
```

Feature-local `components`, `screens`, `hooks`, `services`, `repositories`, `state`, `types`, `testing` and `validation` folders exist where needed. `src/types/database.ts` contains generated-style contracts matching the migrations, not an empty schema placeholder. When a real schema-generation environment is available, regenerate, review and typecheck the contracts rather than assuming arbitrary generated output is a drop-in replacement for hand-maintained helper exports.

## Future Improvements

- Complete dependency-backed coverage/type/lint checks, native E2E runs and backend load/security tests; establish CI with a reviewed lockfile.
- Capture representative screenshots and validate VoiceOver/TalkBack, large text, reduced motion and contrast on target devices.
- Add threat-model-appropriate encrypted credential/local-health storage, retention/export/account-deletion workflows and backup policy.
- Curate licensed exercise tutorials and produce versioned avatar/exercise thumbnail variants at upload/CDN level.
- Expand cross-device history retrieval and carefully designed editable-profile/settings synchronization; preserve immutable workout receipts.
- Add notification delivery observability, push-receipt reconciliation and documented operational recovery.
- Consider opt-in global rankings, wearable integrations or calorie estimation only with explicit privacy consent and defensible metric definitions.
- Evaluate further list/bundle optimizations after native profiling demonstrates a bottleneck, not by adding blanket memoization.

FitHub provides fitness logging and educational exercise content, not medical diagnosis or individualized clinical advice.
