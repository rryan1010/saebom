begin;
select plan(9);

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

select is(
  (select array_agg(distinct table_name::text order by table_name::text)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  null,
  'anon has no privileges on any public table or view'
);

select is(
  (select array_agg(table_name || ':' || privilege_type order by table_name, privilege_type)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'),
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
  (select array_agg(distinct table_name::text order by table_name::text)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name in ('invites', 'ai_usage')),
  null,
  'authenticated has nothing on invites or ai_usage'
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

select * from finish();
rollback;
