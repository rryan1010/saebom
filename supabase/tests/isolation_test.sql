begin;
select plan(45);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', false),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', false),
  ('00000000-0000-0000-0000-00000000000d', null, true);

insert into public.exercises
  (slug, name, movement_pattern, equipment, muscle_great, increment_lb, min_load_lb, cues)
values
  ('goblet_squat', 'Goblet squat', 'squat', '{dumbbell}', 'legs', 5, 5,
   '{"Chest up","Knees out"}');

insert into public.invites (email) values ('a@example.com');
insert into public.ai_usage (day, calls) values ('2026-10-26', 1);

insert into public.profiles (id, experience, days_per_week)
select u, 'new', 3 from unnest(array[
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000d'
]::uuid[]) as u;

insert into public.consents (user_id, kind, policy_version, granted)
select u, 'data', '1', true from unnest(array[
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000d'
]::uuid[]) as u;

insert into public.plans (id, user_id, version, source, status) overriding system value values
  (1, '00000000-0000-0000-0000-00000000000a', 1, 'rules', 'active'),
  (2, '00000000-0000-0000-0000-00000000000b', 1, 'rules', 'active'),
  (3, '00000000-0000-0000-0000-00000000000d', 1, 'rules', 'active');

insert into public.plan_items (plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir)
select id, user_id, 'A', 1, 'goblet_squat', 2, 8, 10, 3 from public.plans;

insert into public.workout_sessions
  (id, user_id, client_id, plan_id, day_label, started_at, ended_at, duration_s)
overriding system value
select id, user_id, gen_random_uuid(), id, 'A',
  '2026-10-27 17:00+00', '2026-10-27 17:45+00', 2700
from public.plans;

insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps, effort)
select user_id, id, 'goblet_squat', 0, 30, 10, 2 from public.workout_sessions;

insert into public.rep_records (user_id, exercise_slug, weight_lb, best_reps, achieved_at)
select user_id, 'goblet_squat', 30, 10, ended_at from public.workout_sessions;

insert into public.next_targets (user_id, exercise_slug, target_weight_lb, rep_min, rep_max, rir)
select user_id, 'goblet_squat', 30, 8, 10, 3 from public.plans;

insert into public.lighter_weeks (user_id, week_start, source)
select user_id, '2026-11-02', 'rules' from public.plans;

insert into public.coach_suggestions (user_id, week_start, changes)
select user_id, '2026-11-02', '[]' from public.plans;

insert into public.audit_events (actor, action, subject)
select user_id, 'session_recorded', 'workout_sessions' from public.plans;

-- User B, past MFA: sees only B's rows.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2","is_anonymous":false}',
  true);

select is((select count(*) from public.profiles where id <> auth.uid()), 0::bigint,
  'B reads no other profile');
select is((select count(*) from public.consents where user_id <> auth.uid()), 0::bigint,
  'B reads no other consents');
select is((select count(*) from public.plans where user_id <> auth.uid()), 0::bigint,
  'B reads no other plans');
select is((select count(*) from public.plan_items where user_id <> auth.uid()), 0::bigint,
  'B reads no other plan items');
select is((select count(*) from public.workout_sessions where user_id <> auth.uid()), 0::bigint,
  'B reads no other sessions');
select is((select count(*) from public.set_logs where user_id <> auth.uid()), 0::bigint,
  'B reads no other set logs');
select is((select count(*) from public.rep_records where user_id <> auth.uid()), 0::bigint,
  'B reads no other rep records');
select is((select count(*) from public.next_targets where user_id <> auth.uid()), 0::bigint,
  'B reads no other targets');
select is((select count(*) from public.lighter_weeks where user_id <> auth.uid()), 0::bigint,
  'B reads no other lighter weeks');
select is((select count(*) from public.coach_suggestions where user_id <> auth.uid()), 0::bigint,
  'B reads no other coach suggestions');
select is((select count(*) from public.audit_events where actor is distinct from auth.uid()), 0::bigint,
  'B reads no other audit events');
select is((select count(*) from public.e1rm_by_week where user_id <> auth.uid()), 0::bigint,
  'B reads no other estimated maxes');

select is((select count(*) from public.profiles), 1::bigint, 'B reads its own profile');
select is((select count(*) from public.consents), 1::bigint, 'B reads its own consents');
select is((select count(*) from public.plans), 1::bigint, 'B reads its own plans');
select is((select count(*) from public.plan_items), 1::bigint, 'B reads its own plan items');
select is((select count(*) from public.workout_sessions), 1::bigint, 'B reads its own sessions');
select is((select count(*) from public.set_logs), 1::bigint, 'B reads its own set logs');
select is((select count(*) from public.rep_records), 1::bigint, 'B reads its own rep records');
select is((select count(*) from public.next_targets), 1::bigint, 'B reads its own targets');
select is((select count(*) from public.lighter_weeks), 1::bigint, 'B reads its own lighter weeks');
select is((select count(*) from public.coach_suggestions), 1::bigint,
  'B reads its own coach suggestions');
select is((select count(*) from public.audit_events), 1::bigint, 'B reads its own audit events');
select is((select count(*) from public.e1rm_by_week), 1::bigint, 'B reads its own estimated maxes');
select is((select count(*) from public.exercises), 1::bigint, 'B reads the catalog');

-- User A, signed in with a password but no MFA (aal1): reads nothing, even its own rows.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1","is_anonymous":false}',
  true);

select is((select count(*) from public.profiles), 0::bigint, 'without MFA: no profile');
select is((select count(*) from public.consents), 0::bigint, 'without MFA: no consents');
select is((select count(*) from public.exercises), 0::bigint, 'without MFA: no catalog');
select is((select count(*) from public.plans), 0::bigint, 'without MFA: no plans');
select is((select count(*) from public.plan_items), 0::bigint, 'without MFA: no plan items');
select is((select count(*) from public.workout_sessions), 0::bigint, 'without MFA: no sessions');
select is((select count(*) from public.set_logs), 0::bigint, 'without MFA: no set logs');
select is((select count(*) from public.rep_records), 0::bigint, 'without MFA: no rep records');
select is((select count(*) from public.next_targets), 0::bigint, 'without MFA: no targets');
select is((select count(*) from public.lighter_weeks), 0::bigint, 'without MFA: no lighter weeks');
select is((select count(*) from public.coach_suggestions), 0::bigint,
  'without MFA: no coach suggestions');
select is((select count(*) from public.audit_events), 0::bigint, 'without MFA: no audit events');
select is((select count(*) from public.e1rm_by_week), 0::bigint, 'without MFA: no estimated maxes');

-- A demo session is anonymous and aal1: reads its own rows.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated","aal":"aal1","is_anonymous":true}',
  true);

select is((select count(*) from public.profiles), 1::bigint, 'demo: reads its own profile');
select is((select count(*) from public.set_logs), 1::bigint, 'demo: reads its own set logs');
select is((select count(*) from public.exercises), 1::bigint, 'demo: reads the catalog');
select is((select count(*) from public.set_logs where user_id <> auth.uid()), 0::bigint,
  'demo: reads no one else''s set logs');

-- The publishable key without a session runs as anon, which has no table access.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select count(*) from public.exercises', '42501', null,
  'anon cannot read the catalog');
select throws_ok('select count(*) from public.profiles', '42501', null,
  'anon cannot read profiles');
select throws_ok('select count(*) from public.e1rm_by_week', '42501', null,
  'anon cannot read estimated maxes');

reset role;

select * from finish();
rollback;
