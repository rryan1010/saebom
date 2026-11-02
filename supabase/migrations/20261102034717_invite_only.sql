-- Handoff §11 and D8: real accounts are invite-only. Sign-ups stay on so the demo's anonymous
-- sign-ins work, and this Before User Created hook turns away any other new user whose email
-- isn't in public.invites. config.toml points local Auth at it; the owner turns it on for the
-- hosted project.
--
-- Auth sends its draft of the new user (Supabase's Before User Created hook docs, and the events
-- captured on the local stack with Auth v2.197.0): is_anonymous is a JSON boolean, the email is
-- already lowercase, and an anonymous sign-in has an empty email and phone. '{}' lets the sign-up
-- through; an error object rejects it with that status and message.
create function public.hook_invite_only(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  -- Demo mode: an anonymous sign-in, which never carries an email or phone.
  if event->'user'->'is_anonymous' = 'true'::jsonb
    and coalesce(event->'user'->>'email', '') = ''
    and coalesce(event->'user'->>'phone', '') = '' then
    return '{}'::jsonb;
  end if;
  -- Invited by the owner's script.
  if exists (
    select 1 from public.invites i
    where i.email = lower(event->'user'->>'email')
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'This app is invite-only.'));
end;
$$;

-- Auth runs the hook as supabase_auth_admin, which doesn't bypass RLS, so it gets read access to
-- invites and nothing else. Supabase's default privileges would also hand service_role execute.
revoke execute on function public.hook_invite_only(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_invite_only(jsonb) to supabase_auth_admin;
grant select on public.invites to supabase_auth_admin;
create policy "auth admin reads invites" on public.invites
  for select to supabase_auth_admin using (true);
