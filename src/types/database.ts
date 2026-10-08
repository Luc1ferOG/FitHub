export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UnitSystem = 'metric' | 'imperial';
export type GenderType = 'female' | 'male' | 'non_binary' | 'other' | 'prefer_not_to_say';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type ExerciseDifficulty = ExperienceLevel;
export type WorkoutSyncStatus = 'pending' | 'synced' | 'failed';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type ChallengeType = 'individual' | 'community';
export type ChallengeMetric =
  | 'workout_count'
  | 'duration_seconds'
  | 'volume_kg'
  | 'repetitions'
  | 'distance_m';
export type ChallengeVisibility = 'public' | 'friends' | 'private';
export type ChallengeStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type ProgressPose = 'front' | 'side' | 'back' | 'other';
export type AchievementCategory =
  | 'workout'
  | 'consistency'
  | 'streaks'
  | 'volume'
  | 'strength'
  | 'social'
  | 'challenge'
  | 'progress';
export type AchievementRequirement =
  | 'workout_count'
  | 'streak_days'
  | 'total_volume'
  | 'friend_count'
  | 'challenges_joined'
  | 'challenges_completed'
  | 'challenge_wins'
  | 'personal_records';
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'challenge_invite'
  | 'challenge_update'
  | 'achievement_unlocked'
  | 'workout_reminder'
  | 'system';

export type ProfileRow = {
  share_friends_leaderboard: boolean;
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  date_of_birth: string | null;
  gender: GenderType | null;
  height_cm: number | null;
  weight_kg: number | null;
  preferred_units: UnitSystem;
  experience_level: ExperienceLevel;
  created_at: string;
  updated_at: string;
};

export type ExerciseRow = {
  id: string;
  name: string;
  description: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string;
  difficulty: ExerciseDifficulty;
  instructions: string[];
  form_tips: string[];
  common_mistakes: string[];
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

export type WorkoutRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  is_public: boolean;
  estimated_duration: number | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  notes: string;
};

export type WorkoutSessionRow = {
  id: string;
  user_id: string;
  workout_id: string | null;
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  total_volume: number;
  notes: string;
  sync_status: WorkoutSyncStatus;
};

export type WorkoutSessionExerciseRow = {
  exercise_name: string;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
  skipped: boolean;
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  notes: string;
};

export type WorkoutSetRow = {
  completed_at: string | null;
  id: string;
  session_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  distance: number | null;
  completed: boolean;
  is_personal_record: boolean;
};

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
};

export type ChallengeRow = {
  participant_count: number;
  exercise_id: string | null;
  leaderboard_version: number;
  id: string;
  creator_id: string;
  title: string;
  description: string;
  challenge_type: ChallengeType;
  metric_type: ChallengeMetric;
  target_value: number;
  start_date: string;
  end_date: string;
  visibility: ChallengeVisibility;
  status: ChallengeStatus;
  created_at: string;
};

export type ChallengeParticipantRow = {
  left_at: string | null;
  id: string;
  challenge_id: string;
  user_id: string;
  joined_at: string;
  current_value: number;
  completed: boolean;
  rank: number | null;
};

export type ChallengeProgressRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  value: number;
  workout_session_id: string | null;
  created_at: string;
};

export type BodyMeasurementRow = {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
};

export type ProgressPhotoRow = {
  id: string;
  user_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  pose_type: ProgressPose;
  taken_at: string;
  notes: string;
  is_private: boolean;
  upload_status: 'pending' | 'ready' | 'deleting';
  upload_checksum: string | null;
};

export type AchievementRow = {
  is_active: boolean;
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement_type: AchievementRequirement;
  requirement_value: number;
};

export type UserAchievementRow = {
  presented_at: string | null;
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Json;
  read: boolean;
  created_at: string;
};

type InsertShape<Row, RequiredKeys extends keyof Row> = Pick<Row, RequiredKeys> &
  Partial<Omit<Row, RequiredKeys>>;
type UpdateShape<Row> = Partial<Row>;

type Relationship<
  ForeignKeyName extends string,
  Columns extends readonly string[],
  ReferencedRelation extends string,
  ReferencedColumns extends readonly string[],
  IsOneToOne extends boolean = false,
> = {
  foreignKeyName: ForeignKeyName;
  columns: Columns;
  isOneToOne: IsOneToOne;
  referencedRelation: ReferencedRelation;
  referencedColumns: ReferencedColumns;
};

export type Database = {
  public: {
    Tables: {
      achievement_events: {
        Row: { id: string; user_id: string; event_key: string; event_type: string; source_id: string; occurred_at: string; processed_at: string | null };
        Insert: never; Update: never; Relationships: [];
      };
      achievement_metrics: { Row: { user_id: string; progress: Json }; Insert: never; Update: never; Relationships: [] };
      leaderboard_revisions: {
        Row: { user_id: string; revision: number };
        Insert: { user_id: string; revision?: number };
        Update: { revision?: number };
        Relationships: [];
      };
      challenge_invites: {
        Row: { id: string; challenge_id: string; user_id: string; invited_by: string; status: 'pending' | 'accepted' | 'declined'; created_at: string };
        Insert: { challenge_id: string; user_id: string; invited_by: string; id?: string; status?: 'pending' | 'accepted' | 'declined'; created_at?: string };
        Update: { status?: 'pending' | 'accepted' | 'declined' };
        Relationships: [Relationship<'challenge_invites_challenge_id_fkey', ['challenge_id'], 'challenges', ['id']>];
      };
      push_devices: {
        Row: { token: string; user_id: string; updated_at: string };
        Insert: { token: string; user_id: string; updated_at?: string };
        Update: { updated_at?: string };
        Relationships: [];
      };
      profiles: { Row: ProfileRow; Insert: InsertShape<ProfileRow, 'id' | 'username' | 'display_name'>; Update: UpdateShape<ProfileRow>; Relationships: [] };
      exercises: { Row: ExerciseRow; Insert: InsertShape<ExerciseRow, 'name' | 'description' | 'primary_muscle' | 'equipment' | 'difficulty' | 'instructions'>; Update: UpdateShape<ExerciseRow>; Relationships: [] };
      workouts: {
        Row: WorkoutRow;
        Insert: InsertShape<WorkoutRow, 'owner_id' | 'name'>;
        Update: UpdateShape<WorkoutRow>;
        Relationships: [Relationship<'workouts_owner_id_fkey', ['owner_id'], 'profiles', ['id']>];
      };
      workout_exercises: {
        Row: WorkoutExerciseRow;
        Insert: InsertShape<WorkoutExerciseRow, 'workout_id' | 'exercise_id' | 'order_index'>;
        Update: UpdateShape<WorkoutExerciseRow>;
        Relationships: [Relationship<'workout_exercises_workout_id_fkey', ['workout_id'], 'workouts', ['id']>, Relationship<'workout_exercises_exercise_id_fkey', ['exercise_id'], 'exercises', ['id']>];
      };
      workout_sessions: {
        Row: WorkoutSessionRow;
        Insert: InsertShape<WorkoutSessionRow, 'user_id' | 'name' | 'started_at'>;
        Update: UpdateShape<WorkoutSessionRow>;
        Relationships: [Relationship<'workout_sessions_user_id_fkey', ['user_id'], 'profiles', ['id']>, Relationship<'workout_sessions_workout_id_fkey', ['workout_id'], 'workouts', ['id']>];
      };
      workout_session_exercises: {
        Row: WorkoutSessionExerciseRow;
        Insert: InsertShape<WorkoutSessionExerciseRow, 'session_id' | 'exercise_id' | 'order_index'>;
        Update: UpdateShape<WorkoutSessionExerciseRow>;
        Relationships: [Relationship<'workout_session_exercises_session_id_fkey', ['session_id'], 'workout_sessions', ['id']>, Relationship<'workout_session_exercises_exercise_id_fkey', ['exercise_id'], 'exercises', ['id']>];
      };
      workout_sets: {
        Row: WorkoutSetRow;
        Insert: InsertShape<WorkoutSetRow, 'session_exercise_id' | 'set_number'>;
        Update: UpdateShape<WorkoutSetRow>;
        Relationships: [Relationship<'workout_sets_session_exercise_id_fkey', ['session_exercise_id'], 'workout_session_exercises', ['id']>];
      };
      friendships: {
        Row: FriendshipRow;
        Insert: InsertShape<FriendshipRow, 'requester_id' | 'addressee_id'>;
        Update: UpdateShape<FriendshipRow>;
        Relationships: [Relationship<'friendships_requester_id_fkey', ['requester_id'], 'profiles', ['id']>, Relationship<'friendships_addressee_id_fkey', ['addressee_id'], 'profiles', ['id']>];
      };
      challenges: {
        Row: ChallengeRow;
        Insert: InsertShape<ChallengeRow, 'creator_id' | 'title' | 'metric_type' | 'target_value' | 'start_date' | 'end_date'>;
        Update: UpdateShape<ChallengeRow>;
        Relationships: [Relationship<'challenges_creator_id_fkey', ['creator_id'], 'profiles', ['id']>];
      };
      challenge_participants: {
        Row: ChallengeParticipantRow;
        Insert: InsertShape<ChallengeParticipantRow, 'challenge_id' | 'user_id'>;
        Update: UpdateShape<ChallengeParticipantRow>;
        Relationships: [Relationship<'challenge_participants_challenge_id_fkey', ['challenge_id'], 'challenges', ['id']>, Relationship<'challenge_participants_user_id_fkey', ['user_id'], 'profiles', ['id']>];
      };
      challenge_progress: {
        Row: ChallengeProgressRow;
        Insert: InsertShape<ChallengeProgressRow, 'challenge_id' | 'user_id' | 'value'>;
        Update: UpdateShape<ChallengeProgressRow>;
        Relationships: [Relationship<'challenge_progress_challenge_id_fkey', ['challenge_id'], 'challenges', ['id']>, Relationship<'challenge_progress_user_id_fkey', ['user_id'], 'profiles', ['id']>, Relationship<'challenge_progress_workout_session_id_fkey', ['workout_session_id'], 'workout_sessions', ['id']>];
      };
      body_measurements: {
        Row: BodyMeasurementRow;
        Insert: InsertShape<BodyMeasurementRow, 'user_id'>;
        Update: UpdateShape<BodyMeasurementRow>;
        Relationships: [Relationship<'body_measurements_user_id_fkey', ['user_id'], 'profiles', ['id']>];
      };
      progress_photos: {
        Row: ProgressPhotoRow;
        Insert: InsertShape<ProgressPhotoRow, 'user_id' | 'photo_url' | 'pose_type'>;
        Update: UpdateShape<ProgressPhotoRow>;
        Relationships: [Relationship<'progress_photos_user_id_fkey', ['user_id'], 'profiles', ['id']>];
      };
      achievements: { Row: AchievementRow; Insert: InsertShape<AchievementRow, 'code' | 'title' | 'description' | 'icon' | 'category' | 'requirement_type' | 'requirement_value'>; Update: UpdateShape<AchievementRow>; Relationships: [] };
      user_achievements: {
        Row: UserAchievementRow;
        Insert: InsertShape<UserAchievementRow, 'user_id' | 'achievement_id'>;
        Update: UpdateShape<UserAchievementRow>;
        Relationships: [Relationship<'user_achievements_user_id_fkey', ['user_id'], 'profiles', ['id']>, Relationship<'user_achievements_achievement_id_fkey', ['achievement_id'], 'achievements', ['id']>];
      };
      notifications: {
        Row: NotificationRow;
        Insert: InsertShape<NotificationRow, 'user_id' | 'type' | 'title' | 'message'>;
        Update: UpdateShape<NotificationRow>;
        Relationships: [Relationship<'notifications_user_id_fkey', ['user_id'], 'profiles', ['id']>];
      };
    };
    Views: {
      public_profiles: {
        Row: Pick<ProfileRow, 'id' | 'username' | 'display_name' | 'avatar_url' | 'bio' | 'experience_level' | 'created_at'>;
        Relationships: [];
      };
    };
    Functions: {
      get_home_dashboard: { Args: { p_timezone: string }; Returns: Json };
      get_my_achievements: { Args: { p_user: string }; Returns: Json };
      reconcile_achievements: { Args: { p_user: string }; Returns: undefined };
      acknowledge_achievement: { Args: { p_user: string; p_id: string }; Returns: undefined };
      run_achievement_events: { Args: Record<string, never>; Returns: undefined };
      finalize_achievement_challenges: { Args: Record<string, never>; Returns: undefined };
      get_photo_date_measurements: { Args: { p_user: string; p_day: string }; Returns: Json };
      reserve_progress_photo: { Args: { p_user: string; p_id: string; p_date: string; p_pose: ProgressPose; p_notes: string; p_checksum: string }; Returns: Json };
      finish_progress_photo: { Args: { p_id: string }; Returns: Json };
      begin_delete_progress_photo: { Args: { p_id: string }; Returns: Json };
      finish_delete_progress_photo: { Args: { p_id: string }; Returns: undefined };
      get_body_progress: { Args: { p_period: string; p_today: string }; Returns: Json };
      get_friends_leaderboard: { Args: { p_value: number | null; p_user: string | null; p_version: string | null }; Returns: Json };
      get_challenge_leaderboard: { Args: { p_challenge: string; p_value: number | null; p_user: string | null; p_version: string | null }; Returns: Json };
      create_fitness_challenge: { Args: { p_input: Json }; Returns: string };
      list_fitness_challenges: { Args: { p_kind: string; p_offset: number }; Returns: Json };
      manage_challenge_membership: { Args: { p_challenge: string; p_action: string; p_user: string | null }; Returns: undefined };
      get_fitness_challenge: { Args: { p_challenge: string; p_offset: number }; Returns: Json };
      register_challenge_push: { Args: { p_token: string }; Returns: undefined };
      run_challenge_deadlines: { Args: Record<string, never>; Returns: undefined };
      change_friendship: { Args: { p_target: string; p_action: string; p_expected_id: string | null }; Returns: Json };
      search_social_users: { Args: { p_search: string; p_offset: number }; Returns: Json };
      list_social_friends: { Args: { p_kind: string; p_offset: number }; Returns: Json };
      get_social_profile: { Args: { p_target: string }; Returns: Json };
      get_workout_exercise_history: { Args: { p_exercise_ids: string[] }; Returns: Json };
      sync_workout_session: { Args: { p_user_id: string; p_session_id: string; p_payload: Json }; Returns: Json };
      save_workout: { Args: { p_workout_id: string | null; p_expected_updated_at: string | null; p_name: string; p_description: string; p_is_public: boolean; p_estimated_duration: number | null; p_exercises: Json }; Returns: string };
      delete_workout: { Args: { p_workout_id: string; p_expected_updated_at: string }; Returns: undefined };
      get_exercise_filter_options: { Args: Record<string, never>; Returns: Json };
      record_challenge_progress: { Args: { p_challenge_id: string; p_workout_session_id: string }; Returns: ChallengeProgressRow };
    };
    Enums: {
      achievement_category: AchievementCategory;
      achievement_requirement: AchievementRequirement;
      challenge_metric: ChallengeMetric;
      challenge_status: ChallengeStatus;
      challenge_type: ChallengeType;
      challenge_visibility: ChallengeVisibility;
      exercise_difficulty: ExerciseDifficulty;
      experience_level: ExperienceLevel;
      friendship_status: FriendshipStatus;
      gender_type: GenderType;
      notification_type: NotificationType;
      progress_pose: ProgressPose;
      unit_system: UnitSystem;
      workout_sync_status: WorkoutSyncStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName]['Row'];
export type TablesInsert<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName]['Insert'];
export type TablesUpdate<TableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TableName]['Update'];
export type Enums<EnumName extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][EnumName];
