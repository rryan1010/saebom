-- Handoff §6 and §8 step 6. finish-workout calls record_session with the secret key;
-- the rep-record trigger keeps rep_records in step with set_logs.

-- Statement level: two sets at one weight in the same insert would otherwise make
-- "on conflict do update" touch the same row twice. The conditional update makes
-- the records depend only on which sessions exist, not on the order they arrive.
create function public.record_rep_records() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.rep_records (user_id, exercise_slug, weight_lb, best_reps, achieved_at)
  select distinct on (n.user_id, n.exercise_slug, n.weight_lb)
    n.user_id, n.exercise_slug, n.weight_lb, n.reps, s.started_at
  from new_sets n
  join public.workout_sessions s on s.id = n.session_id and s.user_id = n.user_id
  order by n.user_id, n.exercise_slug, n.weight_lb, n.reps desc, s.started_at
  on conflict (user_id, exercise_slug, weight_lb) do update
    set best_reps = excluded.best_reps, achieved_at = excluded.achieved_at
    where excluded.best_reps > public.rep_records.best_reps
      or (excluded.best_reps = public.rep_records.best_reps
          and excluded.achieved_at < public.rep_records.achieved_at);
  return null;
end;
$$;

create trigger set_logs_rep_records
after insert on public.set_logs
referencing new table as new_sets
for each statement execute function public.record_rep_records();

create function public.record_session(
  p_user_id uuid,
  p_client_id uuid,
  p_plan_id bigint,
  p_day_label text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_utc_offset_min smallint,
  p_went_lighter boolean,
  p_sets jsonb,
  out session_id bigint,
  out is_new boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_sets) is distinct from 'array' then
    raise exception 'p_sets must be a JSON array' using errcode = '22023';
  end if;

  insert into public.workout_sessions
    (user_id, client_id, plan_id, day_label, started_at, ended_at, duration_s,
     utc_offset_min, went_lighter)
  values
    (p_user_id, p_client_id, p_plan_id, p_day_label, p_started_at, p_ended_at,
     floor(extract(epoch from p_ended_at - p_started_at))::integer,
     p_utc_offset_min, p_went_lighter)
  on conflict (user_id, client_id) do nothing
  returning id into session_id;

  if session_id is null then
    select s.id into session_id
    from public.workout_sessions s
    where s.user_id = p_user_id and s.client_id = p_client_id;
    is_new := false;
    return;
  end if;

  insert into public.set_logs
    (user_id, session_id, exercise_slug, set_index, weight_lb, reps, effort)
  select p_user_id, session_id, x.exercise_slug, x.set_index, x.weight_lb, x.reps, x.effort
  from jsonb_to_recordset(p_sets) as x(
    exercise_slug text, set_index smallint, weight_lb numeric, reps smallint, effort smallint
  );

  is_new := true;
end;
$$;

-- Supabase's default privileges also hand service_role execute on new functions. A trigger
-- fires without the caller holding execute on its function, so nobody needs it.
revoke execute on function public.record_rep_records() from public, anon, authenticated, service_role;
revoke execute on function public.record_session(
  uuid, uuid, bigint, text, timestamptz, timestamptz, smallint, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.record_session(
  uuid, uuid, bigint, text, timestamptz, timestamptz, smallint, boolean, jsonb
) to service_role;
