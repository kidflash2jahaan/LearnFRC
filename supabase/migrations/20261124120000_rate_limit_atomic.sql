-- The site's rate limiter (src/lib/rate-limit.ts), made atomic (2026-11-24).
--
-- check_rate_limit and rate_limit_hits were only ever made in the dashboard,
-- so this is their first copy in the repo. The function counts a bucket's
-- recent hits and then inserts one, in two steps with no lock, so a burst of
-- calls at the same moment all read the same count and all get through. That
-- let a parallel burst go past a limit like 10 wrong passwords per 5 minutes.
-- The advisory lock below makes calls on one bucket take turns; calls on
-- different buckets still run side by side.
--
-- The function below is the live one, read from the database on Nov 24, with
-- the lock added and nothing else changed. CREATE OR REPLACE keeps its owner
-- and its grants; the grants are restated for a fresh database. The table
-- statements do nothing on production, where the table already exists.
--
-- Additive and re-runnable, and safe in either order with the code. Nothing
-- applies migrations on deploy (Vercel only runs next build), so apply this
-- by hand, then check it took:
--
--   select pg_get_functiondef('public.check_rate_limit'::regproc)
--          like '%pg_advisory_xact_lock%' as applied;   -- expect true

create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_bucket_time_idx
  on public.rate_limit_hits (bucket, created_at);
-- no policies: only the service role (and this function) reads or writes it
alter table public.rate_limit_hits enable row level security;

create or replace function public.check_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cnt int;
begin
  -- one call per bucket at a time, held until this call's transaction ends
  perform pg_advisory_xact_lock(hashtext(p_bucket));
  delete from public.rate_limit_hits where created_at < now() - interval '1 day';
  select count(*) into cnt from public.rate_limit_hits
    where bucket = p_bucket
      and created_at > now() - make_interval(secs => p_window_seconds);
  if cnt >= p_max then return false; end if;
  insert into public.rate_limit_hits (bucket) values (p_bucket);
  return true;
end;
$function$;

-- not callable through /rest/v1/rpc: the server calls it with the service role
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
