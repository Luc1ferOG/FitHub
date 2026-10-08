# Body progress tracking

The Progress tab shows private measurement summaries and weight, waist and body-fat charts. `/progress/measurements` provides paginated history; `/progress/create` and `/progress/edit/[measurementId]` provide create/edit forms. Delete requires confirmation. Progress photos remain outside this change.

## Architecture and semantics

- UI → hooks → MeasurementService → MeasurementRepository → Supabase adapter. Screens never import Supabase. Models use camel-case fields, mapped at the repository boundary.
- React Hook Form and Zod provide field errors; the service validates canonical values before writes. Any one of the nine measurements is sufficient. Blank inputs persist as null, not zero.
- Storage uses kg/cm/percent. `src/utils/units.ts` provides reusable, unrounded conversions; presentation/parsing live in `measurement-rules.ts`. Entry and display units default to the profile's preference. The per-screen toggle does not overwrite that preference. Changing units converts valid inputs; invalid values must first be corrected. Unchanged imperial fields retain their original canonical precision on edit.
- Supported bounds: weight 20–500 kg; body fat 1–75%; chest/waist/hips 20–300 cm; arms 5–100 cm; thighs 10–200 cm. These are broad input limits, not clinical guidance or recommended goals. PostgreSQL also enforces them. NOT VALID constraints preserve legacy imports while checking new/updated rows; legacy out-of-range entries must be corrected before editing.
- A chosen calendar date is stored at UTC midnight without shifting its day. The RPC receives the device's local today (limited to ±1 UTC day); windows include today. Three/six months and one year use calendar intervals. SQL calendar arithmetic is explicitly UTC, independent of session timezone. Date keys invalidate cached periods across local day boundaries on subsequent renders/refetches.
- Summary cards use exact **all-history** latest, previous non-null, and first non-null readings for each metric, never averaged chart points. Equal timestamps use UUID tie ordering. No previous reading yields an unavailable delta, not a zero baseline. Changes use neutral styling rather than assuming a health goal.
- Charts return at most 120 filtered time buckets, averaging non-null values. Each date is the bucket's earliest entry. Missing metrics are omitted and lines connect available buckets; these are visual trends, not interpolated stored measurements. Single readings display a point. Geometry uses actual elapsed time. Charts have date/range context, screen-reader descriptions and expandable textual values. Native View geometry needs no new chart package.
- History fetches 20 rows plus lookahead, ordered by date/UUID. FlatList virtualizes rendering and rows are memoized. Offset pagination does not claim snapshot isolation; refresh after concurrent changes.

## Privacy, caching and writes

Migration 014 retains owner-only SELECT/INSERT/UPDATE/DELETE RLS. Repository reads/writes also filter owner IDs. The dashboard is SECURITY INVOKER with an empty search path and auth.uid(), never a supplied owner. Anonymous execution is revoked. No public leaderboard exposure is added.

Query keys include account, dataset and chart period/day. Successful writes cancel obsolete requests and invalidate that account's progress queries. Writes are server-confirmed, not optimistic, and do not automatically retry non-idempotent inserts. Errors preserve form inputs. This feature does not add an offline mutation outbox.

New progress queries set `meta.persist = false`. The shared query provider honors this, excluding measurements from the unencrypted AsyncStorage query cache while caching them in memory. Account-change clearing still applies. Other features retain existing persistence behavior.

## Deployment and verification

Apply `supabase/migrations/202610060014_body_progress.sql` after migration 013. It permits null weight, adds at-least-one-value/date/range checks, adds a history index and creates the RLS-bound aggregate RPC. Existing measurement values and profile weight are not rewritten.

- `npm run test:progress-core`: 11 executed actual TypeScript tests for conversions, parsing, optional entries, value/date checks, precision-preserving edits, deltas, chart geometry, service guards, pagination and owner-scoped CRUD. The dependency-free runner explicitly stubs Zod response validation and the Supabase client boundary.
- `npm test -- --runInBand`: checked-in real Zod, hook invalidation/privacy and native form/chart tests. Unexecuted here: Jest/dependencies are unavailable.
- `npm run db:verify`: executed static migration privacy/integrity checks, not PostgreSQL execution.
- `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/body_progress.sql`: rollback-only tests for independent baselines, periods, bounded charts, RLS and invalid values. Unexecuted here: PostgreSQL/Supabase/Docker are unavailable.

All 79 core tests passed (11 new, 68 regression); static checks passed. TypeScript and Expo lint were attempted but their executables, along with Jest, are missing. Install dependencies, run typecheck/lint/Jest, apply the migration locally, execute SQL tests and test layouts on devices before production use. No remote database changes were made.

## Files changed

- package.json
- scripts/verify-database.mjs
- src/types/database.ts
- src/components/providers/query-provider.tsx
- src/features/progress/types/measurement.ts
- src/features/progress/screens/progress-screens.tsx
- README.md
- supabase/README.md

## Files added

- docs/body-progress.md
- scripts/tests/body-progress.test.mjs
- supabase/migrations/202610060014_body_progress.sql
- supabase/tests/body_progress.sql
- src/utils/units.ts
- src/app/progress/create.tsx
- src/app/progress/edit/[measurementId].tsx
- src/data/repositories/supabase/supabase-measurement-repository.ts
- src/features/progress/repositories/measurement-repository.ts
- src/features/progress/services/measurement-rules.ts
- src/features/progress/services/measurement-service.ts
- src/features/progress/services/measurement-dependencies.ts
- src/features/progress/validation/measurement-schema.ts
- src/features/progress/validation/progress-response.ts
- src/features/progress/validation/__tests__/measurement-schema.test.ts
- src/features/progress/hooks/use-measurements.ts
- src/features/progress/hooks/__tests__/use-measurements.test.tsx
- src/features/progress/components/unit-selector.tsx
- src/features/progress/components/measurement-form.tsx
- src/features/progress/components/measurement-summary.tsx
- src/features/progress/components/progress-chart.tsx
- src/features/progress/components/progress-error.tsx
- src/features/progress/components/measurement-history-row.tsx
- src/features/progress/components/__tests__/measurement-ui.test.tsx
- src/features/progress/screens/progress-dashboard-screen.tsx
- src/features/progress/screens/measurement-history-screen.tsx
- src/features/progress/screens/measurement-entry-screen.tsx
