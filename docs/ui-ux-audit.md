# FitHub UI/UX polish audit

## Scope and verification status

This is a source-level polish pass across all implemented feature screens and their shared components, not a claim of completed device QA. Core repository, service, validation, workout calculation, synchronization, authentication and database logic were preserved. The only data-related correction is presentation-only: dashboard template duration now converts stored seconds to minutes, matching workout details.

Available checks: **171 core tests passed**, including eight UI polish checks. Database static verification passed. The UI checks execute real theme/responsive/haptic TypeScript using Node's stripped-TypeScript harness, and inspect presentation source; they do not render native screens. New/updated Jest component tests cover button semantic states, input guidance, dynamic type, dashboard minute labels and completion-only haptics. TypeScript, Expo lint and Jest were attempted but cannot run because dependencies/CLIs are absent. No simulator, physical device, screenshot or native accessibility QA was available. Do not treat source checks as a substitute for those checks.

## Shared design system

- AppText now supplies a single scalable body default throughout feature presentation; explicit title, heading and caption styles continue to override it. Native text scaling is not disabled. Long labels wrap; no global font-size cap is introduced.
- Shared 4-point spacing, minimum 48-point/dp controls, rounded cards, separators, button variants, input borders, media backgrounds and semantic colors. Content uses available width with a 760-point reading-width cap rather than phone-specific fixed widths.
- Light/dark foreground/background token pairs used for text, muted text, primary/danger buttons, status text and warning banners pass the included 4.5:1 contrast calculation. This checks opaque enabled token pairs, not photographs, disabled controls, OS-rendered controls or every possible composition.
- System theme remains automatic; explicit theme choice is forwarded to native Appearance so native alerts can follow it. iOS keyboard appearance uses the chosen theme. There are no literal hex/RGB colors in feature/component JSX; app icon branding remains in app.json.
- Buttons retain their label while busy, merge radio/selected/checked state with actual disabled/busy state, and cannot be re-enabled by a caller's accessibilityState. Input focus is visible; supplied accessibility hints and validation messages are combined, errors announced, and form refs allow React Hook Form to focus invalid fields.
- Empty, loading and error foundations are themed. Skeletons are static (no shimmer), grouped as one loading description, and loading indicators declare busy state. Source spacing was normalized to the existing token scale.

## Motion and interactions

One AccessibilityPreferencesProvider subscribes to runtime reduced-motion and screen-reader changes and removes listeners on teardown. It defaults conservatively until preferences resolve. Set completion, achievement unlock, progress bars, challenge membership changes, empty/dashboard appearance use short Reanimated feedback; animations are cancelled on cleanup and never determine a business action's completion. Native navigation transitions preserve platform behavior and turn off under reduced motion.

Exercise selection and friend invitations share a themed bottom-sheet surface with safe areas, independent FlatLists, a draggable dismiss handle, explicit close, initial title focus, escape/Android-back handling and busy guards. Centered confirmation/unlock dialogs use the same scroll-constrained surface. Screen readers get explicit close controls; the dismiss gesture is disabled for them. Modal focus return still needs VoiceOver/TalkBack device verification. The camera intentionally remains a full-screen native integration rather than a bottom sheet.

Workout templates offer a swipe-left edit shortcut. It reveals an action, never performs deletion or edits automatically. Assistive technology/reduced motion gets a visible equivalent button; details also retain edit controls. Existing long-press exercise reordering stays intact, with larger font-scaled rows and move-up/down alternatives. Dragging is disabled when a screen reader is enabled.

Completed-set haptics observe the **confirmed local state transition** from incomplete to complete, not a button tap, initial restoration, or unrelated rerender. Failures are swallowed independently of logging. Android uses the native confirmation effect and iOS uses success notification feedback; web gets no haptic. Additions follow [Expo SDK 54 Haptics](https://docs.expo.dev/versions/v54.0.0/sdk/haptics/). Motion/gesture APIs follow [Reanimated accessibility guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/) and [Reanimated Swipeable](https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/components/reanimated_swipeable/).

## Screen-by-screen source review

| Screen / route | Review and correction |
| --- | --- |
| Login | Safe-area brand/form layout, keyboard insets, minimum-size recovery/register links, forwarded field refs, focus/error guidance and busy labels. |
| Register | Same form layout, large-text footer links, password visibility control and invalid-field focus. Existing registration validation unchanged. |
| Forgot password | Full-size login link, keyboard handling and error/focus states. |
| Reset password | Shared form typography, password refs and recovery/loading presentation. Recovery/session logic unchanged. |
| Home | Consistent section/card typography, reduced-motion appearance, animated challenge progress, bounded virtualized content; duration display corrected. |
| Workout list | Resume/create/error area scrolls with the list, accessible swipe edit shortcut, wrapping pagination buttons. |
| Workout create/edit | Scalable drag rows, 48-unit handles, move alternatives, invalid-field focus; native keyboard insets replace fixed offset. Picker uses bottom sheet. |
| Workout detail | Shared text/card/buttons and scrollable content; consistent destructive confirmation dialog. |
| Active workout | Header/rest content scrolls with exercises on short screens, animated accessible progress, wrapping controls, stacked compact inputs, completion-only haptics. |
| Workout review / summary | Shared scalable text/cards/inputs; scrolling and keyboard insets keep notes/save accessible. |
| Saved workout history | Shared cards, typography and list feedback; session persistence/history semantics untouched. |
| Exercise browser | Search/filter/feedback controls move into the virtualized list header. Stable list identity prevents keyboard loss on debounced searches. Filter chips use 48-unit touch targets. |
| Exercise detail | Consistent section spacing, guide typography, skeleton state and theme-token video background. Native video controls/fullscreen/cleanup retained. |
| Challenge discovery/invitations | Header actions scroll rather than crowding short viewports; filters wrap; card borders/radius align with workouts. |
| Challenge creation | Shared inputs, field refs and scalable radio controls; duplicate keyboard avoidance removed. |
| Challenge detail | Shared progress bar and subtle membership-state feedback, reusable invite sheet. Progress/ranking/join rules untouched. |
| Challenge leaderboard | Scalable rows, compact stacked podium/row fallback; large-text names no longer limited to two lines. SQL ranking remains authoritative. |
| Friends leaderboard | Same responsive ranking components; sharing controls and real-time behavior preserved. |
| Friends list | Navigation controls scroll as a list header; consistent bordered user cards and loading/error states. |
| Friend requests | Wrapping tabs and scrollable request header, preserved profile/action navigation. |
| User search | Shared search-field focus/description, themed feedback and scalable user cards. Debouncing unchanged. |
| Public profile | Scrollable profile/statistics/badges, readable cards; cached profile remains visible when refresh fails with an explicit error state. |
| Own profile | Content now scrolls so settings/friends/logout remain reachable at large font sizes. |
| Settings | Scalable radio-style appearance buttons now retain checked and disabled semantics; existing push settings remain native/themed. |
| Body progress dashboard | Consistent section spacing, wrapped period/unit controls, shared chart/card text and error feedback. Calculations unchanged. |
| Measurement create/edit | Shared inputs with invalid-field refs; one keyboard strategy and consistent errors. Unit conversion and realistic-value validation unchanged. |
| Measurement history | Header/actions scroll with entries; edit/delete buttons wrap; shared error component. |
| Photo creation | Aspect-ratio image preview, shared keyboard handling and field refs; pose buttons wrap. Permissions/upload logic unchanged. |
| Camera | Full-screen safe-area themed controls; modal transition respects reduced motion and declares modal accessibility. Camera lifecycle and capture unchanged. |
| Photo gallery | Header/actions scroll; compact/large-text layout stacks tiles; responsive aspect-ratio thumbnails. Private URLs and deletion flow unchanged. |
| Fullscreen photo | Single scrolling surface keeps image, notes, close/delete reachable; removed constrained nested notes scroller. |
| Photo comparison | Before/after stack for small/large-text layouts; images use aspect ratios instead of fixed heights. Comparisons unchanged. |
| Achievements | Shared scalable badge/card/progress styles; reusable scrollable animated unlock dialog. Unlock/evaluation logic unchanged. |
| Root/auth/tab navigation | Existing route protection retained; themed header typography, native appearance, keyboard-hidden tab bar and reduced-motion transitions. |

Notification inbox/full feature placeholders were not added: this pass polishes implemented UI, not new feature functionality. Unimplemented routing aliases continue to point at the existing feature screens.

## Pending native verification matrix

All cells below remain **unverified on device**. Compact-layout unit tests cover the corresponding widths; they are not screenshots or device tests.

| Target | Representative width | Required checks |
| --- | --- | --- |
| Small Android | 320–360 dp | Keyboard resize, gesture conflicts, TalkBack order, max font size, long exercise names. |
| Normal Android | 390–412 dp | Sheets/back button, set haptic, swipe shortcut, theme/contrast, photo permissions. |
| Large Android | 430+ dp | No stretched controls, camera/media sizing, lists and chart geometry. |
| Small iPhone | 320–375 pt | Safe areas, keyboard insets, VoiceOver modal focus/return, large text, scrolling controls. |
| Pro Max iPhone | 430 pt | Podium/photo pairs, native navigation, haptics, light/dark/system and reduced motion. |

For each target: test light/dark/system, 100%/130%/200% text (and platform maximum), long localized labels/names, reduced motion toggled while open, offline/retry/loading/empty/populated states, screen readers, Android back/iOS escape, sheet drag versus list scroll, gesture cancellation during a write, and destructive confirmation. Ensure controls remain reachable and no duplicate haptic occurs when reopening/restoring an active workout. Check native tab labels and modal focus return visually and with assistive technology.

## Run / handoff

Install dependencies (including newly declared expo-haptics ~15.0.8), then run npm run typecheck, npm run lint, npm test -- --runInBand, and native Expo builds on the matrix above. Jest setup now includes native gesture/Reanimated/haptic mocks. Available dependency-free checks:

```sh
npm run test:ui-core
node --experimental-vm-modules --test --test-isolation=none scripts/tests/*.test.mjs
npm run db:verify
```

No migration is needed for this pass. Backend schema/RLS and server-side scoring/achievements were not changed.

## Exact file manifest

### Added (14)

- `src/hooks/use-accessibility-preferences.ts`
- `src/hooks/use-responsive-layout.ts`
- `src/utils/responsive.ts`
- `src/components/ui/app-text.tsx`
- `src/components/ui/modal-surface.tsx`
- `src/components/ui/motion-view.tsx`
- `src/components/ui/progress-bar.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/swipe-action.tsx`
- `src/components/feedback/error-state.tsx`
- `src/services/device/haptics.ts`
- `src/components/ui/__tests__/polish.test.tsx`
- `scripts/tests/ui-polish.test.mjs`
- `docs/ui-ux-audit.md`

### Changed (94)

- `README.md`
- `app.json`
- `jest.setup.ts`
- `package.json`
- `src/app/(tabs)/_layout.tsx`
- `src/app/_layout.tsx`
- `src/components/feedback/empty-state.tsx`
- `src/components/feedback/error-boundary.tsx`
- `src/components/feedback/index.ts`
- `src/components/feedback/loading-indicator.tsx`
- `src/components/feedback/offline-banner.tsx`
- `src/components/layout/screen.tsx`
- `src/components/providers/app-providers.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/index.ts`
- `src/components/ui/input.tsx`
- `src/constants/app.ts`
- `src/features/achievements/components/achievement-card.tsx`
- `src/features/achievements/components/achievement-unlock-modal.tsx`
- `src/features/achievements/screens/achievements-screen.tsx`
- `src/features/auth/components/auth-screen-layout.tsx`
- `src/features/auth/components/form-message.tsx`
- `src/features/auth/components/password-input.tsx`
- `src/features/auth/screens/forgot-password-screen.tsx`
- `src/features/auth/screens/login-screen.tsx`
- `src/features/auth/screens/register-screen.tsx`
- `src/features/challenges/components/__tests__/challenge-summary.test.tsx`
- `src/features/challenges/components/challenge-card.tsx`
- `src/features/challenges/components/challenge-form.tsx`
- `src/features/challenges/components/challenge-push-settings.tsx`
- `src/features/challenges/components/challenge-summary.tsx`
- `src/features/challenges/components/invite-friends-picker.tsx`
- `src/features/challenges/screens/challenge-list-screen.tsx`
- `src/features/exercises/components/exercise-card.tsx`
- `src/features/exercises/components/exercise-filters.tsx`
- `src/features/exercises/components/exercise-guide.tsx`
- `src/features/exercises/components/exercise-skeleton.tsx`
- `src/features/exercises/components/exercise-video.tsx`
- `src/features/exercises/screens/exercise-library-screen.tsx`
- `src/features/exercises/screens/exercise-screens.tsx`
- `src/features/home/components/__tests__/dashboard-section.test.tsx`
- `src/features/home/components/dashboard-section.tsx`
- `src/features/home/components/dashboard-skeleton.tsx`
- `src/features/home/screens/home-screen.tsx`
- `src/features/leaderboards/components/friends-sharing-control.tsx`
- `src/features/leaderboards/components/leaderboard-avatar.tsx`
- `src/features/leaderboards/components/leaderboard-podium.tsx`
- `src/features/leaderboards/components/leaderboard-user-row.tsx`
- `src/features/leaderboards/screens/leaderboard-screen.tsx`
- `src/features/profile/screens/profile-screens.tsx`
- `src/features/progress/components/measurement-form.tsx`
- `src/features/progress/components/measurement-history-row.tsx`
- `src/features/progress/components/measurement-summary.tsx`
- `src/features/progress/components/photo-camera.tsx`
- `src/features/progress/components/photo-comparison-values.tsx`
- `src/features/progress/components/photo-grid-card.tsx`
- `src/features/progress/components/photo-metadata-form.tsx`
- `src/features/progress/components/private-photo-image.tsx`
- `src/features/progress/components/progress-chart.tsx`
- `src/features/progress/components/progress-error.tsx`
- `src/features/progress/screens/measurement-entry-screen.tsx`
- `src/features/progress/screens/measurement-history-screen.tsx`
- `src/features/progress/screens/photo-comparison-screen.tsx`
- `src/features/progress/screens/photo-create-screen.tsx`
- `src/features/progress/screens/photo-fullscreen-screen.tsx`
- `src/features/progress/screens/photo-gallery-screen.tsx`
- `src/features/progress/screens/progress-dashboard-screen.tsx`
- `src/features/social/components/friend-actions.tsx`
- `src/features/social/components/social-list-feedback.tsx`
- `src/features/social/components/user-card.tsx`
- `src/features/social/screens/public-profile-screen.tsx`
- `src/features/social/screens/social-screens.tsx`
- `src/features/social/screens/user-search-screen.tsx`
- `src/features/workouts/components/__tests__/active-set-row.test.tsx`
- `src/features/workouts/components/active-exercise-card.tsx`
- `src/features/workouts/components/active-set-row.tsx`
- `src/features/workouts/components/delete-workout-dialog.tsx`
- `src/features/workouts/components/exercise-configuration.tsx`
- `src/features/workouts/components/exercise-picker.tsx`
- `src/features/workouts/components/reorder-exercises.tsx`
- `src/features/workouts/components/rest-timer.tsx`
- `src/features/workouts/components/resume-workout-card.tsx`
- `src/features/workouts/components/workout-builder.tsx`
- `src/features/workouts/components/workout-card.tsx`
- `src/features/workouts/components/workout-details-fields.tsx`
- `src/features/workouts/components/workout-session-summary.tsx`
- `src/features/workouts/screens/active-workout-screen.tsx`
- `src/features/workouts/screens/session-history-screen.tsx`
- `src/features/workouts/screens/workout-detail-screen.tsx`
- `src/features/workouts/screens/workout-list-screen.tsx`
- `src/theme/theme-provider.tsx`
- `src/theme/themes.ts`
- `src/theme/tokens.ts`

