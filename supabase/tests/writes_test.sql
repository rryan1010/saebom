begin;
select plan(48);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

insert into public.profiles (id, days_per_week) values ('00000000-0000-0000-0000-00000000000a', 3);
insert into public.consents (user_id, kind, policy_version, granted) values
  ('00000000-0000-0000-0000-00000000000b', 'data', '1', true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2","is_anonymous":false}',
  true);

-- Training tables, the catalog and the audit log are written only by functions and the seed.
select throws_ok(format('insert into public.%I default values', t), '42501', null,
  format('app cannot insert into %s', t))
from unnest(array[
  'exercises', 'plans', 'plan_items', 'workout_sessions', 'set_logs', 'rep_records',
  'next_targets', 'lighter_weeks', 'coach_suggestions', 'audit_events'
]) as t;

select throws_ok(format('update public.%I set %I = %I', t, c, c), '42501', null,
  format('app cannot update %s', t))
from (values
  ('exercises', 'name'), ('plans', 'status'), ('plan_items', 'sets'),
  ('workout_sessions', 'went_lighter'), ('set_logs', 'reps'), ('rep_records', 'best_reps'),
  ('next_targets', 'target_weight_lb'), ('lighter_weeks', 'source'),
  ('coach_suggestions', 'status'), ('audit_events', 'action')
) as w (t, c);

select throws_ok(format('delete from public.%I', t), '42501', null,
  format('app cannot delete from %s', t))
from unnest(array[
  'exercises', 'plans', 'plan_items', 'workout_sessions', 'set_logs', 'rep_records',
  'next_targets', 'lighter_weeks', 'coach_suggestions', 'audit_events'
]) as t;

select throws_ok('select * from public.invites', '42501', null, 'app cannot read invites');
select throws_ok('select * from public.ai_usage', '42501', null, 'app cannot read ai_usage');
select throws_ok($$insert into public.invites (email) values ('c@example.com')$$, '42501', null,
  'app cannot add an invite');
select throws_ok($$insert into public.ai_usage (day) values ('2026-10-26')$$, '42501', null,
  'app cannot write ai_usage');

select lives_ok(
  $$insert into public.profiles (id, days_per_week)
    values ('00000000-0000-0000-0000-00000000000b', 4)$$,
  'app adds its own profile');
select lives_ok(
  $$update public.profiles set days_per_week = 5 where id = '00000000-0000-0000-0000-00000000000b'$$,
  'app changes its own profile');
select throws_ok(
  $$insert into public.profiles (id, days_per_week)
    values ('00000000-0000-0000-0000-00000000000a', 4)$$,
  '42501', null, 'app cannot add a profile for someone else');
with changed as (
  update public.profiles set days_per_week = 6
  where id = '00000000-0000-0000-0000-00000000000a'
  returning 1
)
select is(count(*), 0::bigint, 'app cannot change someone else''s profile') from changed;
select throws_ok(
  $$update public.profiles set id = '00000000-0000-0000-0000-00000000000a'
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501', null, 'app cannot move its profile to someone else');
select throws_ok('delete from public.profiles', '42501', null, 'app cannot delete a profile');

select lives_ok(
  $$insert into public.consents (user_id, kind, policy_version, granted)
    values ('00000000-0000-0000-0000-00000000000b', 'ai_coach', '1', false)$$,
  'app adds its own consent');
select throws_ok(
  $$insert into public.consents (user_id, kind, policy_version, granted)
    values ('00000000-0000-0000-0000-00000000000a', 'data', '1', true)$$,
  '42501', null, 'app cannot add a consent for someone else');
select throws_ok('update public.consents set granted = false', '42501', null,
  'consents are append-only: no update');
select throws_ok('delete from public.consents', '42501', null,
  'consents are append-only: no delete');

-- A password sign-in that skipped MFA can't write either.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1","is_anonymous":false}',
  true);

with changed as (
  update public.profiles set days_per_week = 6
  where id = '00000000-0000-0000-0000-00000000000a'
  returning 1
)
select is(count(*), 0::bigint, 'without MFA: cannot change its own profile') from changed;
select throws_ok(
  $$insert into public.consents (user_id, kind, policy_version, granted)
    values ('00000000-0000-0000-0000-00000000000a', 'data', '1', true)$$,
  '42501', null, 'without MFA: cannot add a consent');

reset role;

select is(
  (select days_per_week from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  3::smallint,
  'A''s profile is unchanged'
);
select is(
  (select days_per_week from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  5::smallint,
  'B''s own update landed'
);

select * from finish();
rollback;
