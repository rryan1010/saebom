begin;
select plan(22);

insert into public.invites (email) values ('friend@example.com'), ('gone@example.com');

-- The event Auth sends, as captured on the local stack (Auth v2.197.0).
create function pg_temp.signup_event(p_email text, p_is_anonymous jsonb, p_phone text default '')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'metadata', jsonb_build_object(
      'uuid', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b', 'time', '2026-11-02T03:47:17Z',
      'name', 'before-user-created', 'ip_address', '127.0.0.1'),
    'user', jsonb_build_object(
      'id', '00000000-0000-0000-0000-0000000000c1', 'aud', 'authenticated', 'role', '',
      'email', p_email, 'phone', p_phone,
      'app_metadata', case when coalesce(p_email, '') = '' then '{}'::jsonb
        else '{"provider":"email","providers":["email"]}'::jsonb end,
      'user_metadata', '{}'::jsonb, 'identities', '[]'::jsonb,
      'created_at', '0001-01-01T00:00:00Z', 'updated_at', '0001-01-01T00:00:00Z',
      'is_anonymous', p_is_anonymous));
$$;

create function pg_temp.rejection() returns jsonb language sql as $$
  select '{"error":{"http_code":403,"message":"This app is invite-only."}}'::jsonb;
$$;

select has_function('public', 'hook_invite_only', array['jsonb'], 'the invite hook exists');
select function_returns('public', 'hook_invite_only', array['jsonb'], 'jsonb',
  'the invite hook returns jsonb');

-- Who gets through.
select is(public.hook_invite_only(pg_temp.signup_event('', 'true')), '{}'::jsonb,
  'an anonymous demo sign-in passes');
select is(public.hook_invite_only(pg_temp.signup_event(null, 'true', null)), '{}'::jsonb,
  'an anonymous sign-in with a null email and phone passes');
select is(public.hook_invite_only(pg_temp.signup_event('friend@example.com', 'false')), '{}'::jsonb,
  'an invited email passes');
select is(public.hook_invite_only(pg_temp.signup_event('Friend@Example.COM', 'false')), '{}'::jsonb,
  'an invited email passes in any letter case');

-- Who doesn't, with the exact rejection Auth expects.
select is(public.hook_invite_only(pg_temp.signup_event('stranger@example.com', 'false')),
  pg_temp.rejection(), 'an email that wasn''t invited gets a 403 with the invite-only message');
select is(public.hook_invite_only(pg_temp.signup_event('friend@example.com.attacker.test', 'false')),
  pg_temp.rejection(), 'only an exact match with an invite counts');
select is(public.hook_invite_only(pg_temp.signup_event('', 'false', '15555550123')),
  pg_temp.rejection(), 'a phone sign-up is rejected');
select is(public.hook_invite_only(pg_temp.signup_event('friend@example.com', 'false') #- '{user,email}'),
  pg_temp.rejection(), 'an event without an email is rejected');
select is(public.hook_invite_only(pg_temp.signup_event('stranger@example.com', 'true')),
  pg_temp.rejection(), 'the anonymous flag doesn''t let an uninvited email through');
select is(public.hook_invite_only(pg_temp.signup_event('', 'true', '15555550123')),
  pg_temp.rejection(), 'the anonymous flag doesn''t let a phone through');
select is(public.hook_invite_only(pg_temp.signup_event('', '"true"')),
  pg_temp.rejection(), 'only a JSON true counts as anonymous');
select is(public.hook_invite_only(pg_temp.signup_event('', 'true') #- '{user,is_anonymous}'),
  pg_temp.rejection(), 'an event without the anonymous flag and an email is rejected');
select is(public.hook_invite_only('{}'::jsonb), pg_temp.rejection(), 'an empty event is rejected');

delete from public.invites where email = 'gone@example.com';
select is(public.hook_invite_only(pg_temp.signup_event('gone@example.com', 'false')),
  pg_temp.rejection(), 'a removed invite no longer lets the email sign up');

-- Who can run it and what it can reach.
select ok(has_function_privilege('supabase_auth_admin', 'public.hook_invite_only(jsonb)', 'execute'),
  'Auth''s role can run the hook');
select ok(
  not has_function_privilege('anon', 'public.hook_invite_only(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.hook_invite_only(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.hook_invite_only(jsonb)', 'execute'),
  'anon, authenticated and service_role can''t run the hook');
select ok(
  (select p.proacl is not null
     and not exists (
       select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
   from pg_proc p where p.oid = 'public.hook_invite_only(jsonb)'::regprocedure),
  'PUBLIC can''t run the hook');
select ok(
  (select 'search_path=""' = any (p.proconfig)
   from pg_proc p where p.oid = 'public.hook_invite_only(jsonb)'::regprocedure),
  'the hook runs with an empty search_path');
select ok(
  has_table_privilege('supabase_auth_admin', 'public.invites', 'select')
  and not has_table_privilege('supabase_auth_admin', 'public.invites', 'insert, update, delete, truncate'),
  'Auth''s role can read invites but not change them');
select is(
  (select array_agg(p.permissive || ' ' || p.cmd || ' ' || array_to_string(p.roles, ',') || ' ' || p.qual)
   from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'invites' and p.policyname = 'auth admin reads invites'),
  array['PERMISSIVE SELECT supabase_auth_admin true']::text[],
  'RLS lets Auth''s role read every invite, and only read'
);

select * from finish();
rollback;
