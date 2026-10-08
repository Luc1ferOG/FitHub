# SDK 57 compatibility verification

FitHub targets Expo 57.0.27, React Native 0.86.3 and React 19.2.3. Installed native dependencies match the version ranges in Expo's bundled dependency manifest.

## Compatibility changes

- Use Expo Router's theme and focus exports so components share Router's navigation context.
- Replace removed video fullscreen and absolute-fill APIs; use `unspecified` to restore the system appearance preference.
- Handle notifications without a data payload.
- Explicitly include Jest, Node and React ambient types with TypeScript 6 while retaining strict checking and relative aliases.
- Keep custom descriptive input accessibility names; mark progress bars as accessible.
- Remove the stateful offline banner from the basic feedback barrel. Importing loading/empty controls no longer initializes backend and native database services.
- Preserve workout exercise selection during add/reorder; avoid render-time ref assignments; cancel deferred rest and synchronization callbacks on cleanup.
- Subscribe to challenge form fields with React Hook Form's `useWatch`.
- Configure the installed Worklets Jest resolver and update Router/native mocks, valid route fixtures, query-result fixtures and account-scoped cache assertions.

No migrations, authentication storage formats, workout payload formats or backend business rules changed.

## Verification

| Check | Result |
| --- | --- |
| Installed SDK dependency ranges | 0 mismatches |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed, no warnings |
| Jest unit/component/integration assertions | 62 suites, 279 tests passed |
| `npm.cmd run test:integration` | 3 suites, 6 tests passed |
| `npm.cmd run test:core` | 258 tests passed |
| iOS JavaScript export | Passed |
| Production Hermes bytecode export | Blocked by `spawn EPERM` in this environment |

Open-handle diagnostics traced delayed Jest shutdown to mutation cache GC timers, including a synthetic permanently paused mutation in the persistence-policy test. Test clients now disable irrelevant mutation GC timers and still explicitly clear their caches; runtime cache settings are unchanged. Some asynchronous icon-loading `act` warnings remain. Native device smoke tests, Maestro, live Supabase integration and coverage thresholds were not revalidated by this pass.

The JavaScript-only export used a diagnostic command, not a production configuration change:

```powershell
npx.cmd expo export --platform ios --no-bytecode --max-workers 2 --output-dir artifacts/export-ios-js
```

Re-run the regular Hermes export outside this restricted environment before a release:

```powershell
npm.cmd run production:ios
```

## Run on a phone

```powershell
npx.cmd expo start --go --clear
```

The phone must have an Expo Go build supporting SDK 57. A successfully exported JavaScript bundle does not establish compatibility with a different Expo Go SDK or verify camera, notifications, secure storage and offline persistence on the device.

Keep `.env.local` private. FitHub expects `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, not Next.js-prefixed environment variables.
