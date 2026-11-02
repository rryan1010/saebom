begin;
select plan(11);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'every public table has row level security enabled'
);

select is(
  (select array_agg(t.tablename::text order by t.tablename)
   from pg_tables t
   where t.schemaname = 'public'
     and not exists (
       select 1 from pg_policies p
       where p.schemaname = 'public' and p.tablename = t.tablename
         and p.policyname = 'mfa or demo' and p.permissive = 'RESTRICTIVE'
         and p.cmd = 'ALL' and p.roles = '{authenticated}'
     )),
  null,
  'every public table has the restrictive "mfa or demo" policy'
);

select ok(
  (select 'security_invoker=true' = any (c.reloptions)
   from pg_class c where c.oid = 'public.e1rm_by_week'::regclass),
  'e1rm_by_week runs with the caller''s RLS'
);

-- Effective privileges, so grants to PUBLIC, column grants and sequences count too. Auth's role
-- (supabase_auth_admin) is pinned here too, because the invite hook reads public.invites as it.
create temporary view app_privileges as
select r.role, c.relname::text as relation, p.priv
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated'), ('supabase_auth_admin')) as r (role)
cross join (values
  ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('USAGE')
) as p (priv)
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  and case
    when c.relkind = 'S' then
      p.priv in ('SELECT', 'UPDATE', 'USAGE') and has_sequence_privilege(r.role, c.oid, p.priv)
    when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') then
      has_any_column_privilege(r.role, c.oid, p.priv)
    when p.priv in ('DELETE', 'TRUNCATE', 'TRIGGER') then
      has_table_privilege(r.role, c.oid, p.priv)
    else false
  end;

select is(
  (select array_agg(relation || ':' || priv) from app_privileges where role = 'anon'),
  null,
  'anon has no privileges on any public table, view or sequence'
);

select is(
  (select array_agg(relation || ':' || priv order by relation, priv)
   from app_privileges where role = 'authenticated'),
  array[
    'audit_events:SELECT',
    'coach_suggestions:SELECT',
    'consents:INSERT', 'consents:SELECT',
    'e1rm_by_week:SELECT',
    'exercises:SELECT',
    'lighter_weeks:SELECT',
    'next_targets:SELECT',
    'plan_items:SELECT',
    'plans:SELECT',
    'profiles:INSERT', 'profiles:SELECT', 'profiles:UPDATE',
    'rep_records:SELECT',
    'set_logs:SELECT',
    'workout_sessions:SELECT'
  ]::text[],
  'authenticated has exactly the grants in handoff §6'
);

select is(
  (select array_agg(relation || ':' || priv) from app_privileges
   where role = 'authenticated' and relation in ('invites', 'ai_usage')),
  null,
  'authenticated has nothing on invites or ai_usage'
);

select is(
  (select array_agg(relation || ':' || priv order by relation, priv)
   from app_privileges where role = 'supabase_auth_admin'),
  array['invites:SELECT']::text[],
  'supabase_auth_admin can only read invites, for the invite hook'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v')
     and not has_table_privilege('service_role', c.oid, 'select, insert, update, delete')),
  null,
  'service_role can read and write every public table'
);

create table public.default_privileges_probe (id int);
create function public.default_privileges_probe() returns int language sql as 'select 1';

select ok(
  not has_table_privilege('anon', 'public.default_privileges_probe', 'select')
  and not has_table_privilege('authenticated', 'public.default_privileges_probe', 'select')
  and not has_function_privilege('anon', 'public.default_privileges_probe()', 'execute')
  and not has_function_privilege('authenticated', 'public.default_privileges_probe()', 'execute'),
  'a new table or function in public grants nothing to app roles until a migration does'
);

drop function public.default_privileges_probe();
drop table public.default_privileges_probe;

select is(
  (select array_agg(p.oid::regprocedure::text)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'))),
  null,
  'app roles can execute no function in public'
);

select is(
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('supabase_auth_admin', p.oid, 'execute')),
  array['public.hook_invite_only(jsonb)'::regprocedure::text],
  'supabase_auth_admin can execute only the invite hook in public'
);

select * from finish();
rollback;
