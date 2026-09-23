-- Site roles, and the application process for joining the admin team.
--
-- `profiles.role` is the reader's TEAM role (student, mentor, coach, alum) and
-- is returned to the browser by /api/me, so site authority lives in its own
-- table where a profile select can never leak it. Both tables are locked to
-- the service role: every read and write goes through trusted server code that
-- re-checks the caller's role itself.

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'superadmin')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  note text
);

alter table public.site_admins enable row level security;
revoke all on table public.site_admins from anon, authenticated;

create table if not exists public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot of the applicant's team and team role at the time of applying,
  -- so a later profile edit does not rewrite what the reviewer saw.
  team_number integer,
  team_role text,
  experience text not null,
  why text not null,
  availability text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text
);

-- One open application per person. Re-applying after a decision is allowed.
create unique index if not exists admin_applications_one_pending_per_user
  on public.admin_applications (user_id)
  where status = 'pending';

create index if not exists admin_applications_status_created_idx
  on public.admin_applications (status, created_at desc);

alter table public.admin_applications enable row level security;
revoke all on table public.admin_applications from anon, authenticated;
