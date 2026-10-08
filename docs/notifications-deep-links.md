# Notifications and deep links

## Architecture

`NotificationLifecycle` mounts once, even before login. `NotificationService` owns native foreground presentation, five notification categories and Android channels. `RestNotifications` remains responsible only for rest permission/scheduling/cancellation. The old challenge/achievement tap listeners and challenge lifecycle were replaced by a single `listenForNotificationResponses` implementation.

Local and push notifications use the same validated destination resolver. Only notification **taps**, not arrivals, change routes. Launch responses and live taps are deduplicated by request ID, delivery date and action; a later rest alert reusing the same session identifier still works. Only default/open actions navigate. Listeners and the foreground handler clean up on unmount; native notification operations are no-ops on web.

| Category / accepted legacy kind | Destination |
| --- | --- |
| `rest_timer_completed` / `workout-rest` | `/workouts/active/{sessionId}` |
| `friend_request` | `/friends/requests` |
| `challenge_invite` / `invite` | `/challenges/{challengeId}` |
| `challenge_ending_soon` / `ending_soon` | `/challenges/{challengeId}` |
| `achievement_unlocked` | `/achievements` |

Existing friend-joined, rank-passed, challenge-completed and winner payloads also map to their challenge. Notification data must include a valid `userId`; challenge/session IDs must be valid PostgreSQL UUIDs. Arbitrary payload URLs, missing recipients and unknown kinds are never navigation instructions. Received-but-untapped notifications stay in the OS tray. Malformed taps do not crash the app or initiate database queries.

Local usage is through `NotificationService.scheduleLocal(category, title, body, data, optionalDate)`. It validates the destination, checks permission without prompting automatically, configures categories/channels and schedules via Expo. Permission denial returns null. Rest alerts use their existing absolute deadline scheduler and now include the recipient ID. Foreground rest banners/sound are suppressed while the timer is visible; background alerts and other categories retain native presentation.

## Deep links and authentication

The configured `fithub` scheme supports:

```text
fithub://challenge/{id} → /challenges/{id}
fithub://workout/{id}   → /workouts/{id}
fithub://user/{id}      → /user/{id}
```

`+native-intent.ts` normalizes incoming native links. The pure `parseDestination` allowlist rejects external URLs, credentials/ports, traversal, encoded separators, control characters, arbitrary query parameters and unsupported destinations. PKCE `/reset-password?code=...` is handled separately: recovery parameters are preserved for Supabase, never persisted as a navigation intent.

The SQLite-backed Zustand intent store persists only a validated route, optional notification recipient and creation time. Intents expire after 24 hours. A newer native link/tap replaces the pending intent. Notification intents can only be consumed by their recipient; logging into another account discards them. Ordinary public deep links have no imposed recipient but still obey server RLS.

The root stack stays mounted while restoration is loading. Its protected content is hidden from view, interaction and screen readers behind a loading surface. Redirects wait for navigation readiness. Authentication and intent hydration precede route decisions. A valid intended destination takes precedence over Home after login, is consumed only when reached, and is not allowed to interrupt password recovery.

For the requested `fithub://challenge/abc` example:

1. Preserve the structurally safe `/challenges/abc` destination.
2. Redirect a logged-out user to Login.
3. After successful login, navigate to `/challenges/abc`.
4. Reject `abc` as a non-UUID before querying and show “Invalid challenge link” with a Home action.

Valid IDs for deleted/forbidden records use the normal repository/service error paths. Authoritative `NOT_FOUND`/`AUTHORIZATION` errors replace stale detail content with an unavailable state rather than continuing to show a deleted record. Transient network failures can still show previously cached data. This routing layer does not bypass authentication or resource authorization.

## Push delivery and deployment

The existing explicit opt-in token registration service (legacy class name `ChallengePushService`) now serves the shared notification categories. Settings labels reflect friend, challenge and achievement alerts. Token registration/unregistration uses the Supabase repository and existing owner-bound RPCs; no service key is bundled.

Apply `202610070019_friend_request_notifications.sql` after all preceding migrations. Its hardened, non-client-callable trigger atomically creates the recipient's in-app friend notification and delivery jobs after a pending request is inserted. Existing friendship uniqueness prevents duplicate requests; notification/device uniqueness prevents duplicate outbox jobs. Existing challenge and achievement emitters remain authoritative.

Redeploy `supabase/functions/challenge-notifications`. The existing private leased queue/worker handles all these push jobs, bounded retries and Expo receipt checks. The worker now sends matching Expo `categoryId` values for the four push categories. Its server-only cron secret authorization, service-role grants and token cleanup remain unchanged.

Before device verification:

1. Install dependencies and rebuild a native development/production app for the updated notification plugin/default channel.
2. Configure a real EAS project ID and APNs/FCM credentials; none were invented in this change.
3. Deploy the migration and worker; configure `CHALLENGE_CRON_SECRET`, the existing Vault/cron setup and optional Expo access-token protection as described in [challenge deployment](fitness-challenges.md).
4. Explicitly enable push alerts on a signed-in device. Local rest alerts use their separate permission opt-in.

The adapters follow [Expo SDK 54 Notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/) and [Expo Router's native-intent API](https://docs.expo.dev/versions/v54.0.0/sdk/router/). Push delivery requires the native setup described in [Expo's setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/); tickets/receipts and actual device presentation are separate verification steps.

## Verification

`npm run test:notifications-core`: 32 passing tests execute the actual TypeScript parsers, intent rules, route guard, response listener, local notification service and push category mapper. Expo/native APIs are mocked. Coverage includes all requested links/categories, login return including `abc`, invalid IDs/payloads, traversal/open redirect rejection, expired/wrong-account intents, cold/live duplicate taps, repeated rest IDs, permission denial, foreground policy, recovery links, cleanup and web no-ops. A Jest suite covers pure navigation rules, and existing workout service tests now distinguish malformed IDs from missing records.

All **230** dependency-free core tests pass. `npm run db:verify` passes static checks including the new trigger and 58 hardened definer functions. Typecheck, lint and Jest were attempted but cannot run because dependencies (`tsc`, `expo`, `jest`) are absent. No migration was executed against a live PostgreSQL instance, and no APNs/FCM delivery or native navigation was claimed as tested.

Device acceptance checks: cold/warm/background taps for every category, a logged-out link followed by login/register, process restart while login is pending, second-account login after a recipient-scoped tap, invalid/deleted/private records, repeated rest alerts, permission denial/revocation, and foreground/background presentation on iOS/Android.

## Exact file manifest

Added:

- `src/services/navigation/destinations.ts`
- `src/services/navigation/navigation-intent.ts`
- `src/services/navigation/__tests__/destinations.test.ts`
- `src/store/navigation-intent-store.ts`
- `src/app/+native-intent.ts`
- `src/app/link-unavailable.tsx`
- `src/services/notifications/notification-service.ts`
- `src/services/notifications/notification-response-listener.ts`
- `src/components/providers/notification-provider.tsx`
- `supabase/migrations/202610070019_friend_request_notifications.sql`
- `supabase/functions/_shared/notification-category.ts`
- `scripts/tests/notifications-linking.test.mjs`
- `docs/notifications-deep-links.md`

Changed:

- `app.json`
- `package.json`
- `README.md`
- `docs/fitness-challenges.md`
- `scripts/verify-database.mjs`
- `scripts/tests/workout-management.test.mjs`
- `src/app/_layout.tsx`
- `src/components/providers/app-providers.tsx`
- `src/features/auth/services/auth-route-guard.ts`
- `src/features/achievements/components/achievement-lifecycle.tsx`
- `src/features/challenges/components/challenge-push-settings.tsx`
- `src/features/challenges/hooks/use-challenges.ts`
- `src/features/leaderboards/screens/leaderboard-screen.tsx`
- `src/features/social/hooks/use-social.ts`
- `src/features/social/screens/public-profile-screen.tsx`
- `src/features/workouts/components/session-lifecycle-provider.tsx`
- `src/features/workouts/hooks/use-workouts.ts`
- `src/features/workouts/screens/workout-detail-screen.tsx`
- `src/features/workouts/services/workout-service.ts`
- `src/features/workouts/services/__tests__/workout-service.test.ts`
- `src/services/notifications/rest-notifications.ts`
- `src/utils/errors.ts`
- `src/validation/uuid.ts`
- `supabase/functions/challenge-notifications/index.ts`

Replaced/removed obsolete implementations (no user data removed):

- `src/services/notifications/challenge-notification-navigation.ts`
- `src/services/notifications/achievement-notification-navigation.ts`
- `src/features/challenges/components/challenge-notification-lifecycle.tsx`
