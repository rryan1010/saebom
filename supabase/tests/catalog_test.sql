begin;
select plan(5);

select is((select count(*) from public.exercises), 25::bigint,
  'the seed loads the 25 exercises of D54');

select is(
  (select array_agg(slug order by slug) from public.exercises where is_main_lift),
  array['back_squat', 'bench_press', 'deadlift', 'overhead_press'],
  'the main lifts are the four of D41'
);

select is(
  (select array_agg(e.slug || ' -> ' || s.swap order by e.slug, s.swap)
   from public.exercises e
   cross join lateral unnest(e.allowed_swaps) as s (swap)
   left join public.exercises t on t.slug = s.swap
   where t.slug is null or t.movement_pattern <> e.movement_pattern or t.is_main_lift),
  null,
  'every swap names an existing exercise of the same pattern that is not a main lift (D44)'
);

select is(
  (select array_agg(slug order by slug) from public.exercises
   where movement_pattern <> 'accessory' and cardinality(allowed_swaps) = 0),
  null,
  'every compound lift has a swap (D54)'
);

select is(
  (select array_agg(slug order by slug) from public.exercises
   where ('barbell' = any (equipment) and (min_load_lb <> 45 or increment_lb not in (5, 10)))
      or (not 'barbell' = any (equipment) and (min_load_lb <> 5 or increment_lb <> 5))),
  null,
  'steps and minimum loads follow D53'
);

select * from finish();
rollback;
