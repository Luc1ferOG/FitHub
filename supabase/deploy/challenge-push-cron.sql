-- Optional deployment step after deploying the Edge Function and setting its secret.
-- Admin must provision Vault secrets named fithub_project_url and
-- fithub_challenge_cron_secret (same value as Edge CHALLENGE_CRON_SECRET).
-- Never commit their values or expose them through EXPO_PUBLIC_*.
begin;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if (select count(*) from vault.decrypted_secrets where name = 'fithub_project_url') <> 1
    or (select count(*) from vault.decrypted_secrets where name = 'fithub_challenge_cron_secret') <> 1 then
    raise exception 'Configure the two named Vault secrets before scheduling push delivery';
  end if;
end $$;
select cron.schedule('fithub-challenge-push','* * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fithub_project_url') || '/functions/v1/challenge-notifications',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'fithub_challenge_cron_secret')),
    body := '{}'::jsonb
  );
$job$);
commit;
