begin;
-- PostgreSQL requires committing new enum labels before using them in migration 017.
alter type public.achievement_category add value if not exists 'streaks';
alter type public.achievement_category add value if not exists 'volume';
alter type public.achievement_requirement add value if not exists 'challenges_joined';
alter type public.achievement_requirement add value if not exists 'challenges_completed';
commit;
