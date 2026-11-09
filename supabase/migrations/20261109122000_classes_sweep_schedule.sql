-- RELEASE DAY ONLY. Do not apply before the release checklist says so
-- (classes-design.md section 15.4, step 4).
--
-- Schedules the live-classes sweep every 5 minutes: Supabase Cron (pg_cron)
-- calls public.classes_sweep_tick() (20261109121000_classes_sweep_tick.sql),
-- which calls https://learnfrc.com/api/classes/sweep through pg_net with the
-- cron secret.
--
-- Before this runs, add two Vault secrets in production (Supabase dashboard,
-- Vault): classes_sweep_url = https://learnfrc.com/api/classes/sweep, and
-- classes_cron_secret = the CRON_SECRET value. The function does nothing while
-- either is missing.
--
-- Neither extension is installed in production before release day, which is
-- why this is its own file: applying it is the moment the sweep starts.
--
-- RE-RUNNABLE: the extensions are guarded, and the schedule is removed before
-- it's added again.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('classes-sweep')
where exists (select 1 from cron.job where jobname = 'classes-sweep');

select cron.schedule('classes-sweep', '*/5 * * * *', $$select public.classes_sweep_tick()$$);
