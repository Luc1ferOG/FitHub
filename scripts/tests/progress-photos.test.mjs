import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { posix } from 'node:path';
import test from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
const modules = new Map();
function source(path) { if (!modules.has(path)) modules.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8'), { mode: 'transform' }), { identifier: path })); return modules.get(path); }
function stub(exports) { return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }); }
const supabase = stub({ supabase: {} }); const response = stub({ progressResponse: { parse: (data) => data } });
const photoSchema = stub({ photoRowSchema: { parse: (data) => data }, photoMeasurementsSchema: { parse: (data) => data } });
let permission; let pickerResult; let requested; let mediaCalls = []; let oversize = false;
const picker = stub({ getMediaLibraryPermissionsAsync: async () => permission, requestMediaLibraryPermissionsAsync: async () => { requested++; return permission; }, launchImageLibraryAsync: async (options) => { mediaCalls.push(['pick', options]); return pickerResult; } });
const files = new Map();
class MockFile { constructor(uri) { this.uri = uri; } get size() { return files.get(this.uri)?.byteLength ?? 0; } get exists() { return files.has(this.uri); } async bytes() { return files.get(this.uri); } delete() { mediaCalls.push(['delete', this.uri]); files.delete(this.uri); } }
const filesystem = stub({ File: MockFile, Paths: { cache: { uri: 'file:///cache/' } } });
const manipulator = stub({ SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: (uri) => {
  let dimensions;
  return { resize: (value) => { dimensions = value; mediaCalls.push(['resize', uri, value]); }, release: () => mediaCalls.push(['releaseContext']), renderAsync: async () => ({ release: () => mediaCalls.push(['releaseImage']), saveAsync: async (options) => {
    const fileUri = `file:///cache/generated-${mediaCalls.length}.jpg`;
    const bytes = new Uint8Array(oversize && Math.max(dimensions.width, dimensions.height) === 1600 ? 5 * 1024 * 1024 : 1000); bytes.set([255, 216, 255]); files.set(fileUri, bytes);
    mediaCalls.push(['save', options]); return { ...dimensions, uri: fileUri };
  } }) };
} } });
const crypto = stub({ CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digest: async (algorithm, bytes) => { mediaCalls.push(['digest', algorithm, bytes.byteLength]); return new Uint8Array(32).fill(1).buffer; } });
async function load(path) { const module = source(path); await module.link((specifier, parent) => {
  if (specifier === '@/lib/supabase') return supabase;
  if (specifier.endsWith('validation/progress-response')) return response;
  if (specifier.endsWith('validation/photo-schema')) return photoSchema;
  if (specifier === 'expo-image-picker') return picker;
  if (specifier === 'expo-file-system') return filesystem;
  if (specifier === 'expo-image-manipulator') return manipulator;
  if (specifier === 'expo-crypto') return crypto;
  return source(specifier.startsWith('@/') ? `src/${specifier.slice(2)}.ts` : `${posix.normalize(posix.join(posix.dirname(parent.identifier), specifier))}.ts`);
}); await module.evaluate(); return module.namespace; }
const rules = await load('src/features/progress/services/photo-rules.ts');
const { PhotoService } = await load('src/features/progress/services/photo-service.ts');
const { SupabasePhotoRepository, SupabasePhotoStorageRepository } = await load('src/data/repositories/supabase/supabase-photo-repository.ts');
const { ExpoPhotoMedia } = await load('src/services/media/expo-photo-media.ts');
const owner = '96000000-0000-0000-0000-000000000001'; const id = '96000000-0000-0000-0000-000000000002'; const other = '96000000-0000-0000-0000-000000000003';
const paths = rules.photoPaths(owner, id);
const photo = { id, userId: owner, photoPath: paths.full, thumbnailPath: paths.thumbnail, takenAt: '2020-01-01T00:00:00.000Z', pose: 'front', notes: '', status: 'pending', checksum: 'a'.repeat(64) };
const metadata = { date: '2020-01-01', pose: 'front', notes: ' private note ' };
const prepared = { full: { bytes: new Uint8Array([255, 216, 255, 1]).buffer, width: 1600, height: 1200 }, thumbnail: { bytes: new Uint8Array([255, 216, 255, 1]).buffer, width: 320, height: 240 }, checksum: photo.checksum };
function transport(data, error = null) {
  const calls = []; const query = { then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject) };
  for (const method of ['select', 'eq', 'order', 'range', 'abortSignal', 'maybeSingle', 'gte', 'lt', 'limit']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  const client = { from: (...args) => { calls.push(['from', ...args]); return query; }, rpc: (...args) => { calls.push(['rpc', ...args]); return query; }, storage: { from: (bucket) => { calls.push(['bucket', bucket]); return { upload: (...args) => { calls.push(['upload', ...args]); return Promise.resolve({ data, error }); }, remove: (...args) => { calls.push(['remove', ...args]); return Promise.resolve({ data, error }); }, createSignedUrl: (...args) => { calls.push(['sign', ...args]); return Promise.resolve({ data, error }); } }; } } };
  return { repository: new SupabasePhotoRepository(client), storage: new SupabasePhotoStorageRepository(client), calls };
}
test('metadata validates date/pose/notes and paths never contain public URLs', () => {
  assert.deepEqual(rules.validatePhotoMetadata(metadata), { ...metadata, notes: 'private note' });
  for (const bad of [{ ...metadata, date: '2020-02-30' }, { ...metadata, pose: 'other' }, { ...metadata, notes: 'a'.repeat(1001) }]) assert.throws(() => rules.validatePhotoMetadata(bad));
  assert.equal(paths.full, `${owner}/${id}/full.jpg`); assert.equal(paths.full.includes('https:'), false);
});
test('permissions distinguish requestable, permanent-denial, granted and limited access', () => {
  assert.equal(rules.permissionDecision(null), 'request'); assert.equal(rules.permissionDecision({ granted: false, canAskAgain: true }), 'request');
  assert.equal(rules.permissionDecision({ granted: false, canAskAgain: false }), 'settings'); assert.equal(rules.permissionDecision({ granted: true, canAskAgain: false }), 'allowed');
  assert.equal(rules.permissionDecision({ granted: false, canAskAgain: true, accessPrivileges: 'limited' }), 'allowed');
  assert.match(rules.permissionMessage('camera', { granted: false, canAskAgain: true, status: 'undetermined' }), /^Allow camera/);
});
test('picker cancellation is a normal result; permanent denial never launches the picker', async () => {
  mediaCalls = []; requested = 0; permission = { granted: true, canAskAgain: true }; pickerResult = { canceled: true, assets: null };
  assert.equal(await new ExpoPhotoMedia().pick(), null);
  mediaCalls = []; permission = { granted: false, canAskAgain: false };
  await assert.rejects(new ExpoPhotoMedia().pick(), /settings/); assert.equal(requested, 0); assert.equal(mediaCalls.length, 0);
  permission = { granted: false, canAskAgain: true }; await assert.rejects(new ExpoPhotoMedia().pick(), /denied/); assert.equal(requested, 1);
});
test('limited gallery access accepts a selected still image without requesting again', async () => {
  requested = 0; permission = { granted: true, canAskAgain: false, accessPrivileges: 'limited' };
  pickerResult = { canceled: false, assets: [{ uri: 'file:///gallery/original.jpg', width: 4000, height: 3000, fileSize: 2000 }] };
  assert.equal((await new ExpoPhotoMedia().pick()).owned, false); assert.equal(requested, 0);
  pickerResult.assets[0].fileSize = 65 * 1024 * 1024; await assert.rejects(new ExpoPhotoMedia().pick(), /64 MB/);
});
test('processor preserves aspect ratio, compresses JPEGs, generates thumbnail and cleans scratch files', async () => {
  mediaCalls = []; oversize = false; const result = await new ExpoPhotoMedia().prepare({ uri: 'file:///gallery/original.jpg', width: 4000, height: 3000, owned: false });
  assert.equal(result.full.width, 1600); assert.equal(result.full.height, 1200); assert.equal(result.thumbnail.width, 320); assert.equal(result.thumbnail.height, 240);
  assert.equal(result.checksum.length, 64); assert.ok(result.full.bytes instanceof ArrayBuffer);
  assert.deepEqual(mediaCalls.filter((c) => c[0] === 'save').map((c) => c[1].compress), [0.75, 0.65]);
  assert.equal(mediaCalls.filter((c) => c[0] === 'delete').length, 2); assert.equal(files.size, 0);
  assert.throws(() => rules.resizedDimensions(100000, 100000, 1600)); assert.deepEqual(rules.resizedDimensions(100, 50, 1600), { width: 100, height: 50 });
});
test('oversized first representation falls back to smaller resolution/quality', async () => {
  mediaCalls = []; oversize = true;
  const result = await new ExpoPhotoMedia().prepare({ uri: 'file:///gallery/original.jpg', width: 4000, height: 3000, owned: false });
  assert.equal(result.full.width, 1000); assert.ok(result.full.bytes.byteLength <= rules.PHOTO_MAX_BYTES);
  assert.deepEqual(mediaCalls.filter((c) => c[0] === 'save').map((c) => c[1].compress), [0.75, 0.55, 0.65]); oversize = false;
});
test('cleanup never removes gallery originals or files outside the app cache', async () => {
  mediaCalls = []; const media = new ExpoPhotoMedia();
  await media.cleanup({ uri: 'file:///gallery/original.jpg', width: 1, height: 1, owned: false });
  await media.cleanup({ uri: 'file:///documents/private.jpg', width: 1, height: 1, owned: true });
  assert.equal(mediaCalls.length, 0);
});
test('upload creates owner-scoped metadata then uploads binary full/thumbnail before publishing', async () => {
  const calls = []; const service = new PhotoService({ reserve: async (...args) => { calls.push(['reserve', ...args]); return photo; }, finish: async (id) => { calls.push(['finish', id]); return { ...photo, status: 'ready' }; } }, { upload: async (...args) => { calls.push(['upload', ...args]); } });
  assert.equal((await service.upload(owner, id, metadata, prepared)).status, 'ready');
  assert.deepEqual(calls.map((c) => c[0]), ['reserve', 'upload', 'upload', 'finish']); assert.equal(calls[0][3].notes, 'private note'); assert.equal(calls[1][1], paths.full);
  await assert.rejects(service.upload(owner, id, metadata, { ...prepared, full: { ...prepared.full, bytes: new ArrayBuffer(rules.PHOTO_MAX_BYTES + 1) } }), /too large/);
});
test('failure never publishes a half-upload; an uncertain successful retry does not duplicate uploads', async () => {
  let finish = 0; const failure = new PhotoService({ reserve: async () => photo, finish: async () => { finish++; } }, { upload: async () => { throw new Error('network'); } });
  await assert.rejects(failure.upload(owner, id, metadata, prepared), /network/); assert.equal(finish, 0);
  let uploads = 0; const retry = new PhotoService({ reserve: async () => ({ ...photo, status: 'ready' }) }, { upload: async () => { uploads++; } });
  assert.equal((await retry.upload(owner, id, metadata, prepared)).id, id); assert.equal(uploads, 0);
});
test('deletion preserves a recoverable row until storage removal succeeds', async () => {
  const calls = []; const service = new PhotoService({ markDeleting: async () => { calls.push('mark'); return { ...photo, status: 'deleting' }; }, finishDeleting: async () => { calls.push('finish'); } }, { remove: async (paths) => { calls.push(paths); } });
  await service.remove(owner, id); assert.deepEqual(calls, ['mark', [photo.photoPath, photo.thumbnailPath], 'finish']);
  const fail = new PhotoService({ markDeleting: async () => ({ ...photo, status: 'deleting' }), finishDeleting: async () => { throw new Error('should not finish'); } }, { remove: async () => { throw new Error('network'); } });
  await assert.rejects(fail.remove(owner, id), /network/);
});
test('missing thumbnails never sign a full-sized original for the grid', async () => {
  const calls = [];
  const service = new PhotoService({}, { signedUrl: async (path) => { calls.push(path); return 'secret'; } });
  const legacy = { ...photo, status: 'ready', thumbnailPath: null };
  assert.throws(() => service.urlForPhoto(owner, legacy, true), /thumbnail is unavailable/);
  assert.deepEqual(calls, []);
  await service.urlForPhoto(owner, legacy, false);
  assert.deepEqual(calls, [paths.full]);
});
test('storage uses private bucket, ArrayBuffer JPEG uploads, immutable paths and five-minute signed URLs', async () => {
  const t = transport({ signedUrl: 'https://example.test/signed-secret' }); await t.storage.upload(paths.full, prepared.full.bytes); await t.storage.signedUrl(paths.full); await t.storage.remove([paths.full]);
  assert.ok(t.calls.filter((c) => c[0] === 'bucket').every((c) => c[1] === 'progress-photos'));
  assert.deepEqual(t.calls.find((c) => c[0] === 'upload').slice(1), [paths.full, prepared.full.bytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' }]);
  assert.deepEqual(t.calls.find((c) => c[0] === 'sign'), ['sign', paths.full, 300]);
  await transport(null, { message: 'duplicate', statusCode: '409' }).storage.upload(paths.full, prepared.full.bytes);
  await assert.rejects(transport(null, { message: 'network' }).storage.upload(paths.full, prepared.full.bytes), /upload failed/);
});
test('repository reserves only metadata/checksum and scopes gallery queries to owner', async () => {
  const row = { id, user_id: owner, photo_url: paths.full, thumbnail_url: paths.thumbnail, taken_at: photo.takenAt, pose_type: 'front', notes: '', upload_status: 'pending', upload_checksum: photo.checksum, is_private: true };
  const t = transport(row); await t.repository.reserve(owner, id, metadata, photo.checksum);
  assert.deepEqual(t.calls[0], ['rpc', 'reserve_progress_photo', { p_user: owner, p_id: id, p_date: metadata.date, p_pose: metadata.pose, p_notes: metadata.notes, p_checksum: photo.checksum }]);
  const page = transport(Array(21).fill(row)); assert.equal((await page.repository.list(owner, 20)).entries.length, 20);
  assert.ok(page.calls.some((c) => c[0] === 'eq' && c[1] === 'user_id' && c[2] === owner)); assert.deepEqual(page.calls.find((c) => c[0] === 'range'), ['range', 20, 40]);
});
test('comparison sorts before/after, handles leap days and missing measurements without invented deltas', () => {
  const before = { ...photo, takenAt: '2020-02-28T00:00:00Z' }; const after = { ...photo, id: other, takenAt: '2020-03-01T00:00:00Z' };
  assert.equal(rules.orderedComparison(after, before).days, 2); assert.equal(rules.orderedComparison(after, before).before.id, id);
  assert.throws(() => rules.orderedComparison(photo, photo));
  const beforeValues = { weightKg: 80, waistCm: 90 }; const afterValues = { weightKg: 78, waistCm: null };
  const changes = rules.comparisonChanges(beforeValues, afterValues); assert.equal(changes.weightKg, -2); assert.equal(changes.waistCm, null);
  assert.ok(Object.values(rules.comparisonChanges(null, null)).every((value) => value === null));
});
test('owner checks prevent signing another users paths; grid groups by date without mutating inputs', async () => {
  const service = new PhotoService({}, { signedUrl: async () => 'secret' });
  assert.throws(() => service.urlForPhoto(owner, { ...photo, status: 'ready', userId: other }, true), /not available/);
  assert.throws(() => service.urlForPhoto(owner, photo, true), /incomplete/);
  const photos = [{ ...photo, id: 'a' }, { ...photo, id: 'b' }, { ...photo, id: 'c' }, { ...photo, id: 'd', takenAt: '2019-01-01' }];
  const rows = rules.photoGridRows(photos); assert.deepEqual(rows.map((row) => [row.photos.length, row.heading]), [[2, true], [1, false], [1, true]]); assert.equal(photos.length, 4);
});
test('measurement snapshots request exact photo dates for the expected account and preserve missing values', async () => {
  const t = transport({ weightKg: 80, waistCm: null });
  assert.equal((await t.repository.measurementsOnDate(owner, '2020-01-01')).weightKg, 80);
  assert.deepEqual(t.calls[0], ['rpc', 'get_photo_date_measurements', { p_user: owner, p_day: '2020-01-01' }]);
  assert.equal(await transport(null).repository.measurementsOnDate(owner, '2020-01-01'), null);
});
