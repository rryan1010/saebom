begin;
select plan(57);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', false),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.com', false);

insert into public.exercises
  (slug, name, movement_pattern, equipment, muscle_great, increment_lb, min_load_lb, cues)
values
  ('test_press', 'Test press', 'horizontal_push', '{dumbbell}', 'chest', 5, 5, '{"Cue one","Cue two"}'),
  ('test_row', 'Test row', 'horizontal_pull', '{dumbbell}', 'back', 5, 5, '{"Cue one","Cue two"}');

insert into public.plans (id, user_id, version, source, status) overriding system value values
  (9001, '00000000-0000-0000-0000-0000000000a1', 1, 'rules', 'active'),
  (9002, '00000000-0000-0000-0000-0000000000b2', 1, 'rules', 'active');

create temp table calls (label text primary key, session_id bigint, is_new boolean);
grant all on calls to service_role;

set local role service_role;

-- First call: session, sets, computed duration, records.
insert into calls
select 'first', r.session_id, r.is_new from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 9001, 'A',
  '2026-10-27 17:00:00+00', '2026-10-27 17:45:00.7+00', -420::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":100,"reps":8,"effort":2},
    {"exercise_slug":"test_press","set_index":1,"weight_lb":100,"reps":6,"effort":3},
    {"exercise_slug":"test_row","set_index":0,"weight_lb":50,"reps":10,"effort":1}]'::jsonb
) r;

select is((select is_new from calls where label = 'first'), true, 'first call is new');
select is((select count(*) from public.workout_sessions
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'first call writes a session');
select is((select count(*) from public.set_logs
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 3::bigint, 'first call writes its sets');
select is((select duration_s from public.workout_sessions
  where id = (select session_id from calls where label = 'first')), 2700,
  'duration_s is computed from the timestamps, rounded down');
select is((select utc_offset_min::int || day_label || went_lighter::text
  from public.workout_sessions where id = (select session_id from calls where label = 'first')),
  '-420Afalse', 'the session keeps the offset, day label and went_lighter');
select is((select count(*) from public.set_logs
  where session_id = (select session_id from calls where label = 'first')), 3::bigint,
  'the sets belong to the returned session');
select is((select best_reps from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1' and exercise_slug = 'test_press'
    and weight_lb = 100), 8::smallint, 'two sets at one weight in one session keep the max');
select is((select achieved_at from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1' and exercise_slug = 'test_press'
    and weight_lb = 100), '2026-10-27 17:00:00+00'::timestamptz,
  'the first set at a weight creates a record at the session start');
select is((select best_reps from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1' and exercise_slug = 'test_row'), 10::smallint,
  'each exercise gets its own record');

-- Retry with the same client_id and different sets: nothing changes.
insert into calls
select 'retry', r.session_id, r.is_new from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 9001, 'A',
  '2026-10-27 17:00:00+00', '2026-10-27 17:45:00.7+00', -420::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":100,"reps":12,"effort":1},
    {"exercise_slug":"test_row","set_index":0,"weight_lb":60,"reps":5,"effort":1}]'::jsonb
) r;

select is((select is_new from calls where label = 'retry'), false, 'a retry is not new');
select is((select session_id from calls where label = 'retry'),
  (select session_id from calls where label = 'first'), 'a retry returns the first session id');
select is((select count(*) from public.workout_sessions
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 1::bigint, 'a retry adds no session');
select is((select count(*) from public.set_logs
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 3::bigint, 'a retry adds no sets');
select is((select count(*) from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1'), 2::bigint, 'a retry adds no records');
select is((select best_reps from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1' and exercise_slug = 'test_press'
    and weight_lb = 100), 8::smallint, 'a retry does not change a record');

-- The same client_id for another user is a separate session.
insert into calls
select 'other_user', r.session_id, r.is_new from public.record_session(
  '00000000-0000-0000-0000-0000000000b2', '11111111-1111-1111-1111-111111111111', 9002, 'A',
  '2026-10-27 18:00:00+00', '2026-10-27 18:30:00+00', 0::smallint, true,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":100,"reps":5,"effort":2}]'::jsonb
) r;

select is((select is_new from calls where label = 'other_user'), true,
  'the same client_id for another user is new');
select isnt((select session_id from calls where label = 'other_user'),
  (select session_id from calls where label = 'first'), 'and it gets its own session');
select is((select count(*) from public.workout_sessions
  where client_id = '11111111-1111-1111-1111-111111111111'), 2::bigint,
  'both users have a session under that client_id');
select is((select best_reps from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000b2' and exercise_slug = 'test_press'), 5::smallint,
  'records are per user');
select is((select best_reps from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1' and exercise_slug = 'test_press'
    and weight_lb = 100), 8::smallint, 'and the other user''s record is untouched');

-- A bad set rolls back the whole call, including the session row and earlier good sets.
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-000000000001', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":300,"reps":9,"effort":2},
    {"exercise_slug":"no_such_exercise","set_index":0,"weight_lb":50,"reps":8,"effort":2}]'::jsonb)$$,
  '23503', null, 'an unknown exercise fails the call');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-000000000002', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":300,"reps":9,"effort":2},
    {"exercise_slug":"test_press","set_index":1,"weight_lb":50,"reps":0,"effort":2}]'::jsonb)$$,
  '23514', null, 'zero reps fails the call');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-000000000003', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":300,"reps":9,"effort":2},
    {"exercise_slug":"test_press","set_index":1,"weight_lb":0,"reps":8,"effort":2}]'::jsonb)$$,
  '23514', null, 'zero weight fails the call');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-000000000004', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":300,"reps":9,"effort":2},
    {"exercise_slug":"test_press","set_index":1,"weight_lb":50,"reps":8,"effort":4}]'::jsonb)$$,
  '23514', null, 'effort 4 fails the call');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-000000000005', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":300,"reps":9,"effort":2},
    {"exercise_slug":"test_press","set_index":0,"weight_lb":50,"reps":8,"effort":2}]'::jsonb)$$,
  '23505', null, 'a duplicate set_index fails the call');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-000000000006', 9001, 'A',
  '2026-10-28 18:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":300,"reps":9,"effort":2}]'::jsonb)$$,
  '23514', null, 'an end before the start fails the call');

select is((select count(*) from public.workout_sessions
  where client_id::text like '22222222-%'), 0::bigint, 'a failed call leaves no session');
select is((select count(*) from public.set_logs where weight_lb = 300), 0::bigint,
  'a failed call leaves no sets');
select is((select count(*) from public.rep_records where weight_lb = 300), 0::bigint,
  'a failed call leaves no records');

-- A session on someone else's plan.
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '33333333-3333-3333-3333-333333333333', 9002, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":50,"reps":8,"effort":2}]'::jsonb)$$,
  '23503', null, 'a session on another user''s plan fails');
select is((select count(*) from public.workout_sessions
  where client_id = '33333333-3333-3333-3333-333333333333'), 0::bigint,
  'and writes nothing');

-- p_sets must be a JSON array.
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444441', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false, '{"exercise_slug":"test_press"}'::jsonb)$$,
  '22023', null, 'a JSON object for p_sets raises 22023');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444442', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false, 'null'::jsonb)$$,
  '22023', null, 'a JSON null for p_sets raises 22023');
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '44444444-4444-4444-4444-444444444443', 9001, 'A',
  '2026-10-28 17:00+00', '2026-10-28 17:30+00', 0::smallint, false, null)$$,
  '22023', null, 'a SQL null for p_sets raises 22023');
select is((select count(*) from public.workout_sessions
  where client_id::text like '44444444-%'), 0::bigint, 'a non-array p_sets writes nothing');

-- Rep records, all for user A at test_press.
select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000001', 9001, 'A',
  '2026-11-01 17:00+00', '2026-11-01 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":120,"reps":5,"effort":2}]'::jsonb);
select is((select best_reps from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), 5::smallint, 'a new weight starts a record');
select is((select achieved_at from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), '2026-11-01 17:00+00'::timestamptz,
  'at that session''s start');

select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000002', 9001, 'A',
  '2026-11-03 17:00+00', '2026-11-03 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":120,"reps":7,"effort":2}]'::jsonb);
select is((select best_reps from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), 7::smallint, 'more reps raise the record');
select is((select achieved_at from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), '2026-11-03 17:00+00'::timestamptz,
  'and move achieved_at to the new session');

select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000003', 9001, 'A',
  '2026-11-05 17:00+00', '2026-11-05 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":120,"reps":6,"effort":2}]'::jsonb);
select is((select best_reps || '@' || achieved_at::text from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), '7@2026-11-03 17:00:00+00',
  'fewer reps leave the record alone');

select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000004', 9001, 'A',
  '2026-11-04 17:00+00', '2026-11-04 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":130,"reps":4,"effort":2},
    {"exercise_slug":"test_press","set_index":1,"weight_lb":130,"reps":6,"effort":2},
    {"exercise_slug":"test_press","set_index":2,"weight_lb":130,"reps":5,"effort":2},
    {"exercise_slug":"test_press","set_index":3,"weight_lb":140,"reps":3,"effort":3}]'::jsonb);
select is((select best_reps from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 130), 6::smallint,
  'three sets at one weight in one session keep the max');
select is((select best_reps from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 140), 3::smallint,
  'a heavier weight in the same session gets its own record');

-- An older session uploaded late.
select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000005', 9001, 'A',
  '2026-11-02 17:00+00', '2026-11-02 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":120,"reps":7,"effort":2}]'::jsonb);
select is((select best_reps || '@' || achieved_at::text from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), '7@2026-11-02 17:00:00+00',
  'an older session with equal reps moves achieved_at earlier');

select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000006', 9001, 'A',
  '2026-10-30 17:00+00', '2026-10-30 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":120,"reps":6,"effort":2}]'::jsonb);
select is((select best_reps || '@' || achieved_at::text from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), '7@2026-11-02 17:00:00+00',
  'an older session with fewer reps changes nothing');

select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '55555555-5555-5555-5555-000000000007', 9001, 'A',
  '2026-11-06 17:00+00', '2026-11-06 17:30+00', 0::smallint, false,
  '[{"exercise_slug":"test_press","set_index":0,"weight_lb":120,"reps":7,"effort":2}]'::jsonb);
select is((select achieved_at from public.rep_records where user_id = '00000000-0000-0000-0000-0000000000a1'
  and exercise_slug = 'test_press' and weight_lb = 120), '2026-11-02 17:00+00'::timestamptz,
  'a newer session with equal reps keeps the earlier achieved_at');

select is((select array_agg(weight_lb order by weight_lb) from public.rep_records
  where user_id = '00000000-0000-0000-0000-0000000000a1' and exercise_slug = 'test_press'),
  array[100, 120, 130, 140]::numeric[], 'each weight has exactly one record');

-- The trigger fired above although nobody can execute its function directly.
reset role;
select is((select tgtype & 1 from pg_trigger where tgname = 'set_logs_rep_records'), 0,
  'the rep-record trigger is statement level');

-- Privileges.
select ok(
  not has_function_privilege('anon', 'public.record_rep_records()', 'execute')
  and not has_function_privilege('authenticated', 'public.record_rep_records()', 'execute')
  and not has_function_privilege('public', 'public.record_rep_records()', 'execute')
  and not has_function_privilege('service_role', 'public.record_rep_records()', 'execute'),
  'nobody but the owner can execute the trigger function');
select ok(
  not has_function_privilege('anon',
    'public.record_session(uuid, uuid, bigint, text, timestamptz, timestamptz, smallint, boolean, jsonb)',
    'execute')
  and not has_function_privilege('authenticated',
    'public.record_session(uuid, uuid, bigint, text, timestamptz, timestamptz, smallint, boolean, jsonb)',
    'execute')
  and not has_function_privilege('public',
    'public.record_session(uuid, uuid, bigint, text, timestamptz, timestamptz, smallint, boolean, jsonb)',
    'execute'),
  'anon, authenticated and public cannot execute record_session');
select ok(has_function_privilege('service_role',
  'public.record_session(uuid, uuid, bigint, text, timestamptz, timestamptz, smallint, boolean, jsonb)',
  'execute'), 'service_role can execute record_session');
select is((select proconfig from pg_proc where proname = 'record_session'
  and pronamespace = 'public'::regnamespace), array['search_path=""'],
  'record_session sets search_path to empty');
select is((select proconfig from pg_proc where proname = 'record_rep_records'
  and pronamespace = 'public'::regnamespace), array['search_path=""'],
  'record_rep_records sets search_path to empty');
select is((select prosecdef from pg_proc where proname = 'record_session'
  and pronamespace = 'public'::regnamespace), false, 'record_session is security invoker');

set local role anon;
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '66666666-6666-6666-6666-666666666661', 9001, 'A',
  '2026-11-07 17:00+00', '2026-11-07 17:30+00', 0::smallint, false, '[]'::jsonb)$$,
  '42501', null, 'anon cannot call record_session');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2","is_anonymous":false}',
  true);
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '66666666-6666-6666-6666-666666666662', 9001, 'A',
  '2026-11-07 17:00+00', '2026-11-07 17:30+00', 0::smallint, false, '[]'::jsonb)$$,
  '42501', null, 'an aal2 user cannot call record_session');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1","is_anonymous":true}',
  true);
select throws_ok($$select * from public.record_session(
  '00000000-0000-0000-0000-0000000000a1', '66666666-6666-6666-6666-666666666663', 9001, 'A',
  '2026-11-07 17:00+00', '2026-11-07 17:30+00', 0::smallint, false, '[]'::jsonb)$$,
  '42501', null, 'a demo session cannot call record_session');
select throws_ok($$select public.record_rep_records()$$, '42501', null,
  'an app role cannot call the trigger function');

select * from finish();
rollback;
