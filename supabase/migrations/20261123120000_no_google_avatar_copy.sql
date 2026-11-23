-- Profile pictures are initials only (owner, 2026-11-23).
--
-- handle_new_user copied raw_user_meta_data->>'avatar_url' into
-- profiles.avatar_url, and for a Google sign-in that is the account's Google
-- photo. 375 of 965 profiles held one on Nov 23, and none of those people chose
-- to make it public. The site and the app no longer read or send the column
-- (src/lib/app/avatar.ts); this stops new sign-ups from getting one.
--
-- The function below is the live one, read from the database on Nov 23, with
-- the avatar_url column taken out of the insert and nothing else changed.
-- CREATE OR REPLACE keeps its owner, its grants and the on_auth_user_created
-- trigger that calls it.
--
-- Existing avatar_url values are left alone. Additive and re-runnable, and safe
-- in either order with the code: the code no longer reads the column, and this
-- only stops new rows from filling it.
--
-- src/lib/app/avatar.test.ts parses this file and checks the insert.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, username, team_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    nullif(new.raw_user_meta_data->>'username',''),
    case
      when new.raw_user_meta_data->>'team_number' ~ '^[0-9]{1,5}$'
      then (new.raw_user_meta_data->>'team_number')::int
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
