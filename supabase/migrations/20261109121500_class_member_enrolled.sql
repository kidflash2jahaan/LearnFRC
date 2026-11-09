-- is_class_member(), replaced: the class chat's read policy counts a student
-- only while they're still signed up for the class and still have a parent's
-- OK (section 6.5).
--
-- WHY. The first version (20261109120000_live_classes.sql) counted anyone
-- with an unrevoked class_participants row. A student who left the class
-- (leaveClass sets their enrollment to 'canceled'), or whose parent withdrew
-- their OK, kept reading the class chat through Supabase Realtime and the
-- panel's polling until the class ended. Teachers and staff are unchanged:
-- they have no enrollment, and they're counted by their participant row.
-- Removing someone (revoked_at) still ends their chat at once, as before.
--
-- APPLIED TO PRODUCTION BEFORE LAUNCH. Same signature, same security definer
-- and search_path, same grants: only the body changes. Nothing on the live
-- site calls it, and before launch no class exists, so it matches nothing for
-- anyone either way.
--
-- RE-RUNNABLE: create or replace, and the grants restated.

create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_participants p
    where p.class_id = p_class_id
      and p.user_id = (select auth.uid())
      and p.revoked_at is null
      and (
        p.role <> 'student'
        or (
          exists (
            select 1 from public.class_enrollments e
            where e.class_id = p.class_id
              and e.user_id = p.user_id
              and e.status = 'enrolled'
          )
          and exists (
            select 1 from public.class_parent_consents c
            where c.student_id = p.user_id
              and c.status = 'agreed'
          )
        )
      )
  );
$$;

revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;
