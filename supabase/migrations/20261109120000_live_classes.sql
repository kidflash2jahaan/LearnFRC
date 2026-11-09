-- Live classes: teen teachers, students, RealtimeKit rooms, the class chat,
-- AI notes, hours letters and evidence holds.
--
-- WHAT THIS IS. Teachers aged 13 to 17 apply, Jahaan accepts them, and they
-- schedule classes on a LearnFRC lesson or module. Students aged 13 to 17 with
-- a parent's OK enroll and join a Cloudflare RealtimeKit room on learnfrc.com.
-- Every class is recorded and transcribed; code and Claude (through Vercel's
-- AI Gateway) write review notes; Jahaan approves the class, which freezes the
-- teacher's minutes; Dhiren Pardhanani (the adult safety lead and volunteer
-- coordinator) signs hours letters and handles anything urgent. The design is
-- .claude-scratch/release-plan/classes-design.md, sections 3 and 6.
--
-- WHO READS IT. Only trusted server code. Every read and write goes through
-- src/lib/app/* or src/lib/classes/* with the service role, scoped by the id
-- auth.getUser() verified, and every rule lives there once for the website and
-- the app. So every table below has RLS on with no policies and `revoke all`
-- from anon and authenticated, like site_admins, marketers and user_reports.
--
-- The one exception is class_chat_messages: class members read the shown
-- messages directly (Supabase Realtime plus a polling fallback, so chat costs
-- no Vercel function calls). It has one select policy for authenticated,
-- through is_class_member(), which only ever answers about the caller. Writes
-- still go through the server, which runs the chat filter first.
--
-- APPLIED TO PRODUCTION BEFORE LAUNCH. This file goes into production early
-- (Nov 2026), before any code that uses it is deployed. That is safe because
-- it is additive: new tables, new functions, a members-only read policy that
-- matches nothing for anyone not in a class, one table added to the realtime
-- publication, and the two user_reports checks widened to supersets that every
-- existing row passes. The live site's code never names any of it. Classes
-- stay hidden until both switches (the CLASSES_VISIBLE env var and
-- class_settings.classes_visible) are on, on release day.
--
-- RE-RUNNABLE. Every statement is guarded (if not exists, or replace, drop ...
-- if exists, on conflict do nothing, the guarded publication step), so an
-- interrupted apply can simply be sent again.
--
-- DELETION RULE. Anything that is proof (consents, attendance, holds, reports)
-- uses `on delete set null` plus a snapshot of the handle, so it outlives the
-- account. Everything else cascades.

-- ── 3.1 Teachers and applications ──────────────────────────────────

-- One row per application to teach. Rejected and withdrawn rows are deleted by
-- the daily sweep after 180 days. A table of its own (not a role column on
-- admin_applications), because that table's one-pending index, its shape and
-- the installed app's /api/app/apply all assume one role.
create table if not exists public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot, like admin_applications. Never shown next to a class.
  team_number integer,
  team_role text,
  -- "Name as your school knows it". Copied to class_teachers.letter_name on
  -- accept and locked there.
  legal_name text not null check (char_length(legal_name) between 2 and 80),
  topics text not null,
  -- Lesson or module ids, at most 5 (checked in code).
  topic_ids uuid[] not null default '{}',
  experience text not null,
  -- "How you'd teach one lesson in 30 to 60 minutes".
  sample_plan text not null,
  availability text,
  -- Optional adult on their team.
  reference_name text,
  reference_email text,
  -- The teacher code of conduct they agreed to (src/lib/classes/notice.ts).
  code_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000)
);

create unique index if not exists teacher_applications_one_pending_per_user
  on public.teacher_applications (user_id) where status = 'pending';
create index if not exists teacher_applications_status_created_idx
  on public.teacher_applications (status, created_at desc);

alter table public.teacher_applications enable row level security;
revoke all on table public.teacher_applications from anon, authenticated;

-- Accepted teachers.
create table if not exists public.class_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  application_id uuid references public.teacher_applications(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  -- Copied from teacher_applications.legal_name on accept and locked. Only a
  -- super admin can change it (with a note); the teacher can't.
  letter_name text not null check (char_length(letter_name) between 2 and 80),
  letter_name_changed_by uuid references auth.users(id) on delete set null,
  letter_name_changed_at timestamptz,
  letter_name_change_note text,
  -- Owner and staff accounts: Dhiren can't sign letters for them (section 9.1).
  letters_blocked boolean not null default false,
  code_version text,
  code_agreed_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  note text
);

alter table public.class_teachers enable row level security;
revoke all on table public.class_teachers from anon, authenticated;

-- ── 3.2 Age and parent OK ──────────────────────────────────────────

-- One row per account, written once, only for 13+. An under-13 answer deletes
-- the account instead (section 5), so no child's birth date is ever stored.
create table if not exists public.class_age_checks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_year smallint not null check (birth_year between 1900 and 2100),
  birth_month smallint not null check (birth_month between 1 and 12),
  checked_at timestamptz not null default now()
);

alter table public.class_age_checks enable row level security;
revoke all on table public.class_age_checks from anon, authenticated;

-- The one-time parent or guardian OK by email (section 5.1). Proof: it
-- outlives the account (set null plus snapshots).
create table if not exists public.class_parent_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete set null,
  -- Snapshot: the proof outlives the account.
  student_handle text not null,
  -- Snapshot: decides how long the proof is kept (3.10).
  student_birth_year smallint not null,
  -- Lowercased.
  parent_email text not null,
  -- Typed by the parent when deciding.
  parent_name text,
  -- sha256 of the emailed token. The token itself is never stored.
  token_hash text not null unique,
  notice_version text not null,
  status text not null default 'sent'
    check (status in ('sent', 'agreed', 'declined', 'expired', 'revoked')),
  sent_at timestamptz not null default now(),
  -- sent_at + 14 days.
  expires_at timestamptz not null,
  -- HMAC(ip, CLASSES_AUDIT_SALT) of the student's request.
  requested_ip_hash text,
  decided_at timestamptz,
  decided_ip_hash text,
  decided_user_agent text,
  -- Decided from the request's IP hash: flagged for review, never blocked.
  same_network boolean not null default false,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  -- Set by beforeAccountDeleted.
  account_deleted_at timestamptz
);

create index if not exists class_parent_consents_student_idx
  on public.class_parent_consents (student_id, sent_at desc);

alter table public.class_parent_consents enable row level security;
revoke all on table public.class_parent_consents from anon, authenticated;

-- ── 3.3 Classes, enrollment and the RealtimeKit mapping ────────────

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 4 and 80),
  description text check (description is null or char_length(description) <= 600),
  lesson_id uuid references public.lessons(id) on delete set null,
  module_id uuid references public.modules(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes smallint not null check (duration_minutes between 15 and 90),
  -- starts_at + duration + 15 min, written by code.
  hard_end_at timestamptz not null,
  capacity smallint not null default 15 check (capacity between 2 and 15),
  status text not null default 'scheduled' check (status in
    ('scheduled', 'live', 'ended', 'in_review', 'approved', 'rejected', 'canceled')),
  rtk_meeting_id text unique,
  -- Which RealtimeKit app made the meeting. Dev and prod share this database,
  -- so code only manages meetings of the app it's configured for (section 1).
  rtk_app text not null check (rtk_app in ('dev', 'prod')),
  live_started_at timestamptz,
  ended_at timestamptz,
  end_reason text check (end_reason is null or end_reason in
    ('teacher', 'admin', 'time', 'empty', 'teacher_gone', 'reports', 'paused', 'sweep')),
  canceled_at timestamptz,
  canceled_by uuid references auth.users(id) on delete set null,
  cancel_reason text,
  -- Frozen on approval.
  credited_minutes integer,
  credited_minutes_computed integer,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text,
  keep_evidence boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists classes_status_starts_idx on public.classes (status, starts_at);
create index if not exists classes_teacher_starts_idx on public.classes (teacher_id, starts_at desc);

alter table public.classes enable row level security;
revoke all on table public.classes from anon, authenticated;

create table if not exists public.class_enrollments (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled', 'canceled', 'removed')),
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_by uuid references auth.users(id) on delete set null,
  removed_reason text,
  primary key (class_id, user_id)
);

create index if not exists class_enrollments_user_idx on public.class_enrollments (user_id, status);

alter table public.class_enrollments enable row level security;
revoke all on table public.class_enrollments from anon, authenticated;

-- Everyone who has ever had a RealtimeKit participant in this class: the
-- roster the report panel, the chat read policy and the class page use, even
-- after someone leaves. Names aren't stored here: the room shows each person's
-- current profiles.username, read at join time.
-- rtk_participant_id is the CURRENT participant. joinClass deletes the old one
-- and adds a new one on every join (6.4), so at most one exists per person.
create table if not exists public.class_participants (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher', 'student', 'staff')),
  -- Null after a kick or removal until the next join.
  rtk_participant_id text,
  preset_name text not null,
  first_joined_at timestamptz not null default now(),
  last_token_at timestamptz,
  -- Removed from the class for good.
  revoked_at timestamptz,
  primary key (class_id, user_id)
);

alter table public.class_participants enable row level security;
revoke all on table public.class_participants from anon, authenticated;

-- Seat-safe enrollment. Locks the class row so two people can't take the last
-- seat. The other enrollment rules (blocks, the teacher's own class, the bio
-- check, eligibility) run in enrollInClass (src/lib/app/classes.ts) first.
-- Returns: ok, already, removed, full, closed, not_found.
create or replace function public.class_enroll(p_class_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  taken integer;
  existing_status text;
begin
  select id, status, capacity, starts_at into c
    from public.classes where id = p_class_id for update;
  if not found then return 'not_found'; end if;
  if c.status <> 'scheduled' and c.status <> 'live' then return 'closed'; end if;
  if now() > c.starts_at + interval '10 minutes' then return 'closed'; end if;
  select status into existing_status from public.class_enrollments
    where class_id = p_class_id and user_id = p_user_id;
  if existing_status = 'enrolled' then return 'already'; end if;
  if existing_status = 'removed' then return 'removed'; end if;
  select count(*) into taken from public.class_enrollments
    where class_id = p_class_id and status = 'enrolled';
  if taken >= c.capacity then return 'full'; end if;
  insert into public.class_enrollments (class_id, user_id, status)
    values (p_class_id, p_user_id, 'enrolled')
    on conflict (class_id, user_id) do update set status = 'enrolled', updated_at = now();
  return 'ok';
end;
$$;

revoke all on function public.class_enroll(uuid, uuid) from public, anon, authenticated;
grant execute on function public.class_enroll(uuid, uuid) to service_role;

-- ── 3.4 Sessions, attendance, media and minutes ────────────────────

-- One live run of a meeting. Every webhook handler upserts this row first, so
-- the order webhooks arrive in never matters.
create table if not exists public.class_sessions (
  -- RealtimeKit sessionId.
  id text primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  -- Composite video in RealtimeKit's bucket; the link expires in 7 days.
  recording_url text,
  recording_expires_at timestamptz,
  transcript_status text not null default 'waiting'
    check (transcript_status in ('waiting', 'stored', 'missing', 'failed')),
  transcript_fetched_at timestamptz
);

create index if not exists class_sessions_class_idx on public.class_sessions (class_id);

alter table public.class_sessions enable row level security;
revoke all on table public.class_sessions from anon, authenticated;

create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_id text not null references public.class_sessions(id) on delete cascade,
  -- Set null: the teacher's minutes keep their proof.
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('teacher', 'student', 'staff')),
  -- Snapshot at join, for the minutes rule (src/lib/classes/minutes.ts).
  account_age_days integer,
  peer_id text not null,
  joined_at timestamptz not null,
  left_at timestamptz,
  source text not null default 'webhook' check (source in ('webhook', 'reconcile')),
  unique (session_id, peer_id)
);

create index if not exists class_attendance_class_idx on public.class_attendance (class_id);
create index if not exists class_attendance_open_idx
  on public.class_attendance (class_id, user_id) where left_at is null;
create index if not exists class_attendance_month_idx on public.class_attendance (joined_at);

alter table public.class_attendance enable row level security;
revoke all on table public.class_attendance from anon, authenticated;

-- Who had a camera or screen share on, reported by every browser in the room
-- (6.5). The AI can't see video; these minutes go in its input and the email.
create table if not exists public.class_media_events (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  -- Whose media changed. No foreign key: survives deletion.
  subject_user_id uuid,
  kind text not null check (kind in ('camera', 'screenshare')),
  is_on boolean not null,
  at timestamptz not null,
  -- Whose browser saw it.
  reported_by uuid,
  received_at timestamptz not null default now()
);

create index if not exists class_media_events_class_idx on public.class_media_events (class_id, at);

alter table public.class_media_events enable row level security;
revoke all on table public.class_media_events from anon, authenticated;
revoke all on sequence public.class_media_events_id_seq from anon, authenticated;

-- ── 3.5 Consent records ────────────────────────────────────────────

-- A recording_notice row is written on every join, before a token exists. The
-- notice at the start of every join is the legal defense for recording; the
-- parent OK is extra.
create table if not exists public.class_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  -- Snapshot.
  user_handle text not null,
  -- Snapshot, for retention (3.10); null for staff.
  user_birth_year smallint,
  class_id uuid references public.classes(id) on delete set null,
  kind text not null check (kind in ('recording_notice', 'teacher_code')),
  version text not null,
  accepted_at timestamptz not null default now(),
  -- HMAC(ip, CLASSES_AUDIT_SALT); also used for the shared-network check.
  ip_hash text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  account_deleted_at timestamptz
);

create index if not exists class_consents_user_class_idx
  on public.class_consents (user_id, class_id, accepted_at desc);
create index if not exists class_consents_class_ip_idx on public.class_consents (class_id, ip_hash);

alter table public.class_consents enable row level security;
revoke all on table public.class_consents from anon, authenticated;

-- ── 3.6 Chat, transcripts, AI notes, events, webhooks, settings ────

-- LearnFRC's own class chat (section 6.5). RealtimeKit's chat is off for every
-- preset, so this is the only chat in a class. sendClassChat (service role)
-- writes every message after the filter: 'shown' rows reach the class,
-- 'blocked' rows are kept only for the review and holds. Class members read
-- 'shown' rows directly (Supabase Realtime plus a polling fallback), which is
-- the one place the browser reads a classes table, so it has the one policy.
create table if not exists public.class_chat_messages (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  -- The full username shown in the panel (snapshot).
  sender_username text not null,
  sender_role text not null check (sender_role in ('teacher', 'student', 'staff')),
  body text not null check (char_length(body) between 1 and 300),
  status text not null check (status in ('shown', 'blocked')),
  -- link, handle, email, phone, contact_app, contact_phrase, profanity.
  blocked_kinds text[] not null default '{}',
  sent_at timestamptz not null default now()
);

create index if not exists class_chat_messages_class_idx on public.class_chat_messages (class_id, id);

-- True when the caller has a class_participants row in that class that hasn't
-- been revoked. Security definer, because class_participants is locked to
-- authenticated; it only ever answers about the caller.
create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_participants
    where class_id = p_class_id
      and user_id = (select auth.uid())
      and revoked_at is null
  );
$$;

revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;

alter table public.class_chat_messages enable row level security;
revoke all on table public.class_chat_messages from anon, authenticated;
revoke all on sequence public.class_chat_messages_id_seq from anon, authenticated;
grant select on table public.class_chat_messages to authenticated;

drop policy if exists class_chat_members_read on public.class_chat_messages;
create policy class_chat_members_read on public.class_chat_messages
  for select to authenticated
  using (status = 'shown' and public.is_class_member(class_id));

-- Supabase Realtime delivers new rows to class members, checking the policy
-- above for each subscriber. Guarded so a re-run is harmless.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'class_chat_messages'
     ) then
    alter publication supabase_realtime add table public.class_chat_messages;
  end if;
end;
$$;

-- Copied from Cloudflare at once (Cloudflare keeps transcripts 7 days).
create table if not exists public.class_transcripts (
  session_id text primary key references public.class_sessions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  -- [{ t0, t1, userId, label, role, text }], label = @username.
  lines jsonb not null default '[]'::jsonb,
  word_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  -- Class date + 365 days unless keep_evidence.
  purge_after date not null
);

alter table public.class_transcripts enable row level security;
revoke all on table public.class_transcripts from anon, authenticated;

-- The AI notes and code flags for a class (section 7).
create table if not exists public.class_reviews (
  class_id uuid primary key references public.classes(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'refused', 'failed', 'no_transcript')),
  model text,
  prompt_version text,
  verdict text check (verdict is null or verdict in ('looks_fine', 'needs_review', 'urgent')),
  lesson_match text check (lesson_match is null or lesson_match in ('matches', 'partly', 'off_topic', 'unclear')),
  summary_md text,
  -- Model flags (7.4).
  flags jsonb not null default '[]'::jsonb,
  -- Code flags (7.2).
  code_flags jsonb not null default '[]'::jsonb,
  one_on_one_minutes integer not null default 0,
  camera_minutes integer not null default 0,
  screenshare_minutes integer not null default 0,
  -- Messages the chat filter stopped in this class.
  chat_blocked_count integer not null default 0,
  -- A refusal's category, when the provider gives one.
  refusal_category text,
  -- Sexual content, grooming, sextortion or a refusal: only the safety lead
  -- sees the transcript, quotes and recording until he releases it (8.1).
  restricted boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  attempts smallint not null default 0,
  error text,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_reviews enable row level security;
revoke all on table public.class_reviews from anon, authenticated;

-- Audit trail and the admin page's problem list: scheduled, canceled,
-- removed_participant, duplicate_peer, ended, auto_ended, reported, approved,
-- rejected, paused, unpaused, hold_created, letter_requested, letter_issued,
-- letter_revoked, email_failed, unknown_meeting, under13_deleted (no user data).
create table if not exists public.class_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists class_events_class_idx on public.class_events (class_id, created_at);
create index if not exists class_events_kind_idx on public.class_events (kind, created_at desc);

alter table public.class_events enable row level security;
revoke all on table public.class_events from anon, authenticated;

-- Webhook dedupe. rtk-uuid is an unsigned header, so the signed body's hash is
-- the real dedupe key (6.8). Kept 90 days.
create table if not exists public.class_webhook_events (
  -- rtk-uuid header.
  id text primary key,
  body_sha256 text not null unique,
  -- rtk-webhook-id header.
  webhook_id text,
  event text not null,
  meeting_id text,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.class_webhook_events enable row level security;
revoke all on table public.class_webhook_events from anon, authenticated;

-- RealtimeKit participants we still need to delete (account deletion retries).
create table if not exists public.class_rtk_cleanup (
  rtk_app text not null check (rtk_app in ('dev', 'prod')),
  meeting_id text not null,
  participant_id text not null,
  attempts smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  primary key (meeting_id, participant_id)
);

alter table public.class_rtk_cleanup enable row level security;
revoke all on table public.class_rtk_cleanup from anon, authenticated;

-- One row. Both switches stay off in production until release day (section 1).
create table if not exists public.class_settings (
  id boolean primary key default true check (id),
  -- With the CLASSES_VISIBLE env var (section 1).
  classes_visible boolean not null default false,
  joins_paused boolean not null default true,
  paused_reason text default 'not launched yet',
  -- Dhiren's account.
  safety_lead_user_id uuid references auth.users(id) on delete set null,
  monthly_minute_cap integer not null default 40000,
  max_live_classes smallint not null default 3,
  min_student_account_days smallint not null default 7,
  -- { "dev": "<id>", "prod": "<id>" }, written by the setup script.
  rtk_webhook_ids jsonb not null default '{}'::jsonb,
  -- Recorded by the setup script.
  rtk_organization_id text,
  last_daily_sweep_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.class_settings enable row level security;
revoke all on table public.class_settings from anon, authenticated;

insert into public.class_settings (id) values (true) on conflict do nothing;

-- ── 3.7 Hours letters ──────────────────────────────────────────────

create table if not exists public.hours_letters (
  id uuid primary key default gen_random_uuid(),
  -- LF-XXXXX-XXXXX, assigned only when issued.
  code text unique,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  -- class_teachers.letter_name at request time.
  letter_name text not null,
  period_start date not null,
  period_end date not null,
  total_minutes integer not null check (total_minutes > 0),
  class_count integer not null check (class_count > 0),
  -- [{ classId, date, title, topic, minutes }].
  classes jsonb not null,
  coordinator_name text not null,
  coordinator_email text not null,
  status text not null default 'requested'
    check (status in ('requested', 'issued', 'declined', 'revoked')),
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  decline_reason text,
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists hours_letters_teacher_idx on public.hours_letters (teacher_id, requested_at desc);
create index if not exists hours_letters_status_idx on public.hours_letters (status, requested_at);

alter table public.hours_letters enable row level security;
revoke all on table public.hours_letters from anon, authenticated;

-- ── 3.8 Evidence holds ─────────────────────────────────────────────

-- Snapshots kept when something may need to go to NCMEC, the police, a parent
-- or a ban review. Service role only; the safety lead and super admins read it
-- through /admin/classes/holds. No foreign keys to auth.users on purpose: a
-- ban or a self-delete must not delete the evidence.
create table if not exists public.class_safety_holds (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete set null,
  subject_user_id uuid,
  subject_handle text,
  -- From auth.users, read before deletion.
  subject_email text,
  reason text not null check (reason in
    ('urgent_flag', 'refusal', 'class_report', 'auto_end', 'ban', 'self_delete_open_case', 'reject_safety', 'manual')),
  -- Copy of class_transcripts.lines for the class.
  transcript jsonb,
  -- Copy of class_chat_messages for the class, blocked rows included.
  chat jsonb,
  -- GET /sessions/peer-report/{peer_id}: IP, city, device.
  peer_reports jsonb,
  -- R2 object key in the holds bucket.
  recording_key text,
  recording_status text not null default 'none'
    check (recording_status in ('none', 'copying', 'stored', 'failed', 'gone')),
  created_by uuid,
  created_at timestamptz not null default now(),
  -- 18 U.S.C. 2258A preservation period.
  expires_at timestamptz not null default now() + interval '1 year',
  ncmec_report_id text,
  notes text,
  released_at timestamptz,
  released_by uuid
);

create index if not exists class_safety_holds_class_idx on public.class_safety_holds (class_id);
create index if not exists class_safety_holds_subject_idx on public.class_safety_holds (subject_user_id);

alter table public.class_safety_holds enable row level security;
revoke all on table public.class_safety_holds from anon, authenticated;

-- ── 3.9 Report and block: class reports ────────────────────────────

-- Both checks are supersets of the ones 20261108121500_reports_and_blocks.sql
-- declared inline, so every existing row passes. Class reports add the kind
-- 'class' and three class-only reasons (src/lib/app/reports.ts).
alter table public.user_reports drop constraint if exists user_reports_content_kind_check;
alter table public.user_reports add constraint user_reports_content_kind_check
  check (content_kind in ('profile', 'edit', 'submission', 'class'));

alter table public.user_reports drop constraint if exists user_reports_reason_check;
alter table public.user_reports add constraint user_reports_reason_check
  check (reason in ('harassment', 'offensive', 'personal_info', 'impersonation', 'spam', 'other',
                    'private_contact', 'sexual', 'unsafe'));
