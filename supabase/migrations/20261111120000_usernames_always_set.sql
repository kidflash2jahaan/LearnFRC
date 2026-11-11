-- Every account has a username (owner, 2026-11-11).
--
-- 30 of 902 accounts had username = null on Nov 11. All 30 signed up with
-- Google, which never shows the sign-up form, so handle_new_user inserted the
-- profile with no handle, and the site and app printed "Learner" for them.
--
-- From here the database guarantees the username:
--   - A BEFORE trigger on profiles fills in a neutral generated handle
--     (gearbox_4821) whenever a row would be created or left without one.
--   - A one-time backfill gives the null accounts one.
--   - username becomes NOT NULL with a format CHECK.
--   - profiles.username_generated marks a handle the person never chose. The
--     site (/account/username) and the app (needsUsernameSetup on /me) ask them
--     once to keep it or pick their own, and both clear the flag.
--
-- Re-runnable and additive. Apply before the code that selects
-- username_generated deploys. Safe with the code before it: that code only
-- reads username, which can no longer be null.
--
-- Mirrored in src/lib/usernames.ts (the reserved list and the generator words).
-- src/lib/usernames.test.ts parses this file and checks both lists match.

-- 1. The flag. The placeholder backfill runs once, only when the column is new,
--    so a re-run can't re-flag someone who already pressed Keep.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'username_generated') then
    alter table public.profiles add column username_generated boolean not null default false;
    -- The 2026-08 placeholders: the exact vocabulary isPlaceholderUsername used (44 rows today).
    update public.profiles set username_generated = true
     where username ~ '^(atomic|blazing|cosmic|crimson|delta|iron|lucky|neon|quantum|silent|solid|swift|turbo)_(builder|driver|fabricator|gearhead|machinist|navigator|operator|roboteer|rookie|scout|strategist)_[0-9]{2}$';
  end if;
end $$;

-- 2. Reserved names. Mirrored in src/lib/usernames.ts; a test checks both lists match.
create or replace function public.username_is_reserved(u text)
returns boolean language sql immutable set search_path = '' as $$
  select u like 'learner%' or u like 'learnfrc%' or u = any (array[
    'lessonhook','articlehook',
    'admin','administrator','mod','moderator','staff','support','help','official','system',
    'safety','security','owner','root',
    'member','someone','nobody','unknown','anonymous','deleted','null','undefined',
    'teacher','student','parent','guardian']);
$$;

-- 3. The generator. Words mirrored in src/lib/usernames.ts (test checks it).
--    26 words x 9000 numbers = 234,000 handles, all checked against the
--    profanity filter.
create or replace function public.generate_username()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  words constant text[] := array['gearbox','bumper','encoder','chassis','gyro','servo',
    'sprocket','pulley','axle','winch','rivet','gusset','bracket','flywheel','intake',
    'roller','ratchet','spline','caster','hinge','collar','spacer','turret','hopper',
    'climber','solder'];
  candidate text;
begin
  for i in 1..50 loop
    candidate := words[1 + floor(random() * array_length(words, 1))::int]
                 || '_' || (1000 + floor(random() * 9000))::int;
    if not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'generate_username: no free handle after 50 tries';
end $$;

-- 4. The guard.
create or replace function public.profiles_username_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text := nullif(btrim(new.username), '');
begin
  if tg_op = 'INSERT' then
    -- Metadata from sign-up is trusted only in a valid, free, unreserved shape.
    if wanted is null or wanted !~ '^[a-z0-9_]{3,32}$'
       or public.username_is_reserved(wanted)
       or exists (select 1 from public.profiles where username = wanted) then
      new.username := public.generate_username();
      new.username_generated := true;
    else
      new.username := wanted;
    end if;
    return new;
  end if;
  -- UPDATE OF username
  if wanted is null then
    if old.username is not null then
      new.username := old.username;                 -- a username can't be cleared
      new.username_generated := old.username_generated;
    else
      new.username := public.generate_username();   -- only a null row can reach this
      new.username_generated := true;
    end if;
  elsif new.username is distinct from old.username
        and new.username_generated is not distinct from old.username_generated then
    new.username_generated := false;                -- a new name nobody flagged is the person's own
  end if;
  return new;
end $$;

drop trigger if exists profiles_username_guard on public.profiles;
create trigger profiles_username_guard
  before insert or update of username on public.profiles
  for each row execute function public.profiles_username_guard();

revoke execute on function public.username_is_reserved(text), public.generate_username(),
  public.profiles_username_guard() from public, anon, authenticated;
grant execute on function public.generate_username() to service_role;

-- 5. Backfill the null accounts (30 today), one statement per row so each check sees the last.
do $$ declare r record; begin
  for r in select id from public.profiles where username is null loop
    update public.profiles set username = public.generate_username(), username_generated = true
     where id = r.id;
  end loop;
  if exists (select 1 from public.profiles where username is null) then
    raise exception 'username backfill incomplete';
  end if;
end $$;

-- 6. The hard guarantee. BEFORE triggers run before NOT NULL and CHECK, so no writer trips them.
--    The CHECK allows 32 because a few existing usernames are over 20. New
--    choices are capped at 20 in code (USERNAME_MAX).
alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,32}$') not valid;
alter table public.profiles validate constraint profiles_username_format;
