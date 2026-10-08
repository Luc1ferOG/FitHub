import { photoMetadataSchema, photoRowSchema } from '../photo-schema';
it('accepts valid private-photo metadata and rejects impossible dates/poses/long notes', () => {
  expect(photoMetadataSchema.safeParse({ date: '2020-01-01', pose: 'front', notes: 'Day one' }).success).toBe(true);
  for (const metadata of [{ date: '2020-02-30', pose: 'front', notes: '' }, { date: '2020-01-01', pose: 'other', notes: '' }, { date: '2020-01-01', pose: 'side', notes: 'a'.repeat(1001) }]) expect(photoMetadataSchema.safeParse(metadata).success).toBe(false);
});
it('never accepts a public record from the private upload RPC', () => {
  const row = { id: 'photo', user_id: 'owner', photo_url: 'owner/photo/full.jpg', thumbnail_url: null, pose_type: 'front', taken_at: '2020-01-01', notes: '', upload_status: 'ready', upload_checksum: null, is_private: false };
  expect(photoRowSchema.safeParse(row).success).toBe(false);
  expect(photoRowSchema.safeParse({ ...row, is_private: true }).success).toBe(true);
});
