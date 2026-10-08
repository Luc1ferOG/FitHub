# Private progress photos

## Delivered experience

From the Progress tab, open **Private progress photos**. The date-grouped, paginated two-column gallery supports adding photos, opening fullscreen, deleting and selecting two completed uploads for comparison. Comparison shows chronological before/after images, elapsed calendar days, pose differences and available measurement changes. A draggable comparison slider is optional and is not included.

`/progress/photos/create` uses an Expo Camera preview (front/back switching, ready/capture states, background pause and unmount cleanup) or Expo Image Picker. Metadata uses React Hook Form/Zod: a real non-future calendar date, front/side/back pose and optional notes up to 1,000 characters. Cancelled camera/gallery selection does not start an upload. Denied permissions give retry/settings guidance; camera permissions are rechecked when returning from device settings. Limited photo-library access is accepted. Capture/upload is explicitly supported on iOS/Android, not web; existing cloud photos can still be viewed on web.

## Architecture and image processing

UI → hooks → PhotoService → repository interfaces → Supabase adapters. The Expo media adapter isolates native image picking, processing and filesystem operations. The camera preview itself remains a focused presentation component; no UI component imports Supabase.

- Sources larger than 64 MB (when the picker reports size) or 60 megapixels are rejected before processing.
- ImageManipulator re-encodes JPEG pixels at a maximum 1,600-pixel long edge and 0.75 quality. If needed, processing falls back to 1,000 pixels/0.55 quality. A separate thumbnail uses a 320-pixel long edge/0.65 quality. Aspect ratio is preserved and small images are not enlarged.
- Upload bounds are 4 MiB for the full JPEG and 512 KiB for the thumbnail, checked before transport. The bucket also enforces 4 MiB. Binary ArrayBuffers are uploaded, not React Native Blob/FormData payloads.
- The processor requests no EXIF results and re-encodes images. Verify orientation and absence of retained location metadata on actual native devices; these properties are not proven by mocked tests.
- SHA-256 of the processed full image identifies a retry. The prepared bytes and upload UUID remain in component-scoped refs, so same-screen retries do not re-encode or create duplicate metadata. A checksum is a retry identity, not a claim of server-side forensic validation of image content.
- Scratch JPEGs are removed after their bytes are read. App-owned camera cache files are cleaned up when leaving, after any in-flight processing completes. Original gallery media is never deleted. Abrupt process termination may leave temporary OS-cache files until eviction; this is not an encrypted media vault.

Native API/package choices were checked against the [Expo SDK 54 ImageManipulator docs](https://docs.expo.dev/versions/v54.0.0/sdk/imagemanipulator/), [FileSystem docs](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/), and [Camera docs](https://docs.expo.dev/versions/v54.0.0/sdk/camera/). Permission plugins keep Android CAMERA enabled while blocking unused microphone/audio permissions; see the official [Image Picker plugin](https://github.com/expo/expo/blob/sdk-54/packages/expo-image-picker/plugin/src/withImagePicker.ts).

## Storage privacy and recoverable workflows

Migration 015 keeps `progress-photos` private, makes all existing photo metadata private, removes public-read branches and direct client metadata writes, and uses owner-only RLS on both metadata and Storage objects. No public URLs are generated. Legacy pose `other` can still be viewed, but new forms accept only front/side/back.

Metadata stores only object paths: `ownerUUID/photoUUID/full.jpg` and `thumbnail.jpg`. Authenticated reservation RPCs verify the expected account against auth.uid(), derive paths themselves and check metadata/checksum identity on retries. RPCs use an empty search path and revoke anonymous execution.

Upload flow: reserve **pending** metadata → upload immutable full image and thumbnail → verify both Storage objects → mark **ready**. A partial/network failure leaves a visible pending entry for retry or discard; it does not publish a half-upload. Same-screen retry reuses UUID/checksum and tolerates an already-present object. After app termination, incomplete uploads can be discarded from the gallery; local draft bytes are not persisted for automatic resumable uploads.

Delete flow: mark **deleting** → remove both objects through the Storage API → verify no objects remain → remove metadata. Failure leaves a visible retryable deletion. Storage SELECT includes the owner's pending/deleting records because the Storage remove API requires read access. The app signs only ready photos. Insert RLS calls an owner-scoped locking helper, preventing an object-registration race with metadata deletion; no custom triggers are added to the managed Storage table. Clients cannot overwrite existing objects or delete ready objects without beginning the workflow.

Photos and signatures stay out of the unencrypted persisted Query cache. Paused health/photo mutations are also excluded. Expo Image uses `cachePolicy="none"`; signed URLs last five minutes, renew while displayed, and expire out of inactive query memory immediately. Signed URLs are bearer links: anyone given a link can use it until expiry. They are not logged or persisted, but already-issued links are not instantly revoked on logout/deletion-state change; physical object deletion removes access. OS screenshots/app-switcher previews are not blocked by this feature.

Pending rows remain discoverable in the owner's paginated date timeline. They are not an automatic outbox or background garbage collector. Account deletion/admin cleanup should remove Storage files through the Storage API before profile cascades remove their metadata; PostgreSQL FK deletion alone cannot delete remote media. Existing orphan objects require an administrator/API cleanup procedure.

## Comparison and cache semantics

Before/after sorting uses photo date then UUID for same-date ties. Day difference uses calendar dates, avoiding daylight-saving-hour errors. Measurements use each metric's latest non-empty reading on each exact selected date through an owner-checked SECURITY INVOKER RPC; sparse same-day entries do not erase one another. Missing fields/dates are explicitly unavailable. No image-based measurements or nearby-date interpolation is invented. Same-date images share that day's measurement snapshot. Display uses the profile's preferred units or a local toggle.

Query keys include account and photo IDs; comparison keys are order-independent. Gallery fetching returns 20 rows plus lookahead and virtualizes grid rows. Fullscreen/compare loads full images only on demand. Deletion invalidates photo caches even on failure so pending cleanup remains visible. Body measurement mutations also invalidate dependent photo comparisons. There are no optimistic media writes or automatic non-idempotent retries.

## Deployment and verification

1. Install declared dependencies, including SDK-54-compatible `expo-image-manipulator` and `expo-file-system`. Rebuild the development/native binary to apply permission-plugin changes.
2. Apply `202610060015_private_progress_photos.sql` after migration 014. Review its intentional change of previously public photo metadata to private. No remote database/storage writes were performed here.
3. Run `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` and `npm run test:photo-core`.
4. On a migrated local Supabase instance, run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/progress_photos.sql`.
5. On real iOS/Android devices verify granted/denied/limited permissions, settings return, camera switching/backgrounding, cancelled selection, HEIC/JPEG orientation, output size/EXIF, failed/uncertain uploads, cleanup retries, expired signed URLs and cross-account access denial through the Storage HTTP API. Load/concurrency testing is still required.

Workspace results: all **94 core tests passed** (15 new, 79 regression), and static migration checks passed. The new runner executes actual TypeScript services/adapters but explicitly mocks native Expo APIs, Supabase transport and Zod parsing; it does not prove native processing or live Storage RLS. Real Zod, native UI and Query hook tests are checked in but unexecuted. TypeScript/lint/Jest were attempted and are unavailable because dependencies are missing. An offline install failed with ENOTCACHED; no lockfile or node_modules was produced. PostgreSQL/Supabase/Docker are unavailable, so SQL and real-device checks remain unverified.

## Files changed

- app.json
- package.json
- scripts/verify-database.mjs
- src/types/database.ts
- src/components/providers/query-provider.tsx
- src/features/progress/hooks/use-measurements.ts
- src/features/progress/hooks/__tests__/use-measurements.test.tsx
- src/features/progress/screens/progress-screens.tsx
- src/features/progress/screens/progress-dashboard-screen.tsx
- README.md
- supabase/README.md

## Files added

- docs/progress-photos.md
- scripts/tests/progress-photos.test.mjs
- supabase/migrations/202610060015_private_progress_photos.sql
- supabase/tests/progress_photos.sql
- src/services/media/expo-photo-media.ts
- src/data/repositories/supabase/supabase-photo-repository.ts
- src/features/progress/types/progress-photo.ts
- src/features/progress/repositories/photo-repository.ts
- src/features/progress/repositories/photo-media.ts
- src/features/progress/services/photo-rules.ts
- src/features/progress/services/photo-service.ts
- src/features/progress/services/photo-dependencies.ts
- src/features/progress/services/photo-query-keys.ts
- src/features/progress/validation/photo-schema.ts
- src/features/progress/validation/__tests__/photo-schema.test.ts
- src/features/progress/hooks/use-photos.ts
- src/features/progress/hooks/use-photo-draft.ts
- src/features/progress/hooks/__tests__/use-photos.test.tsx
- src/features/progress/components/photo-camera.tsx
- src/features/progress/components/photo-metadata-form.tsx
- src/features/progress/components/private-photo-image.tsx
- src/features/progress/components/photo-grid-card.tsx
- src/features/progress/components/photo-comparison-values.tsx
- src/features/progress/components/__tests__/photo-ui.test.tsx
- src/features/progress/screens/photo-create-screen.tsx
- src/features/progress/screens/photo-gallery-screen.tsx
- src/features/progress/screens/photo-fullscreen-screen.tsx
- src/features/progress/screens/photo-comparison-screen.tsx
- src/app/progress/photos/create.tsx
- src/app/progress/photos/[photoId].tsx
- src/app/progress/photos/compare.tsx
