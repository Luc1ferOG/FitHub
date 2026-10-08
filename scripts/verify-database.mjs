import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationFiles = [
  '202610060001_initial_schema.sql',
  '202610060002_security_and_automation.sql',
  '202610060003_storage_policies.sql',
  '202610060004_auth_profile_initialization.sql',
  '202610060005_exercise_library.sql',
  '202610060006_workout_management.sql',
  '202610060007_workout_tracking.sql',
  '202610060008_social_friends.sql',
  '202610060009_fitness_challenges.sql',
  '202610060010_challenge_sync_integration.sql',
  '202610060011_challenge_push_jobs.sql',
  '202610060012_challenge_deadline_schedule.sql',
  '202610060013_leaderboards.sql',
  '202610060014_body_progress.sql',
  '202610060015_private_progress_photos.sql',
  '202610060016_achievement_enums.sql',
  '202610060017_achievement_system.sql',
  '202610070018_home_dashboard.sql',
  '202610070019_friend_request_notifications.sql',
];
const migrations = migrationFiles.map((file) =>
  readFileSync(join('supabase', 'migrations', file), 'utf8'),
);
const schemaSql = migrations[0];
const securitySql = migrations[1];
const storageSql = migrations[2];
const authProfileSql = migrations[3];
const exerciseLibrarySql = migrations[4];
const workoutManagementSql = migrations[5];
const workoutTrackingSql = migrations[6];
const socialSql = migrations[7];
const challengesSql = migrations[8];
const challengeSyncSql = migrations[9];
const challengePushSql = migrations[10];
const leaderboardsSql = migrations[12];
const progressSql = migrations[13];
const photosSql = migrations[14];
const achievementsSql = migrations[16];
const dashboardSql = migrations[17];
const friendNotificationsSql = migrations[18];
if (!/security definer set search_path = ''/.test(friendNotificationsSql) ||
  !/new.addressee_id,'friend_request'/.test(friendNotificationsSql) ||
  !/private.challenge_push_outbox/.test(friendNotificationsSql) ||
  !/revoke all on function private.notify_friend_request\(\) from public,anon,authenticated/.test(friendNotificationsSql) ||
  !/after insert on public.friendships/.test(friendNotificationsSql))
  throw new Error('Friend notification recipient, private outbox or trigger safeguards missing.');
if (!/actor uuid := auth.uid\(\)/.test(dashboardSql) ||
  !/actor is null/.test(dashboardSql) || !/pg_catalog.pg_timezone_names/.test(dashboardSql) ||
  !/user_id=actor/.test(dashboardSql) || !/owner_id=actor/.test(dashboardSql) ||
  !/private.can_view_challenge\(c.id\)/.test(dashboardSql) || !/status='accepted'/.test(dashboardSql) ||
  !/limit 3/.test(dashboardSql) || !/limit 8/.test(dashboardSql) ||
  !/revoke all on function public.get_home_dashboard\(text\) from public,anon/.test(dashboardSql))
  throw new Error('Dashboard identity, visibility, time zone or bounded snapshot safeguards missing.');
if (!/unique\(user_id,event_key\)/.test(achievementsSql) ||
  !/on conflict\(user_id,achievement_id\) do nothing/.test(achievementsSql) ||
  !/auth.uid\(\) is distinct from p_user/.test(achievementsSql) ||
  !/awarded := private.evaluate_achievements\(actor\)/.test(achievementsSql) ||
  !/revoke all on function public.run_achievement_events\(\) from public,anon,authenticated/.test(achievementsSql) ||
  !/end_date\+7</.test(achievementsSql) ||
  !/where id=any\(ids\)/.test(achievementsSql) ||
  !/alter table public.achievement_events enable row level security/.test(achievementsSql) ||
  !/alter table public.achievement_metrics enable row level security/.test(achievementsSql))
  throw new Error('Achievement authority, idempotence, privacy or queue safeguards missing.');
if (!/progress_photos_always_private check \(is_private\)/.test(photosSql) ||
  !/drop policy progress_photos_read_visible on storage.objects/.test(photosSql) ||
  !/drop policy progress_photos_read_visible on public.progress_photos/.test(photosSql) ||
  !/actor is distinct from p_user/.test(photosSql) ||
  !/get_photo_date_measurements[\s\S]+security invoker[\s\S]+user_id = auth.uid\(\)/.test(photosSql) ||
  !/upload_status = 'deleting'/.test(photosSql) ||
  !/for share;/.test(photosSql) ||
  !/file_size_limit = 4194304/.test(photosSql) ||
  !/revoke insert\(id,user_id,photo_url/.test(photosSql)) throw new Error('Private photo lifecycle, storage limits or write restrictions missing.');
if (!/security invoker set search_path = ''/i.test(progressSql) ||
  !/where user_id = actor/.test(progressSql) ||
  !/revoke all on function public.get_body_progress\(text,date\) from public,anon/.test(progressSql) ||
  !/least\(119/.test(progressSql) ||
  !/num_nonnulls/.test(progressSql) ||
  !/body_measurements_supported_ranges/.test(progressSql) ||
  !/recorded_at desc,id desc/.test(progressSql)) throw new Error('Body progress privacy, chart bounds or integrity checks missing.');
const seedSql = readFileSync(join('supabase', 'seed.sql'), 'utf8');

const expectedTables = [
  'profiles',
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sessions',
  'workout_session_exercises',
  'workout_sets',
  'friendships',
  'challenges',
  'challenge_participants',
  'challenge_progress',
  'body_measurements',
  'progress_photos',
  'achievements',
  'user_achievements',
  'notifications',
];

const failures = [];
const requireMatch = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const [index, sql] of migrations.entries()) {
  requireMatch(/^begin;/m.test(sql), `${migrationFiles[index]} must start a transaction`);
  requireMatch(/commit;\s*$/m.test(sql), `${migrationFiles[index]} must commit its transaction`);
  requireMatch((sql.match(/\$\$/g) ?? []).length % 2 === 0, `${migrationFiles[index]} has unbalanced dollar quotes`);
  requireMatch(!/(?:\bas|\bend;)\s+\$(?!\$)/m.test(sql), `${migrationFiles[index]} has a malformed function dollar delimiter`);
}

for (const table of expectedTables) {
  requireMatch(
    schemaSql.includes(`create table public.${table}`),
    `Missing table: ${table}`,
  );
  requireMatch(
    securitySql.includes(`alter table public.${table} enable row level security`),
    `RLS is not enabled on: ${table}`,
  );
}

const securityDefinerBlocks = migrations.join('\n').match(
  /create(?: or replace)? function[\s\S]*?security definer[\s\S]*?\$\$;/g,
) ?? [];
for (const block of securityDefinerBlocks) {
  requireMatch(
    block.includes("set search_path = ''"),
    'Every SECURITY DEFINER function must use an empty search_path',
  );
}

requireMatch(
  !/create policy[^;]+challenge_progress[^;]+for insert/is.test(securitySql),
  'Challenge progress must not have a direct client insert policy',
);
requireMatch(
  !/grant\s+insert[^;]+challenge_progress/is.test(securitySql),
  'Authenticated users must not receive direct challenge-progress insert privileges',
);
requireMatch(
  !/grant\s+(insert|update|delete)[^;]+user_achievements/is.test(securitySql),
  'Achievement awards must be server-managed',
);
requireMatch(
  /grant update \(read\) on public\.notifications/.test(securitySql),
  'Notification clients should only update the read flag',
);
requireMatch(
  /create view public\.public_profiles[\s\S]+security_invoker = false/.test(securitySql),
  'Public profiles must use the restricted projection view',
);
requireMatch(
  /bucket_id = 'progress-photos'[\s\S]+storage\.foldername\(name\)/.test(storageSql),
  'Progress-photo objects must be scoped to user folders',
);
requireMatch(
  /progress_photos_photo_owned_path[\s\S]+photo_url like user_id::text/.test(schemaSql),
  'Progress-photo metadata must not be able to expose another user’s object path',
);
requireMatch(
  /insert into public\.profiles[\s\S]+preferred_units[\s\S]+experience_level/.test(authProfileSql),
  'Auth registration must initialize a profile with explicit defaults',
);
requireMatch(
  exerciseLibrarySql.includes('add column form_tips text[] not null')
    && exerciseLibrarySql.includes('add column common_mistakes text[] not null'),
  'Exercise guides must have non-null coaching arrays',
);
requireMatch(
  exerciseLibrarySql.includes('security invoker')
    && exerciseLibrarySql.includes("set search_path = ''")
    && exerciseLibrarySql.includes('grant execute on function public.get_exercise_filter_options() to authenticated'),
  'Exercise filter metadata must preserve caller RLS and limit RPC execution',
);

const exerciseSeedIds = new Set(seedSql.match(/10000000-0000-0000-0000-\d{12}/g) ?? []);
requireMatch(
  workoutTrackingSql.includes('actor is distinct from p_user_id')
    && workoutTrackingSql.includes('for update;')
    && workoutTrackingSql.includes('stored.payload_hash is distinct from fingerprint')
    && workoutTrackingSql.includes('return stored.receipt;')
    && workoutTrackingSql.includes('insert into private.workout_sync_receipts'),
  'Session synchronization must enforce ownership, immutable payloads and idempotent receipts',
);
requireMatch(
  workoutTrackingSql.includes('alter table private.workout_sync_receipts enable row level security')
    && workoutTrackingSql.includes('revoke all on private.workout_sync_receipts from public, anon, authenticated')
    && workoutTrackingSql.includes('revoke insert, update, delete on public.workout_sessions, public.workout_session_exercises, public.workout_sets')
    && workoutTrackingSql.includes('on conflict (user_id, achievement_id) do nothing'),
  'History, PR flags and achievements must only be written through server-authoritative aggregates',
);
requireMatch(
  workoutManagementSql.includes("security definer set search_path = ''")
    && workoutManagementSql.includes('owner_id = actor for update')
    && workoutManagementSql.includes('current_version <> p_expected_updated_at')
    && workoutManagementSql.includes('jsonb_array_length(p_exercises) not between 1 and 100'),
  'Workout aggregate writes must check identity, ownership, version and exercise count',
);
requireMatch(
  workoutManagementSql.includes('revoke insert, update, delete on public.workouts, public.workout_exercises')
    && workoutManagementSql.includes('update (workout_id, exercise_id, order_index')
    && workoutManagementSql.includes('from public, anon;'),
  'Workout writes must not bypass aggregate RPCs through table or column grants',
);
const achievementSeedIds = new Set(seedSql.match(/20000000-0000-0000-0000-\d{12}/g) ?? []);
requireMatch(leaderboardsSql.includes('share_friends_leaderboard boolean not null default false')
  && leaderboardsSql.includes('alter table private.daily_workout_scores enable row level security')
  && leaderboardsSql.includes('where p.id = actor or p.share_friends_leaderboard')
  && leaderboardsSql.includes('for select to authenticated using(user_id = auth.uid())'), 'Friends leaderboard must protect opt-in scores and owner-only realtime signals');
requireMatch(leaderboardsSql.includes('p_version is distinct from version')
  && leaderboardsSql.includes('p_version is distinct from c.leaderboard_version::text')
  && leaderboardsSql.includes('value = p_value and user_id > p_user')
  && leaderboardsSql.includes('order by p.current_value desc,p.user_id limit 21')
  && leaderboardsSql.includes('dense_rank() over(order by value desc)'), 'Leaderboards require stable keyset ordering, server ties, bounded pages and stale-cursor rejection');
requireMatch(leaderboardsSql.includes('alter publication supabase_realtime add table public.leaderboard_revisions')
  && leaderboardsSql.includes('from public,anon,authenticated;')
  && leaderboardsSql.includes('where f.status = \'accepted\'')
  && leaderboardsSql.includes('p_include_unshared or p.share_friends_leaderboard'), 'Realtime revisions must be server-controlled and not signal unshared workouts to friends');
requireMatch(challengesSql.includes('s.started_at < p.joined_at')
  && challengesSql.includes('e.exercise_id = c.exercise_id')
  && challengesSql.includes('on conflict(challenge_id,user_id,workout_session_id)')
  && challengesSql.includes('revoke all on function public.record_challenge_progress(uuid,uuid) from public,anon,authenticated'),
  'Challenge scores must derive from eligible owned sessions, scope repetitions and reject direct client progress RPCs');
requireMatch(challengesSql.includes('set left_at = now()') && challengesSql.includes('do update set left_at = null,joined_at = now()')
  && challengesSql.includes('dense_rank() over(order by value desc)') && challengesSql.includes('revoke insert(id,challenge_id,user_id)'),
  'Membership must preserve duplicate ledgers, rank ties equally and revoke direct participant writes');
for (const table of ['challenge_invites','push_devices']) requireMatch(challengesSql.includes(`alter table public.${table} enable row level security`),`New challenge table requires RLS: ${table}`);
requireMatch(challengeSyncSql.includes('cp.left_at is null') && challengeSyncSql.includes('if progress.id is not null then'),
  'Workout sync must skip inactive participants and nonqualifying progress without aborting saves');
requireMatch(challengesSql.includes('alter publication supabase_realtime add table public.challenges')
  && challengesSql.includes('primary key(user_id,event_key)') && challengePushSql.includes('for update skip locked')
  && challengePushSql.includes('where id = p_id and lease_id = p_lease')
  && challengePushSql.includes('from public,anon,authenticated;'), 'Challenge realtime, event deduplication and service-only leased push delivery must be secured');
requireMatch(socialSql.includes('pg_advisory_xact_lock')
  && socialSql.includes('p_expected_id is distinct from relation.id')
  && socialSql.includes('relation.addressee_id = actor')
  && socialSql.includes('revoke insert (id, requester_id, addressee_id, status), update (status)')
  && socialSql.includes('from public, anon;'), 'Social transitions must serialize pairs, reject stale identities and restrict write grants');
requireMatch(socialSql.includes('from public.public_profiles p where p.id = p_target')
  && socialSql.includes('where owner_id = p.id and is_public')
  && !socialSql.includes('public.workout_sessions')
  && socialSql.includes('limit 21 offset p_offset'), 'Social reads must be paginated and keep private workout history out of public profiles');
requireMatch(exerciseSeedIds.size >= 25, `Expected 25 exercise seeds, found ${exerciseSeedIds.size}`);
requireMatch(achievementSeedIds.size >= 18, `Expected 17 active and one legacy achievement seeds, found ${achievementSeedIds.size}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Verified ${expectedTables.length} tables with RLS coverage.`);
  console.log('Verified RLS for 2 additional challenge/push tables and service-only push jobs.');
  console.log('Verified private daily scores, owner-only leaderboard revisions and versioned cursor RPCs.');
  console.log('Verified owner-scoped body progress RPC, numeric constraints and bounded charts (static checks only).');
  console.log('Verified private photo bucket, owner policies, explicit write RPCs and recoverable upload/delete states (static checks only).');
  console.log(`Verified ${securityDefinerBlocks.length} hardened SECURITY DEFINER functions.`);
  console.log(`Verified ${exerciseSeedIds.size} exercises and ${achievementSeedIds.size} achievements.`);
  console.log('Verified protected write paths for challenges, achievements, and notifications.');
  console.log('Verified achievement event/metric RLS, centralized sync awards, duplicate safeguards and service-only workers (static checks only).');
}
