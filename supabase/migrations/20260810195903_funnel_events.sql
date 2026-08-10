-- ============================================================================
-- ACTIVATION FUNNEL INSTRUMENTATION
--
-- The problem this exists to prevent: 45% of accounts never complete a lesson
-- and nothing in the product could say WHERE they stopped. Every funnel number
-- in the 2026-08 investigation had to be reconstructed by matching page_views
-- timestamps against profiles.created_at, because no table records a step.
--
-- Design rules, all enforced here rather than by convention:
--
--  1. MILESTONES, NOT A FIREHOSE. Every step is a once-in-a-lifetime event for
--     its subject, and the partial unique indexes below make that structural.
--     A user contributes AT MOST 6 rows, ever. Re-firing the beacon is a no-op
--     (23505), so callers never need their own dedupe state.
--  2. NO PII, AND NOTHING TO CORRELATE. The row is (step, subject, when). No
--     path, no IP, no user agent, no referrer, no email, no free text.
--  3. ONE SUBJECT PER ROW, NEVER BOTH. When the request carries a session the
--     row is keyed by user_id and `visitor` is left NULL — so this table never
--     becomes the join that links an account to its anonymous device id. Only
--     logged-out events carry the lf_vid visitor key.
--  4. DELETING AN ACCOUNT DELETES ITS EVENTS. user_id is a real FK to
--     auth.users with ON DELETE CASCADE, so erasure is automatic.
--  5. SERVICE-ROLE ONLY. RLS on with no policies, plus explicit revokes —
--     the same posture as page_views and guest_progress. Nothing anon or
--     authenticated can read or write this table directly.
-- ============================================================================

create table if not exists public.funnel_events (
  id         bigint generated always as identity primary key,
  step       text        not null,
  -- Exactly one of these is set (see funnel_events_subject_chk).
  user_id    uuid        references auth.users(id) on delete cascade,
  visitor    text,
  created_at timestamptz not null default now(),

  -- The allow-list lives in the DATABASE as well as in src/lib/funnel.ts. That
  -- duplication is deliberate: it bounds funnel_summary() to six rows forever,
  -- which is what makes that function immune to PostgREST's silent 1000-row
  -- truncation, and it means a typo'd step from a future call site is rejected
  -- rather than quietly creating a seventh invisible bucket.
  constraint funnel_events_step_chk check (step in (
    'signup',
    'lesson_opened',
    'quiz_attempted',
    'lesson_completed',
    'second_lesson_completed',
    'return_visit'
  )),
  -- Rule 3: a row is keyed by an account OR by an anonymous visitor, never
  -- both, and never neither.
  constraint funnel_events_subject_chk check (
    (user_id is not null and visitor is null) or
    (user_id is null and visitor is not null)
  ),
  constraint funnel_events_visitor_len_chk check (
    visitor is null or char_length(visitor) between 1 and 64
  )
);

-- Rule 1, enforced. One row per subject per step, for all time. These are what
-- make the ingest endpoint idempotent: it inserts and treats 23505 as success.
create unique index if not exists funnel_events_user_step_key
  on public.funnel_events (user_id, step) where user_id is not null;
create unique index if not exists funnel_events_visitor_step_key
  on public.funnel_events (visitor, step) where user_id is null;

create index if not exists funnel_events_step_idx    on public.funnel_events (step);
create index if not exists funnel_events_created_idx on public.funnel_events (created_at desc);

comment on table public.funnel_events is
  'Activation-funnel milestones. At most one row per subject per step, ever. No PII: (step, subject, when) only.';

-- Rule 5. RLS with zero policies denies everything to anon/authenticated; the
-- revokes make that explicit instead of leaving it to a default grant.
alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;

-- ============================================================================
-- funnel_summary() — the whole funnel in ONE row per step, six rows total.
--
-- Two sources are merged here, and understanding why is the point of the
-- function:
--
--   DERIVED  — what profiles + lesson_progress can already prove about every
--              account back to the site's first day. This is the backfill: the
--              panel is populated and correct for signup / completed / second /
--              returned from the moment it ships, with no event data at all.
--   MEASURED — recorded funnel_events rows. Today this is the only source for
--              'lesson_opened' and 'quiz_attempted', which nothing in the
--              database has ever been able to answer.
--
-- The merge is a UNION OF SETS, not a max of two counts, because the two
-- sources overlap arbitrarily. It is also transitively closed through
-- `implies`: reaching a later step proves you passed the earlier ones, so a
-- recorded 'lesson_completed' also counts its user at 'lesson_opened' even
-- though that beacon never fired for them. Without that closure the funnel
-- could report more quiz attempts than lesson opens, which would read as a bug
-- and would destroy trust in the panel the first time a beacon was blocked.
--
-- Consequence worth stating plainly: before the beacons are wired, the
-- 'lesson_opened' and 'quiz_attempted' rows are a FLOOR (= everyone who
-- completed a lesson), not a measurement. src/lib/funnel.ts carries that
-- distinction into the UI via the `measured` column rather than hiding it.
-- ============================================================================
create or replace function public.funnel_summary()
returns table (
  step     text,
  accounts bigint,
  measured bigint,
  visitors bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with per_user as (
    select
      p.id,
      p.last_seen_at,
      count(distinct lp.lesson_id)                               as completions,
      count(distinct (lp.completed_at at time zone 'utc')::date) as active_days,
      min(lp.completed_at)                                       as first_completed_at
    from public.profiles p
    left join public.lesson_progress lp on lp.user_id = p.id
    group by p.id, p.last_seen_at
  ),
  steps (step, ord) as (
    values
      ('signup'::text, 1),
      ('lesson_opened', 2),
      ('quiz_attempted', 3),
      ('lesson_completed', 4),
      ('second_lesson_completed', 5),
      ('return_visit', 6)
  ),
  -- "Recording X proves the subject also reached Y." Note the two deliberate
  -- gaps: second_lesson_completed does NOT imply return_visit (most second
  -- lessons happen in the same sitting), and return_visit does NOT imply
  -- second_lesson_completed (you can come back having done exactly one).
  implies (step, implied_by) as (
    values
      ('signup'::text, 'signup'::text),
      ('signup', 'lesson_opened'),
      ('signup', 'quiz_attempted'),
      ('signup', 'lesson_completed'),
      ('signup', 'second_lesson_completed'),
      ('signup', 'return_visit'),
      ('lesson_opened', 'lesson_opened'),
      ('lesson_opened', 'quiz_attempted'),
      ('lesson_opened', 'lesson_completed'),
      ('lesson_opened', 'second_lesson_completed'),
      ('lesson_opened', 'return_visit'),
      ('quiz_attempted', 'quiz_attempted'),
      ('quiz_attempted', 'lesson_completed'),
      ('quiz_attempted', 'second_lesson_completed'),
      ('quiz_attempted', 'return_visit'),
      ('lesson_completed', 'lesson_completed'),
      ('lesson_completed', 'second_lesson_completed'),
      ('lesson_completed', 'return_visit'),
      ('second_lesson_completed', 'second_lesson_completed'),
      ('return_visit', 'return_visit')
  ),
  derived as (
    select 'signup'::text as step, id from per_user
    -- Nothing in the schema records an open or a quiz attempt, but a
    -- completion is proof of both: all 394 lessons gate completion on a quiz.
    union all select 'lesson_opened',    id from per_user where completions >= 1
    union all select 'quiz_attempted',   id from per_user where completions >= 1
    union all select 'lesson_completed', id from per_user where completions >= 1
    union all select 'second_lesson_completed', id from per_user where completions >= 2
    -- "Came back on a later day", derived: a second distinct completion day, or
    -- a presence heartbeat on a calendar day after the first completion (which
    -- catches the return visit that browses without finishing anything).
    -- Deliberately BROADER than retention.ts's returnPct, which counts distinct
    -- completion days only — the two numbers will not match and should not.
    union all
      select 'return_visit', id from per_user
       where completions >= 1
         and (
           active_days >= 2
           or (
             last_seen_at is not null
             and (last_seen_at at time zone 'utc')::date
                 > (first_completed_at at time zone 'utc')::date
           )
         )
  ),
  reached_accounts as (
    select d.step, d.id as subject from derived d
    union
    select i.step, e.user_id
      from implies i
      join public.funnel_events e on e.step = i.implied_by
     where e.user_id is not null
  ),
  reached_visitors as (
    -- Same closure, one exclusion: 'signup' is an account event by definition,
    -- so an anonymous subject can never reach it. Without this filter a guest
    -- who completed a lesson would be closed all the way up into the signup
    -- row and the anonymous column would claim signups that never happened.
    select distinct i.step, e.visitor as subject
      from implies i
      join public.funnel_events e on e.step = i.implied_by
     where e.user_id is null
       and i.step <> 'signup'
  )
  select
    s.step,
    (select count(*) from reached_accounts r where r.step = s.step)::bigint,
    (select count(distinct e.user_id)
       from public.funnel_events e
      where e.step = s.step and e.user_id is not null)::bigint,
    (select count(*) from reached_visitors v where v.step = s.step)::bigint
  from steps s
  order by s.ord;
$$;

comment on function public.funnel_summary() is
  'Six-row activation funnel: derived facts (profiles + lesson_progress) merged with recorded funnel_events, transitively closed so the funnel cannot invert.';

-- Founder metrics. Locked to service_role the same way check_rate_limit is, so
-- it cannot be read through /rest/v1/rpc with the anon key.
revoke all on function public.funnel_summary() from public, anon, authenticated;
grant execute on function public.funnel_summary() to service_role;
