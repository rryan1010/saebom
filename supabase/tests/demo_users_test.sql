begin;
select plan(16);

insert into auth.users (id, email, phone, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000d1', null, null, true),
  ('00000000-0000-0000-0000-0000000000d2', null, null, true),
  ('00000000-0000-0000-0000-0000000000e1', 'friend@example.com', null, false);

select has_trigger('auth', 'users', 'keep_demo_users_anonymous',
  'auth.users has the demo-user trigger');
select trigger_is('auth', 'users', 'keep_demo_users_anonymous',
  'public', 'keep_demo_users_anonymous', 'the trigger calls public.keep_demo_users_anonymous()');

-- What Auth does to a demo user on every sign-in and refresh still works.
select lives_ok(
  $$update auth.users
    set last_sign_in_at = now(), updated_at = now(),
      raw_user_meta_data = '{"demo":true}', raw_app_meta_data = '{}'
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  'a demo user''s sign-in, refresh and metadata updates go through');
select lives_ok(
  $$update auth.users set email = '', phone = ''
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  'an empty email or phone isn''t a change');

-- Becoming an account doesn't.
select throws_ok(
  $$update auth.users set email = 'stranger@example.com', email_confirmed_at = now()
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', 'Demo sessions can''t become accounts. This app is invite-only.',
  'a demo user can''t add an email');
select throws_ok(
  $$update auth.users set email = 'friend@example.com'
    where id = '00000000-0000-0000-0000-0000000000d2'$$,
  '42501', null, 'a demo user can''t take an invited email either');
select throws_ok(
  $$update auth.users set phone = '15555550123'
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a demo user can''t add a phone');
select throws_ok(
  $$update auth.users set is_anonymous = false
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a demo user can''t stop being anonymous');
select throws_ok(
  $$update auth.users set email_change = 'stranger@example.com', email_change_sent_at = now()
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a demo user can''t start an email change');
select throws_ok(
  $$update auth.users set phone_change = '15555550123'
    where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null, 'a demo user can''t start a phone change');

select is(
  (select array[is_anonymous::text, coalesce(nullif(email, ''), '-'), coalesce(nullif(phone, ''), '-')]
   from auth.users where id = '00000000-0000-0000-0000-0000000000d1'),
  array['true', '-', '-'],
  'after every refused change the demo user is still anonymous, with no email or phone');

-- Real accounts and the nightly cleanup aren't affected.
select lives_ok(
  $$update auth.users set email = 'friend.new@example.com'
    where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'a real account''s email can still change');
select lives_ok(
  $$delete from auth.users where id = '00000000-0000-0000-0000-0000000000d2'$$,
  'the nightly cleanup can delete a demo user');

select ok(
  not has_function_privilege('anon', 'public.keep_demo_users_anonymous()', 'execute')
  and not has_function_privilege('authenticated', 'public.keep_demo_users_anonymous()', 'execute')
  and not has_function_privilege('service_role', 'public.keep_demo_users_anonymous()', 'execute'),
  'anon, authenticated and service_role can''t call the trigger function');
select ok(
  (select p.proacl is not null
     and not exists (
       select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
   from pg_proc p where p.oid = 'public.keep_demo_users_anonymous()'::regprocedure),
  'PUBLIC can''t call the trigger function');
select ok(
  (select 'search_path=""' = any (p.proconfig)
   from pg_proc p where p.oid = 'public.keep_demo_users_anonymous()'::regprocedure),
  'the trigger function runs with an empty search_path');

select * from finish();
rollback;
