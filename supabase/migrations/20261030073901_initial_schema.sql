-- Handoff §6. The app reads its own rows and writes only profiles and consents;
-- Edge Functions write everything else with the secret key.

-- New objects in public get no access for app roles until a migration grants it.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- PUBLIC's execute on functions is a global default, so only a global revoke removes it.
alter default privileges for role postgres
  revoke execute on functions from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  experience text check (experience in ('new', 'intermediate', 'experienced')),
  goal_intensity text check (goal_intensity in ('standard', 'intense')),
  days_per_week smallint check (days_per_week between 2 and 6),
  equipment text check (equipment in ('full_gym', 'dumbbells_only')),
  avoid_areas text[] not null default '{}' check (
    avoid_areas <@ array['shoulder', 'elbow', 'wrist', 'neck', 'lower_back', 'hip', 'knee', 'ankle']
  ),
  light_areas text[] not null default '{}' check (
    light_areas <@ array['shoulder', 'elbow', 'wrist', 'neck', 'lower_back', 'hip', 'knee', 'ankle']
  ),
  light_ack_at timestamptz,
  adult_confirmed_at timestamptz,
  readiness_ack_at timestamptz,
  created_at timestamptz not null default now(),
  constraint areas_trained_one_way check (not (avoid_areas && light_areas)),
  constraint light_areas_acknowledged check (cardinality(light_areas) = 0 or light_ack_at is not null)
);

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('data', 'ai_coach')),
  policy_version text not null check (policy_version <> ''),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_id_created_at_idx on public.consents (user_id, created_at);

create table public.invites (
  email text primary key check (email = lower(email) and email like '%_@_%'),
  created_at timestamptz not null default now()
);

create table public.exercises (
  slug text primary key check (slug ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  name text not null check (name <> ''),
  movement_pattern text not null check (
    movement_pattern in (
      'squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push',
      'horizontal_pull', 'vertical_pull', 'accessory'
    )
  ),
  equipment text[] not null check (
    cardinality(equipment) > 0
    and equipment <@ array['barbell', 'dumbbell', 'machine', 'cable']
  ),
  muscle_great text not null check (
    muscle_great in ('legs', 'back', 'chest', 'shoulders', 'arms', 'core')
  ),
  muscle_light text check (
    muscle_light in ('legs', 'back', 'chest', 'shoulders', 'arms', 'core')
    and muscle_light <> muscle_great
  ),
  regions_great text[] not null default '{}' check (
    regions_great <@ array['shoulder', 'elbow', 'wrist', 'neck', 'lower_back', 'hip', 'knee', 'ankle']
  ),
  regions_light text[] not null default '{}' check (
    regions_light <@ array['shoulder', 'elbow', 'wrist', 'neck', 'lower_back', 'hip', 'knee', 'ankle']
  ),
  increment_lb numeric(5, 1) not null check (increment_lb > 0),
  min_load_lb numeric(5, 1) not null check (min_load_lb > 0),
  is_main_lift boolean not null default false,
  allowed_swaps text[] not null default '{}' check (not (slug = any (allowed_swaps))),
  cues text[] not null check (cardinality(cues) between 2 and 3),
  constraint regions_graded_once check (not (regions_great && regions_light))
);

create table public.plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version >= 1),
  source text not null check (source in ('rules', 'coach')),
  status text not null check (status in ('active', 'superseded')),
  created_at timestamptz not null default now(),
  unique (user_id, version),
  unique (id, user_id)
);
create unique index plans_one_active_per_user_idx on public.plans (user_id)
  where status = 'active';

create table public.plan_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_label text not null check (day_label ~ '^[A-Z]$'),
  position smallint not null check (position >= 1),
  exercise_slug text not null references public.exercises (slug),
  sets smallint not null check (sets between 1 and 10),
  rep_min smallint not null check (rep_min >= 1),
  rep_max smallint not null check (rep_max <= 12),
  rir smallint not null check (rir between 0 and 10),
  is_light boolean not null default false,
  start_weight_lb numeric(5, 1) check (start_weight_lb > 0 and start_weight_lb <= 1500),
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete cascade,
  unique (plan_id, day_label, position),
  constraint rep_range_ordered check (rep_min <= rep_max),
  constraint light_item_shape check (not is_light or (sets = 2 and rep_min = 10 and rep_max = 12))
);
create index plan_items_user_id_idx on public.plan_items (user_id);

create table public.workout_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null,
  plan_id bigint not null,
  day_label text not null check (day_label ~ '^[A-Z]$'),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null check (duration_s >= 0),
  utc_offset_min smallint not null check (utc_offset_min between -720 and 840),
  went_lighter boolean not null default false,
  foreign key (plan_id, user_id) references public.plans (id, user_id),
  unique (user_id, client_id),
  unique (id, user_id),
  constraint started_before_ended check (started_at <= ended_at)
);

create table public.set_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id bigint not null,
  exercise_slug text not null references public.exercises (slug),
  set_index smallint not null check (set_index >= 0),
  weight_lb numeric(5, 1) not null check (weight_lb > 0 and weight_lb <= 1500),
  reps smallint not null check (reps between 1 and 100),
  effort smallint check (effort between 1 and 3),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id)
    on delete cascade,
  unique (session_id, exercise_slug, set_index)
);
create index set_logs_user_id_idx on public.set_logs (user_id);

create table public.rep_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_slug text not null references public.exercises (slug),
  weight_lb numeric(5, 1) not null check (weight_lb > 0 and weight_lb <= 1500),
  best_reps smallint not null check (best_reps between 1 and 100),
  achieved_at timestamptz not null,
  primary key (user_id, exercise_slug, weight_lb)
);

create table public.next_targets (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_slug text not null references public.exercises (slug),
  target_weight_lb numeric(5, 1) check (target_weight_lb > 0 and target_weight_lb <= 1500),
  rep_min smallint not null check (rep_min >= 1),
  rep_max smallint not null check (rep_max <= 12),
  rir smallint not null check (rir between 0 and 10),
  below_range_streak smallint not null default 0 check (below_range_streak >= 0),
  primary key (user_id, exercise_slug),
  constraint rep_range_ordered check (rep_min <= rep_max)
);

create table public.lighter_weeks (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  source text not null check (source in ('rules', 'coach')),
  primary key (user_id, week_start)
);

create table public.coach_suggestions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  changes jsonb not null check (
    jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) <= 3
  ),
  checker_log jsonb not null default '[]',
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'dismissed', 'expired')
  ),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- actor has no foreign key, so the record of an account deletion survives it.
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null check (action ~ '^[a-z]+(_[a-z]+)*$'),
  subject text,
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_events_actor_created_at_idx on public.audit_events (actor, created_at);

create table public.ai_usage (
  day date primary key,
  calls integer not null default 0 check (calls >= 0)
);

-- Epley over sets of 12 reps or fewer; a single rep counts as its own weight.
-- Weeks run Monday to Sunday in the tester's local time when the session started (D66).
create view public.e1rm_by_week with (security_invoker = true) as
select
  s.user_id,
  s.exercise_slug,
  w.local_week_start as week_start,
  max(
    case when s.reps = 1 then s.weight_lb else round(s.weight_lb * (1 + s.reps / 30.0), 1) end
  ) as e1rm_lb
from public.set_logs s
join (
  select
    id,
    user_id,
    date_trunc(
      'week', (started_at at time zone 'UTC') + make_interval(mins => utc_offset_min)
    )::date as local_week_start
  from public.workout_sessions
) w on w.id = s.session_id and w.user_id = s.user_id
where s.reps <= 12
group by s.user_id, s.exercise_slug, w.local_week_start;

alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.invites enable row level security;
alter table public.exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.rep_records enable row level security;
alter table public.next_targets enable row level security;
alter table public.lighter_weeks enable row level security;
alter table public.coach_suggestions enable row level security;
alter table public.audit_events enable row level security;
alter table public.ai_usage enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "add own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "change own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "read own consents" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add own consent" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "read catalog" on public.exercises
  for select to authenticated using (true);

create policy "read own" on public.plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.plan_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.workout_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.set_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.rep_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.next_targets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.lighter_weeks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own" on public.coach_suggestions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "read own audit" on public.audit_events
  for select to authenticated using (actor = (select auth.uid()));

-- Real accounts must have passed MFA; demo sessions are anonymous.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'consents', 'invites', 'exercises', 'plans', 'plan_items', 'workout_sessions',
    'set_logs', 'rep_records', 'next_targets', 'lighter_weeks', 'coach_suggestions',
    'audit_events', 'ai_usage'
  ] loop
    execute format(
      $p$create policy "mfa or demo" on public.%I
        as restrictive for all to authenticated
        using (
          (select auth.jwt()->>'aal') = 'aal2'
          or (select (auth.jwt()->>'is_anonymous')::boolean) is true
        )$p$,
      t
    );
  end loop;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.exercises,
  public.plans,
  public.plan_items,
  public.workout_sessions,
  public.set_logs,
  public.rep_records,
  public.next_targets,
  public.lighter_weeks,
  public.coach_suggestions,
  public.audit_events,
  public.e1rm_by_week
to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.consents to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
