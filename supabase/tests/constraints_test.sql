begin;
select plan(34);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

insert into public.exercises
  (slug, name, movement_pattern, equipment, muscle_great, increment_lb, min_load_lb, cues)
values
  ('goblet_squat', 'Goblet squat', 'squat', '{dumbbell}', 'legs', 5, 5, '{"Chest up","Knees out"}')
on conflict (slug) do nothing;

insert into public.plans (id, user_id, version, source, status) overriding system value values
  (1, '00000000-0000-0000-0000-00000000000a', 1, 'rules', 'active'),
  (2, '00000000-0000-0000-0000-00000000000b', 1, 'rules', 'active');

insert into public.workout_sessions
  (id, user_id, client_id, plan_id, day_label, started_at, ended_at, duration_s, utc_offset_min)
overriding system value values
  (1, '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'A',
   '2026-10-27 17:00+00', '2026-10-27 17:45+00', 2700, -420),
  (2, '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'B',
   '2026-10-29 17:00+00', '2026-10-29 17:45+00', 2700, -420),
  (3, '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'C',
   '2026-11-02 03:00+00', '2026-11-02 03:45+00', 2700, -480),
  (4, '00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'A',
   '2026-11-02 03:00+00', '2026-11-02 03:45+00', 2700, 0);

-- profiles
select throws_ok(
  $$insert into public.profiles (id, avoid_areas, light_areas, light_ack_at)
    values ('00000000-0000-0000-0000-00000000000a', '{knee}', '{knee}', now())$$,
  '23514', null, 'an area is trained around or light, not both');
select throws_ok(
  $$insert into public.profiles (id, light_areas)
    values ('00000000-0000-0000-0000-00000000000a', '{knee}')$$,
  '23514', null, 'train it light needs the acknowledged warning');
select lives_ok(
  $$insert into public.profiles (id, avoid_areas, light_areas, light_ack_at)
    values ('00000000-0000-0000-0000-00000000000a', '{shoulder}', '{knee}', now())$$,
  'train it light saves once the warning is acknowledged');
select throws_ok(
  $$update public.profiles set light_ack_at = null
    where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'the acknowledgment cannot be cleared while an area is light');
select throws_ok(
  $$insert into public.profiles (id, avoid_areas)
    values ('00000000-0000-0000-0000-00000000000b', '{toe}')$$,
  '23514', null, 'areas come from the fixed list');
select throws_ok(
  $$insert into public.profiles (id, days_per_week)
    values ('00000000-0000-0000-0000-00000000000b', 7)$$,
  '23514', null, 'days per week stays within 2-6');

-- set_logs
select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps)
    values ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 0, 0, 8)$$,
  '23514', null, 'weight is above 0');
select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps)
    values ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 0, 1500.1, 8)$$,
  '23514', null, 'weight is at most 1500 lb');
select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps)
    values ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 0, 30, 0)$$,
  '23514', null, 'reps are at least 1');
select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps)
    values ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 0, 30, 101)$$,
  '23514', null, 'reps are at most 100');
select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps, effort)
    values ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 0, 30, 8, 4)$$,
  '23514', null, 'effort is 1-3');
select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps)
    values ('00000000-0000-0000-0000-00000000000b', 1, 'goblet_squat', 0, 30, 8)$$,
  '23503', null, 'a set log belongs to a session of the same user');

-- plan_items and next_targets
select throws_ok(
  $$insert into public.plan_items (plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir)
    values (1, '00000000-0000-0000-0000-00000000000a', 'A', 1, 'goblet_squat', 3, 10, 13, 2)$$,
  '23514', null, 'a plan item never goes above 12 reps');
select throws_ok(
  $$insert into public.plan_items (plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir, is_light)
    values (1, '00000000-0000-0000-0000-00000000000a', 'A', 1, 'goblet_squat', 3, 10, 12, 4, true)$$,
  '23514', null, 'a light item has exactly 2 sets');
select throws_ok(
  $$insert into public.plan_items (plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir, is_light)
    values (1, '00000000-0000-0000-0000-00000000000a', 'A', 1, 'goblet_squat', 2, 8, 10, 4, true)$$,
  '23514', null, 'a light item is 10-12 reps');
select lives_ok(
  $$insert into public.plan_items (plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir, is_light)
    values (1, '00000000-0000-0000-0000-00000000000a', 'A', 1, 'goblet_squat', 2, 10, 12, 4, true)$$,
  'a light item of 2 sets of 10-12 saves');
select throws_ok(
  $$insert into public.plan_items (plan_id, user_id, day_label, position, exercise_slug, sets, rep_min, rep_max, rir)
    values (1, '00000000-0000-0000-0000-00000000000b', 'A', 2, 'goblet_squat', 2, 8, 10, 3)$$,
  '23503', null, 'a plan item belongs to a plan of the same user');
select throws_ok(
  $$insert into public.next_targets (user_id, exercise_slug, target_weight_lb, rep_min, rep_max, rir)
    values ('00000000-0000-0000-0000-00000000000a', 'goblet_squat', 30, 10, 13, 2)$$,
  '23514', null, 'a target never goes above 12 reps');

-- sessions, plans, consents, invites, coach suggestions, exercises
select throws_ok(
  $$insert into public.workout_sessions (user_id, client_id, plan_id, day_label, started_at, ended_at, duration_s, utc_offset_min)
    values ('00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'A',
            '2026-10-27 18:00+00', '2026-10-27 17:00+00', 0, -420)$$,
  '23514', null, 'a session starts before it ends');
select throws_ok(
  $$insert into public.plans (user_id, version, source, status)
    values ('00000000-0000-0000-0000-00000000000a', 2, 'rules', 'active')$$,
  '23505', null, 'a user has one active plan');
select throws_ok(
  $$insert into public.consents (user_id, kind, policy_version, granted)
    values ('00000000-0000-0000-0000-00000000000a', 'marketing', '1', true)$$,
  '23514', null, 'consent kinds are data and ai_coach');
select throws_ok(
  $$insert into public.invites (email) values ('Friend@Example.com')$$,
  '23514', null, 'invite emails are stored lowercase');
select throws_ok(
  $$insert into public.coach_suggestions (user_id, week_start, changes)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-02', '[{},{},{},{}]')$$,
  '23514', null, 'a coach suggestion has at most 3 changes');
select throws_ok(
  $$insert into public.exercises (slug, name, movement_pattern, equipment, muscle_great, increment_lb, min_load_lb, cues)
    values ('leg_press', 'Leg press', 'squat', '{machine}', 'legs', 5, 5, '{"Feet flat"}')$$,
  '23514', null, 'an exercise has 2-3 cues');
select throws_ok(
  $$insert into public.exercises (slug, name, movement_pattern, equipment, muscle_great, increment_lb, min_load_lb, cues, allowed_swaps)
    values ('leg_press', 'Leg press', 'squat', '{machine}', 'legs', 5, 5, '{"Feet flat","Slow down"}', '{leg_press}')$$,
  '23514', null, 'an exercise never swaps with itself');
select throws_ok(
  $$insert into public.exercises (slug, name, movement_pattern, equipment, muscle_great, increment_lb, min_load_lb, cues, regions_great, regions_light)
    values ('leg_press', 'Leg press', 'squat', '{machine}', 'legs', 5, 5, '{"Feet flat","Slow down"}', '{knee}', '{knee}')$$,
  '23514', null, 'a region is graded great or light, not both');

-- e1rm_by_week
insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps) values
  ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 0, 100, 10),
  ('00000000-0000-0000-0000-00000000000a', 1, 'goblet_squat', 1, 120, 13),
  ('00000000-0000-0000-0000-00000000000a', 2, 'goblet_squat', 0, 130, 1);

select is(
  (select e1rm_lb from public.e1rm_by_week
   where user_id = '00000000-0000-0000-0000-00000000000a' and week_start = '2026-10-26'),
  133.3,
  'e1rm is the best Epley value of the week, skipping sets above 12 reps'
);

delete from public.set_logs where session_id = 1 and set_index = 0;

select is(
  (select e1rm_lb from public.e1rm_by_week
   where user_id = '00000000-0000-0000-0000-00000000000a' and week_start = '2026-10-26'),
  130.0,
  'a single rep counts as its own weight'
);

-- Sessions 3 and 4 both start Monday Nov 2 at 03:00 UTC: Sunday evening in Pacific time
-- for session 3, Monday for session 4 (D66).
insert into public.set_logs (user_id, session_id, exercise_slug, set_index, weight_lb, reps) values
  ('00000000-0000-0000-0000-00000000000a', 3, 'goblet_squat', 0, 200, 1),
  ('00000000-0000-0000-0000-00000000000a', 4, 'goblet_squat', 0, 50, 1);

select is(
  (select e1rm_lb from public.e1rm_by_week
   where user_id = '00000000-0000-0000-0000-00000000000a' and week_start = '2026-10-26'),
  200.0,
  'a Sunday-evening session counts toward the local week, not the UTC week'
);
select is(
  (select e1rm_lb from public.e1rm_by_week
   where user_id = '00000000-0000-0000-0000-00000000000a' and week_start = '2026-11-02'),
  50.0,
  'the same instant at UTC+0 counts toward the next week'
);
select throws_ok(
  $$insert into public.workout_sessions (user_id, client_id, plan_id, day_label, started_at, ended_at, duration_s, utc_offset_min)
    values ('00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'A',
            '2026-10-27 17:00+00', '2026-10-27 17:45+00', 2700, 900)$$,
  '23514', null, 'a UTC offset stays within -12:00 and +14:00');

-- Account deletion cascades to every row; the audit trail survives it.
insert into public.consents (user_id, kind, policy_version, granted) values
  ('00000000-0000-0000-0000-00000000000a', 'data', '1', true);
insert into public.next_targets (user_id, exercise_slug, target_weight_lb, rep_min, rep_max, rir) values
  ('00000000-0000-0000-0000-00000000000a', 'goblet_squat', 100, 8, 10, 3);
insert into public.lighter_weeks (user_id, week_start, source) values
  ('00000000-0000-0000-0000-00000000000a', '2026-11-02', 'rules');
insert into public.coach_suggestions (user_id, week_start, changes) values
  ('00000000-0000-0000-0000-00000000000a', '2026-11-02', '[]');
insert into public.audit_events (actor, action) values
  ('00000000-0000-0000-0000-00000000000a', 'account_deleted');

select ok(
  exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.consents where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.plans where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.plan_items where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.workout_sessions where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.set_logs where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.rep_records where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.next_targets where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.lighter_weeks where user_id = '00000000-0000-0000-0000-00000000000a')
  and exists (select 1 from public.coach_suggestions where user_id = '00000000-0000-0000-0000-00000000000a'),
  'user A has a row in every user table before deletion'
);

delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.consents where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.plans where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.plan_items where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.workout_sessions where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.set_logs where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.rep_records where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.next_targets where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.lighter_weeks where user_id = '00000000-0000-0000-0000-00000000000a')
  + (select count(*) from public.coach_suggestions where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'deleting a user removes all of their rows'
);
select is(
  (select count(*) from public.audit_events where actor = '00000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'audit events outlive the account'
);

select * from finish();
rollback;
