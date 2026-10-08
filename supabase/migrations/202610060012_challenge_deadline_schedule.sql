begin;
-- Supabase Postgres includes pg_cron. This keeps ending-soon/in-app end events
-- automatic even when no mobile client or push worker is running.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('fithub-challenge-deadlines','*/5 * * * *','select public.run_challenge_deadlines();');
commit;
