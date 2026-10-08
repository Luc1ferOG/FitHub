begin;

create extension if not exists pgcrypto with schema extensions;

create type public.unit_system as enum ('metric', 'imperial');
create type public.gender_type as enum ('female', 'male', 'non_binary', 'other', 'prefer_not_to_say');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');
create type public.exercise_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.workout_sync_status as enum ('pending', 'synced', 'failed');
create type public.friendship_status as enum ('pending', 'accepted', 'declined');
create type public.challenge_type as enum ('individual', 'community');
create type public.challenge_metric as enum ('workout_count', 'duration_seconds', 'volume_kg', 'repetitions', 'distance_m');
create type public.challenge_visibility as enum ('public', 'friends', 'private');
create type public.challenge_status as enum ('draft', 'active', 'completed', 'cancelled');
create type public.progress_pose as enum ('front', 'side', 'back', 'other');
create type public.achievement_category as enum ('workout', 'consistency', 'strength', 'social', 'challenge', 'progress');
create type public.achievement_requirement as enum ('workout_count', 'streak_days', 'total_volume', 'friend_count', 'challenge_wins', 'personal_records');
create type public.notification_type as enum ('friend_request', 'friend_accepted', 'challenge_invite', 'challenge_update', 'achievement_unlocked', 'workout_reminder', 'system');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text not null default '',
  date_of_birth date,
  gender public.gender_type,
  height_cm numeric(5, 2),
  weight_kg numeric(6, 2),
  preferred_units public.unit_system not null default 'metric',
  experience_level public.experience_level not null default 'beginner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username = lower(username) and username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80),
  constraint profiles_bio_length check (char_length(bio) <= 500),
  constraint profiles_date_of_birth_valid check (date_of_birth is null or date_of_birth <= current_date),
  constraint profiles_height_valid check (height_cm is null or height_cm between 50 and 300),
  constraint profiles_weight_valid check (weight_kg is null or weight_kg between 20 and 1000)
);

create unique index profiles_username_lower_uidx on public.profiles (lower(username));

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  difficulty public.exercise_difficulty not null,
  instructions text[] not null,
  video_url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  constraint exercises_name_length check (char_length(name) between 2 and 120),
  constraint exercises_description_length check (char_length(description) between 1 and 2000),
  constraint exercises_primary_muscle_present check (btrim(primary_muscle) <> ''),
  constraint exercises_equipment_present check (btrim(equipment) <> ''),
  constraint exercises_instructions_present check (cardinality(instructions) > 0)
);

create unique index exercises_name_lower_uidx on public.exercises (lower(name));
create index exercises_primary_muscle_idx on public.exercises (primary_muscle);
create index exercises_equipment_idx on public.exercises (equipment);
create index exercises_difficulty_idx on public.exercises (difficulty);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text not null default '',
  is_public boolean not null default false,
  estimated_duration integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_name_length check (char_length(name) between 1 and 120),
  constraint workouts_description_length check (char_length(description) <= 2000),
  constraint workouts_duration_valid check (estimated_duration is null or estimated_duration between 1 and 86400)
);

comment on column public.workouts.estimated_duration is 'Estimated workout duration in seconds.';

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  order_index integer not null,
  target_sets integer,
  target_reps integer,
  target_weight numeric(8, 2),
  rest_seconds integer,
  notes text not null default '',
  constraint workout_exercises_order_valid check (order_index >= 0),
  constraint workout_exercises_sets_valid check (target_sets is null or target_sets between 1 and 100),
  constraint workout_exercises_reps_valid check (target_reps is null or target_reps between 1 and 10000),
  constraint workout_exercises_weight_valid check (target_weight is null or target_weight >= 0),
  constraint workout_exercises_rest_valid check (rest_seconds is null or rest_seconds between 0 and 86400),
  constraint workout_exercises_notes_length check (char_length(notes) <= 1000),
  constraint workout_exercises_order_unique unique (workout_id, order_index)
);

create index workouts_owner_created_idx on public.workouts (owner_id, created_at desc);
create index workouts_public_created_idx on public.workouts (created_at desc) where is_public;
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  name text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer,
  total_volume numeric(14, 2) not null default 0,
  notes text not null default '',
  sync_status public.workout_sync_status not null default 'synced',
  constraint workout_sessions_name_length check (char_length(name) between 1 and 120),
  constraint workout_sessions_time_valid check (completed_at is null or completed_at >= started_at),
  constraint workout_sessions_duration_valid check (duration_seconds is null or duration_seconds between 0 and 604800),
  constraint workout_sessions_volume_valid check (total_volume >= 0),
  constraint workout_sessions_notes_length check (char_length(notes) <= 4000)
);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  order_index integer not null,
  notes text not null default '',
  constraint workout_session_exercises_order_valid check (order_index >= 0),
  constraint workout_session_exercises_notes_length check (char_length(notes) <= 1000),
  constraint workout_session_exercises_order_unique unique (session_id, order_index)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises (id) on delete cascade,
  set_number integer not null,
  reps integer,
  weight numeric(8, 2),
  duration_seconds integer,
  distance numeric(10, 2),
  completed boolean not null default false,
  is_personal_record boolean not null default false,
  constraint workout_sets_number_valid check (set_number > 0),
  constraint workout_sets_reps_valid check (reps is null or reps >= 0),
  constraint workout_sets_weight_valid check (weight is null or weight >= 0),
  constraint workout_sets_duration_valid check (duration_seconds is null or duration_seconds >= 0),
  constraint workout_sets_distance_valid check (distance is null or distance >= 0),
  constraint workout_sets_metric_present check (reps is not null or duration_seconds is not null or distance is not null),
  constraint workout_sets_number_unique unique (session_exercise_id, set_number)
);

comment on column public.workout_sets.weight is 'Weight in kilograms.';
comment on column public.workout_sets.distance is 'Distance in metres.';

create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index workout_sessions_workout_idx on public.workout_sessions (workout_id) where workout_id is not null;
create index workout_session_exercises_exercise_idx on public.workout_session_exercises (exercise_id);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint friendships_different_users check (requester_id <> addressee_id)
);

create unique index friendships_pair_uidx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_requester_status_idx on public.friendships (requester_id, status);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  challenge_type public.challenge_type not null default 'individual',
  metric_type public.challenge_metric not null,
  target_value numeric(14, 2) not null,
  start_date date not null,
  end_date date not null,
  visibility public.challenge_visibility not null default 'public',
  status public.challenge_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint challenges_title_length check (char_length(title) between 1 and 150),
  constraint challenges_description_length check (char_length(description) <= 4000),
  constraint challenges_target_valid check (target_value > 0),
  constraint challenges_date_range_valid check (end_date >= start_date)
);

create table public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  current_value numeric(14, 2) not null default 0,
  completed boolean not null default false,
  rank integer,
  constraint challenge_participants_value_valid check (current_value >= 0),
  constraint challenge_participants_rank_valid check (rank is null or rank > 0),
  constraint challenge_participants_unique unique (challenge_id, user_id)
);

create table public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value numeric(14, 2) not null,
  workout_session_id uuid references public.workout_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint challenge_progress_value_valid check (value > 0),
  constraint challenge_progress_participant_fk foreign key (challenge_id, user_id)
    references public.challenge_participants (challenge_id, user_id) on delete cascade
);

create unique index challenge_progress_session_uidx
  on public.challenge_progress (challenge_id, user_id, workout_session_id)
  where workout_session_id is not null;
create index challenges_discovery_idx on public.challenges (status, visibility, start_date, end_date);
create index challenges_creator_idx on public.challenges (creator_id, created_at desc);
create index challenge_participants_user_idx on public.challenge_participants (user_id, joined_at desc);
create index challenge_participants_leaderboard_idx on public.challenge_participants (challenge_id, current_value desc, joined_at);
create index challenge_progress_participant_idx on public.challenge_progress (challenge_id, user_id);
create index challenge_progress_user_created_idx on public.challenge_progress (user_id, created_at desc);
create index challenge_progress_session_idx on public.challenge_progress (workout_session_id) where workout_session_id is not null;

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(6, 2) not null,
  body_fat_percentage numeric(5, 2),
  chest_cm numeric(6, 2),
  waist_cm numeric(6, 2),
  hips_cm numeric(6, 2),
  left_arm_cm numeric(6, 2),
  right_arm_cm numeric(6, 2),
  left_thigh_cm numeric(6, 2),
  right_thigh_cm numeric(6, 2),
  constraint body_measurements_weight_valid check (weight_kg between 20 and 1000),
  constraint body_measurements_fat_valid check (body_fat_percentage is null or body_fat_percentage between 0 and 100),
  constraint body_measurements_chest_valid check (chest_cm is null or chest_cm > 0),
  constraint body_measurements_waist_valid check (waist_cm is null or waist_cm > 0),
  constraint body_measurements_hips_valid check (hips_cm is null or hips_cm > 0),
  constraint body_measurements_left_arm_valid check (left_arm_cm is null or left_arm_cm > 0),
  constraint body_measurements_right_arm_valid check (right_arm_cm is null or right_arm_cm > 0),
  constraint body_measurements_left_thigh_valid check (left_thigh_cm is null or left_thigh_cm > 0),
  constraint body_measurements_right_thigh_valid check (right_thigh_cm is null or right_thigh_cm > 0)
);

create index body_measurements_user_recorded_idx on public.body_measurements (user_id, recorded_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  photo_url text not null,
  thumbnail_url text,
  pose_type public.progress_pose not null,
  taken_at timestamptz not null default now(),
  notes text not null default '',
  is_private boolean not null default true,
  constraint progress_photos_photo_present check (btrim(photo_url) <> ''),
  constraint progress_photos_photo_owned_path check (photo_url like user_id::text || '/%'),
  constraint progress_photos_thumbnail_owned_path check (
    thumbnail_url is null or thumbnail_url like user_id::text || '/%'
  ),
  constraint progress_photos_notes_length check (char_length(notes) <= 1000)
);

create index progress_photos_user_taken_idx on public.progress_photos (user_id, taken_at desc);
create index progress_photos_public_idx on public.progress_photos (taken_at desc) where not is_private;

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  icon text not null,
  category public.achievement_category not null,
  requirement_type public.achievement_requirement not null,
  requirement_value numeric(14, 2) not null,
  constraint achievements_code_format check (code = upper(code) and code ~ '^[A-Z0-9_]{3,50}$'),
  constraint achievements_title_length check (char_length(title) between 1 and 100),
  constraint achievements_description_length check (char_length(description) between 1 and 500),
  constraint achievements_requirement_valid check (requirement_value > 0)
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  constraint user_achievements_unique unique (user_id, achievement_id)
);

create index user_achievements_user_unlocked_idx on public.user_achievements (user_id, unlocked_at desc);
create index user_achievements_achievement_idx on public.user_achievements (achievement_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_title_length check (char_length(title) between 1 and 150),
  constraint notifications_message_length check (char_length(message) between 1 and 2000),
  constraint notifications_data_object check (jsonb_typeof(data) = 'object')
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where not read;

commit;
