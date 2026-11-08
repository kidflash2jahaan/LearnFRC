-- Report and block, for App Review guideline 1.2 (user-generated content).
--
-- What people make that other people see: a username, an avatar, a bio and a
-- team number (on /u/<username>, the leaderboards and the team sheet), and the
-- notes and titles on suggested edits and lesson proposals (/contributions).
-- Anyone signed in can report any of it, and can block an account so its
-- profile, its board rows, its team-sheet row and its contributions are hidden
-- from them. Reports go to the admin desk at /admin/reports.
--
-- Every rule lives in src/lib/app/reports.ts, blocks.ts and admin-reports.ts,
-- shared by the website's Server Actions and the app's /api/app/* routes, and
-- every read and write there is service role, scoped by the id the auth server
-- verified. So both tables are locked to anon, and `user_reports` to
-- authenticated as well: a reporter never reads reports back, and the person
-- reported must never be able to find out who filed one.
--
-- Additive only: two new tables, and the two check constraints on
-- moderation_log widened so a report decision can be logged beside the edit and
-- submission decisions (every existing row still passes).

-- ── Reports ─────────────────────────────────────────────────────────

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) when either account is deleted, so the desk keeps its
  -- record of what was reported and what was done about it.
  reporter_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  -- The handle at report time. A ban deletes the account, and the desk still
  -- has to say who the report was about.
  reported_username text,
  -- What was reported: the person's profile (username, avatar, bio, team), or
  -- one suggested edit or lesson proposal of theirs.
  content_kind text not null check (content_kind in ('profile', 'edit', 'submission')),
  content_id uuid,
  -- The public fields as they stood when the report was filed, so the reviewer
  -- sees what the reporter saw even if it has been edited since. Only fields
  -- that were already public: never a real name, an email or an IP.
  content_snapshot jsonb not null default '{}'::jsonb,
  -- Where the reporter was: profile, leaderboard, team, contributions.
  surface text,
  -- web, ios, ipados, macos.
  platform text,
  reason text not null check (
    reason in ('harassment', 'offensive', 'personal_info', 'impersonation', 'spam', 'other')
  ),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'removed', 'banned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000)
);

-- One open report per reporter per piece of content. A second tap, or the
-- same person reporting again before anyone has looked, is the same report.
create unique index if not exists user_reports_one_open_per_target
  on public.user_reports (
    reporter_id,
    reported_user_id,
    content_kind,
    coalesce(content_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'open';

create index if not exists user_reports_status_created_idx
  on public.user_reports (status, created_at desc);

create index if not exists user_reports_reported_open_idx
  on public.user_reports (reported_user_id)
  where status = 'open';

alter table public.user_reports enable row level security;
revoke all on table public.user_reports from anon, authenticated;

-- ── Blocks ──────────────────────────────────────────────────────────

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

-- "Who has blocked this account" is never asked by the site, but the cascade
-- on delete walks it.
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon;
-- Writes go through the server (username lookup, the self check, the cap and
-- the rate limit). A signed-in client may read its own list and nothing else.
revoke insert, update, delete on table public.user_blocks from authenticated;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select to authenticated
  using ((select auth.uid()) = blocker_id);

-- ── The moderation log ─────────────────────────────────────────────

-- moderation_log already records every edit and submission decision. Report
-- decisions join it (kind 'report', ref_id = the report's id), so there is one
-- place to read what moderation has done.
alter table public.moderation_log drop constraint if exists moderation_log_kind_check;
alter table public.moderation_log
  add constraint moderation_log_kind_check
  check (kind in ('edit', 'submission', 'report'));

alter table public.moderation_log drop constraint if exists moderation_log_decision_check;
alter table public.moderation_log
  add constraint moderation_log_decision_check
  check (decision in ('approved', 'rejected', 'edited_and_approved', 'resolved', 'removed', 'banned'));
