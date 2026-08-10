-- ============================================================================
-- Quarantine the synthetic pageviews so they stop corrupting every metric.
--
-- WHAT IS IN page_views (measured 2026-08-10, 10,959 rows, three distinct eras):
--
--   A. 2026-06-19 .. 2026-07-03 — 992 rows, source = 'backfill',
--      visitor = 'seed:<user_id>'. RECONSTRUCTED FROM lesson_progress, so a row
--      exists only for someone who completed a lesson. Any funnel or activation
--      rate computed over these rows reads ~100% by construction. 150 distinct
--      'seed:' pseudo-visitors, 842 of the rows on /guides/ paths.
--
--   B. 2026-07-03 .. 2026-07-22 — 156 rows, real traffic, but the beacon did not
--      yet send a visitor id: `visitor` is NULL on every one. Usable as raw view
--      counts, useless for anything per-person.
--
--   C. 2026-07-22 onward — 9,810 rows, real traffic with real visitor ids.
--
-- THE ROWS ARE NOT DELETED. They are honestly labelled and may stand in for real
-- pre-beacon activity. They are excluded at the read path instead, and the
-- admin panel now states the coverage window of every number it draws from here.
--
-- TREATMENT CHOSEN — EXCLUDE THE BACKFILL FROM EVERYTHING, including the pure
-- view counts. The other option (count them as views, drop them from per-visitor
-- maths) was rejected: these are not observations of pageviews, they are one
-- inferred row per completion, so they systematically understate views for the
-- people they cover and are absent entirely for everyone who never completed a
-- lesson. Mixing 992 inferred rows into 9,966 measured ones with no way for the
-- reader to tell them apart is exactly the failure being fixed. Instead the
-- backfill total is RETURNED SEPARATELY by page_view_summary() and printed as
-- its own labelled line in the panel, so it is visible without being summed in.
--
-- Era B needs no filtering: count(distinct visitor) already ignores NULLs, so
-- those rows are arithmetically harmless. They are a COVERAGE fact, not a
-- correctness one — per-visitor numbers simply start later than view counts —
-- and page_view_summary() now returns both start timestamps so the panel says so.
-- ============================================================================

-- No explicit begin/commit: the Supabase CLI already runs each migration inside
-- one transaction (and none of the other migrations here open their own). An
-- inner `commit;` would close the CLI's transaction early rather than nest.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. One definition of "synthetic", in one place.
--
-- Both markers are checked, not just `source`. `source` is written from the
-- client-settable lf_src cookie (see src/app/api/page-view/route.ts), so it is
-- not by itself a trustworthy provenance flag; `visitor LIKE 'seed:%'` cannot
-- collide with a real id because real ids are crypto.randomUUID() hex, which
-- contains no colon. Today the two markers select exactly the same 992 rows.
-- ────────────────────────────────────────────────────────────────────────────
create or replace view public.page_views_measured as
  select pv.id, pv.path, pv.visitor, pv.created_at, pv.source
    from public.page_views pv
   where coalesce(pv.source, '') <> 'backfill'
     and (pv.visitor is null or pv.visitor not like 'seed:%');

comment on view public.page_views_measured is
  'page_views with the reconstructed 2026-06-19..07-03 backfill removed '
  '(source=''backfill'' / visitor=''seed:%''). Every analytics read goes through '
  'this view; query page_views directly only to inspect the backfill itself.';

-- The view is owned by postgres and therefore BYPASSES the RLS on page_views.
-- Supabase default privileges would hand anon/authenticated a SELECT on it,
-- which would publish every visitor id and path. Match the other admin views:
-- service_role only.
revoke all on public.page_views_measured from public;
revoke all on public.page_views_measured from anon;
revoke all on public.page_views_measured from authenticated;
grant select on public.page_views_measured to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. page_view_summary — EXCLUDE the backfill, and report it separately.
--
-- Was: count(distinct visitor) over the raw table, which counted the 150
-- 'seed:' pseudo-visitors as real people and overstated the headline
-- "Unique visitors" tile by 12% (1,395 shown vs 1,245 real).
--
-- The return type gains columns, so the function has to be dropped, not
-- replaced. Existing column names and order are preserved.
-- ────────────────────────────────────────────────────────────────────────────
drop function if exists public.page_view_summary();

create function public.page_view_summary()
returns table (
  total             bigint,
  views_7d          bigint,
  views_30d         bigint,
  visitors          bigint,
  visitors_30d      bigint,
  visitors_7d       bigint,
  -- Provenance / coverage, so a caller can state what the numbers cover.
  views_since       timestamptz,  -- first measured row of any kind
  visitors_since    timestamptz,  -- first measured row carrying a visitor id
  backfill_views    bigint,       -- synthetic rows held out of `total`
  backfill_visitors bigint,       -- 'seed:' pseudo-visitors held out of `visitors`
  backfill_from     timestamptz,
  backfill_to       timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    (select count(*) from page_views_measured)::bigint,
    (select count(*) from page_views_measured
      where created_at > now() - interval '7 days')::bigint,
    (select count(*) from page_views_measured
      where created_at > now() - interval '30 days')::bigint,
    (select count(distinct visitor) from page_views_measured)::bigint,
    (select count(distinct visitor) from page_views_measured
      where created_at > now() - interval '30 days')::bigint,
    (select count(distinct visitor) from page_views_measured
      where created_at > now() - interval '7 days')::bigint,
    (select min(created_at) from page_views_measured),
    (select min(created_at) from page_views_measured where visitor is not null),
    (select count(*) from page_views pv
      where coalesce(pv.source,'') = 'backfill' or pv.visitor like 'seed:%')::bigint,
    (select count(distinct pv.visitor) from page_views pv
      where coalesce(pv.source,'') = 'backfill' or pv.visitor like 'seed:%')::bigint,
    (select min(pv.created_at) from page_views pv
      where coalesce(pv.source,'') = 'backfill' or pv.visitor like 'seed:%'),
    (select max(pv.created_at) from page_views pv
      where coalesce(pv.source,'') = 'backfill' or pv.visitor like 'seed:%');
$function$;

comment on function public.page_view_summary() is
  'Site-wide pageview totals. TREATMENT: backfill EXCLUDED from every figure; '
  'its size and span are returned separately (backfill_*) so the panel can show '
  'it without summing it in. views_since/visitors_since carry the coverage '
  'window — per-visitor figures start later because the beacon sent no visitor '
  'id before 2026-07-22.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. page_views_daily — EXCLUDE the backfill.
--
-- The 30-day window the admin panel asks for does not currently reach back to
-- 2026-07-03, so this is a no-op today. It is fixed anyway because `days` is a
-- caller-supplied argument: at days => 60 the raw table draws a 992-view hump
-- across June, immediately before the real beacon starts, which reads as a
-- traffic collapse that never happened. Correctness here must not depend on
-- what the caller passes or on today's date.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.page_views_daily(days integer default 30)
returns table (day date, views bigint, visitors bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select created_at::date as day,
         count(*)::bigint,
         count(distinct visitor)::bigint
  from page_views_measured
  where created_at >= (now() - make_interval(days => days - 1))::date
  group by 1 order by 1;
$function$;

comment on function public.page_views_daily(integer) is
  'Daily views/visitors for the growth chart. TREATMENT: backfill EXCLUDED — at '
  'a large `days` it would otherwise draw a synthetic June hump next to the real '
  'series. Days before 2026-07-22 legitimately report visitors = 0: the beacon '
  'sent no visitor id yet.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. visitor_sources — EXCLUDE the backfill. The worst of the corruption.
--
-- Every one of the 150 'seed:' pseudo-visitors carries source = 'backfill', so
-- first-touch attribution rendered "backfill" as the FOURTH-LARGEST acquisition
-- channel on the site (150 visitors, ahead of Chief Delphi at 143) in the panel
-- pie chart. It is not a channel; it is our own reconstruction script.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.visitor_sources()
returns table (source text, all_time bigint, last_7d bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with per_visitor as (
    select distinct on (visitor)
      visitor,
      coalesce(nullif(trim(source), ''), 'Unknown / Direct') as source,
      created_at as first_seen
    from page_views_measured
    where visitor is not null
    order by visitor, created_at asc
  )
  select
    source,
    count(*)::bigint as all_time,
    count(*) filter (where first_seen > now() - interval '7 days')::bigint as last_7d
  from per_visitor
  group by source
  order by 2 desc;
$function$;

comment on function public.visitor_sources() is
  'First-touch acquisition source per unique visitor. TREATMENT: backfill '
  'EXCLUDED — it would otherwise appear as a 150-visitor acquisition channel '
  'named "backfill". Covers visitors first seen from 2026-07-22 (when the '
  'beacon began sending visitor ids).';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. online_visitors — EXCLUDE the backfill.
--
-- No behaviour change today (the window is minutes; the backfill is five weeks
-- old), but this is a distinct-visitor count and the next reconstruction script
-- to stamp rows with now() would inflate the live "Online now" tile. Costs
-- nothing to be right by construction rather than by luck of the calendar.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.online_visitors(minutes integer default 10)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(distinct visitor)::int
  from page_views_measured
  where visitor is not null
    and created_at > now() - make_interval(mins => minutes);
$function$;

comment on function public.online_visitors(integer) is
  'Distinct visitors seen in the last N minutes. TREATMENT: backfill EXCLUDED '
  '(no effect at current dates; guards against a future backfill stamped now()).';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Guide-audience views — EXCLUDE the backfill.
--
-- Not RPCs, but read by src/lib/admin.ts and corrupted the same way: 842 of the
-- 992 backfill rows are /guides/ paths, and the 150 'seed:' pseudo-visitors were
-- being counted in `viewers` (708 shown vs 558 real).
-- ────────────────────────────────────────────────────────────────────────────
create or replace view public.admin_guide_views as
  select split_part(path, '/', 3) as slug,
         count(*) as views,
         count(distinct visitor) as viewers,
         count(*) filter (where created_at > now() - interval '7 days') as views_7d
    from public.page_views_measured
   where path like '/guides/%'
     and split_part(path, '/', 3) <> ''
   group by split_part(path, '/', 3);

create or replace view public.admin_guide_views_summary as
  select count(*) as views,
         count(distinct visitor) as viewers
    from public.page_views_measured
   where path like '/guides/%';

comment on view public.admin_guide_views is
  'Per-department guide audience. TREATMENT: backfill EXCLUDED (842 of its 992 '
  'rows were /guides/ paths).';
comment on view public.admin_guide_views_summary is
  'Guide audience rollup. TREATMENT: backfill EXCLUDED. `viewers` covers '
  '2026-07-22 onward (visitor ids); `views` covers 2026-07-03 onward.';

revoke all on public.admin_guide_views from public;
revoke all on public.admin_guide_views from anon;
revoke all on public.admin_guide_views from authenticated;
revoke all on public.admin_guide_views_summary from public;
revoke all on public.admin_guide_views_summary from anon;
revoke all on public.admin_guide_views_summary from authenticated;
grant select on public.admin_guide_views to service_role;
grant select on public.admin_guide_views_summary to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. top_lessons — NO CHANGE, deliberately.
--
-- Audited and left alone: it reads lesson_progress ⋈ lessons and never touches
-- page_views, so the backfill cannot reach it. Also verified it is not
-- double-counting — lesson_progress holds 4,194 rows over 4,194 distinct
-- (user_id, lesson_id) pairs, so count(lp.*) equals the distinct-completion
-- count. Recorded here so the next audit does not have to re-derive it.
-- ────────────────────────────────────────────────────────────────────────────
comment on function public.top_lessons(integer) is
  'Most-completed lessons. TREATMENT: none needed — sourced from lesson_progress, '
  'not page_views, so the synthetic pageview backfill cannot reach it.';
