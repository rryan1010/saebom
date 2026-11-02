-- Handoff §11 and §12: a demo user must never become a real account. The invite hook can't stop
-- that on its own. Checked on the local stack (Auth v2.197.0, email confirmations off, manual
-- linking off): an anonymous session's updateUser({ email }) applied the new email at once and
-- cleared is_anonymous, then a password and a password sign-in worked, all without creating a
-- user, so the Before User Created hook never ran. This trigger refuses any update that would
-- give a demo user an email or phone, or end its anonymity. Raising rolls back Auth's whole
-- update, so the user stays anonymous with no email identity, and the nightly cleanup still
-- removes it after 24 hours.
create function public.keep_demo_users_anonymous() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Demo sessions can''t become accounts. This app is invite-only.'
    using errcode = '42501';
end;
$$;

-- Auth stores a demo user's email and phone as null; nullif treats '' the same.
-- Routine updates (sign-ins, refreshes, metadata) don't match, so they go through.
create trigger keep_demo_users_anonymous
before update on auth.users
for each row
when (
  old.is_anonymous
  and (
    new.is_anonymous is not true
    or nullif(new.email, '') is distinct from nullif(old.email, '')
    or nullif(new.phone, '') is distinct from nullif(old.phone, '')
    or nullif(new.email_change, '') is distinct from nullif(old.email_change, '')
    or nullif(new.phone_change, '') is distinct from nullif(old.phone_change, '')
  )
)
execute function public.keep_demo_users_anonymous();

-- A trigger fires without the caller holding execute on its function, so nobody needs it.
revoke execute on function public.keep_demo_users_anonymous()
  from public, anon, authenticated, service_role;
