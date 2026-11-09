-- The function Supabase Cron calls every 5 minutes to run the live-classes
-- sweep (src/app/api/classes/sweep/route.ts, section 6.9 of the design).
--
-- WHY A DATABASE CRON. The sweep ends classes at their hard end, when the
-- teacher has gone or the room is empty, starts reviews and retries holds. It
-- has to run every few minutes, and Vercel's Hobby crons run once a day at
-- most, so Supabase Cron (pg_cron) calls the route through pg_net instead. The
-- daily entry in vercel.json stays as a backstop.
--
-- APPLIED BEFORE LAUNCH, HARMLESS UNTIL RELEASE DAY. This file only creates
-- the function. It creates no extension and schedules nothing: plpgsql doesn't
-- resolve net.http_get until the function runs, and it returns before that
-- while the two Vault secrets (classes_sweep_url, classes_cron_secret) don't
-- exist. Nothing calls it until 20261109122000_classes_sweep_schedule.sql runs
-- on release day, after the secrets are added. No API role can run it.
--
-- RE-RUNNABLE: create or replace.

create or replace function public.classes_sweep_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u text;
  s text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'classes_sweep_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'classes_cron_secret';
  if u is null or s is null then
    return;
  end if;
  perform net.http_get(
    url := u,
    headers := jsonb_build_object('Authorization', 'Bearer ' || s),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.classes_sweep_tick() from public, anon, authenticated;
