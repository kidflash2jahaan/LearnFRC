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
--   - The API roles lose direct UPDATE on the profile columns people edit, and
--     INSERT on profiles, so every change goes through the site's and app's
--     rules.
--
-- Re-runnable and additive. Apply before the code that selects
-- username_generated deploys. Safe with the code before it: that code only
-- reads username, which can no longer be null, and writes profiles only with
-- the service role.
--
-- After applying, expect username_generated on 74 rows (the 30 nulls and the
-- 44 old placeholders, counted Nov 11) plus any Google sign-ups since then.
--
-- Mirrored in src/lib/usernames.ts (the reserved names, the staff words, the
-- generator words and its denied numbers). src/lib/usernames.test.ts parses
-- this file and checks every list matches.

-- 0. Wait at most 3 seconds for a lock. Step 4 takes an exclusive lock on
--    profiles and holds it to the end, so waiting behind a stuck writer would
--    queue every profile read and sign-up behind this migration. A timeout
--    rolls the whole migration back; run it again.
set local lock_timeout = '3s';

-- 1. Reserved names. Mirrored in src/lib/usernames.ts; a test checks the lists match.
--    Exact names, anything starting learner or learnfrc, and a staff word at the
--    start or end of a name (admin_team, mod1, lf_admin), so nobody can pass as
--    the site's staff.
create or replace function public.username_is_reserved(u text)
returns boolean language sql immutable set search_path = '' as $$
  select u like 'learner%' or u like 'learnfrc%' or u = any (array[
    'lessonhook','articlehook',
    'admin','administrator','mod','moderator','staff','support','help','official','system',
    'safety','security','owner','root',
    'member','someone','nobody','unknown','anonymous','deleted','null','undefined',
    'teacher','student','parent','guardian'])
    or exists (select 1 from unnest(array[
      'admin','administrator','mod','moderator','staff','official','support']) w
      where u ~ ('^' || w || '([_0-9]|$)') or u ~ ('_' || w || '$'));
$$;

-- 2. Numbers a generated handle never ends in: any containing a sexual or hate
--    number code (88 covers 1488 and 8814). Mirrored in src/lib/usernames.ts.
create or replace function public.username_number_denied(n text)
returns boolean language sql immutable set search_path = '' as $$
  select exists (select 1 from unnest(array['69','88','420','666','1312','8008']) d
                 where position(d in coalesce(n, '')) > 0);
$$;

-- 3. The generator. Words mirrored in src/lib/usernames.ts (a test checks it).
--    24 words x 8,424 allowed numbers = 202,176 handles, all checked against
--    the shape rules and the profanity filter.
--    Each candidate is claimed with a transaction advisory lock before the
--    taken check, so two sign-ups at the same moment can't both be handed the
--    same name (the second would fail on profiles_username_key and with it the
--    whole sign-up). A name someone else is claiming right now counts as taken.
create or replace function public.generate_username()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  words constant text[] := array['gearbox','bumper','encoder','chassis','gyro','servo',
    'sprocket','pulley','axle','winch','rivet','gusset','bracket','flywheel','intake',
    'roller','spline','caster','collar','spacer','turret','hopper','climber','solder'];
  n int;
  candidate text;
begin
  for i in 1..100 loop
    n := 1000 + floor(random() * 9000)::int;
    continue when public.username_number_denied(n::text);
    candidate := words[1 + floor(random() * array_length(words, 1))::int] || '_' || n;
    continue when not pg_try_advisory_xact_lock(hashtext('profiles.username:' || candidate));
    if not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'generate_username: no free handle after 100 tries';
end $$;

-- 4. The flag. Runs once, only when the column is new, so a re-run can't
--    re-flag someone who already pressed Keep.
--    The 2026-08 placeholders are flagged: the exact vocabulary
--    isPlaceholderUsername used (44 rows on Nov 11). Two kinds of them get a
--    fresh generated handle now, still flagged, because nobody chose them:
--      - over 20 characters (2 rows): the app's username box stops at 20, so
--        an installed copy would shorten the name and rename them instead of
--        keeping it;
--      - ending in a denied number (1 row).
--    One statement per row, so each taken check sees the last. No guard
--    trigger exists yet, so the flag stays as written.
do $$ declare r record; begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'username_generated') then
    alter table public.profiles add column username_generated boolean not null default false;
    update public.profiles set username_generated = true
     where username ~ '^(atomic|blazing|cosmic|crimson|delta|iron|lucky|neon|quantum|silent|solid|swift|turbo)_(builder|driver|fabricator|gearhead|machinist|navigator|operator|roboteer|rookie|scout|strategist)_[0-9]{2}$';
    for r in select id from public.profiles
              where username_generated
                and (length(username) > 20
                     or public.username_number_denied(substring(username from '[0-9]+$'))) loop
      update public.profiles set username = public.generate_username() where id = r.id;
    end loop;
  end if;
end $$;

-- 5. The guard.
--    INSERT: a sign-up's username (from its metadata) is used only in a valid,
--    unreserved shape that nobody has or is claiming right now; otherwise the
--    account gets a generated handle, flagged.
--    UPDATE OF username: a username can't be cleared. A rename claims the new
--    name first (so a sign-up claiming the same one at the same moment gets a
--    generated handle rather than failing), and clears the flag unless the
--    writer changed the flag too. A writer that sets the flag to true on a row
--    that's already flagged looks the same as one that didn't mention it, so a
--    machine rename of a flagged row writes the username, then the flag, in two
--    statements (src/app/api/name-scan/route.ts does).
create or replace function public.profiles_username_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text := nullif(btrim(new.username), '');
begin
  if tg_op = 'INSERT' then
    if wanted is not null and wanted ~ '^[a-z0-9_]{3,32}$'
       and not public.username_is_reserved(wanted)
       and pg_try_advisory_xact_lock(hashtext('profiles.username:' || wanted))
       and not exists (select 1 from public.profiles where username = wanted) then
      new.username := wanted;
    else
      new.username := public.generate_username();
      new.username_generated := true;
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
  elsif new.username is distinct from old.username then
    perform pg_advisory_xact_lock(hashtext('profiles.username:' || new.username));
    if new.username_generated is not distinct from old.username_generated then
      new.username_generated := false;              -- a new name nobody flagged is the person's own
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_username_guard on public.profiles;
create trigger profiles_username_guard
  before insert or update of username on public.profiles
  for each row execute function public.profiles_username_guard();

revoke execute on function public.username_is_reserved(text), public.username_number_denied(text),
  public.generate_username(), public.profiles_username_guard() from public, anon, authenticated;
grant execute on function public.generate_username() to service_role;

-- 6. Backfill the null accounts (30 on Nov 11), one statement per row so each check sees the last.
do $$ declare r record; begin
  for r in select id from public.profiles where username is null loop
    update public.profiles set username = public.generate_username(), username_generated = true
     where id = r.id;
  end loop;
  if exists (select 1 from public.profiles where username is null) then
    raise exception 'username backfill incomplete';
  end if;
end $$;

-- 7. The hard guarantee. BEFORE triggers run before NOT NULL and CHECK, so no writer trips them.
--    The CHECK allows 32 because a few existing usernames are over 20. New
--    choices are capped at 20 in code (USERNAME_MAX).
alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,32}$') not valid;
alter table public.profiles validate constraint profiles_username_format;

-- 8. People change their profile only through the site and the app, whose
--    service-role writes apply the rules (src/lib/app/profile.ts: reserved
--    names, the 20-character cap, the profanity filter, the team-number limit).
--    Nothing in the site or the app writes profiles as a signed-in user, so the
--    API roles keep no direct UPDATE on these columns, and a signed-in browser
--    can't PATCH /rest/v1/profiles around those rules. Nor can it POST a row
--    with its own xp or role: only handle_new_user creates profiles, and it's
--    security definer, so the API roles don't need INSERT (or TRUNCATE,
--    REFERENCES, TRIGGER) on profiles either.
revoke update (username, full_name, avatar_url, team_number, bio, role, hide_name)
  on public.profiles from anon, authenticated;
revoke insert, truncate, references, trigger on public.profiles from anon, authenticated;
