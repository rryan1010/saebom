import { describe, expect, it } from 'vitest';
import { FIXTURE_CATALOG, fixtureExercise } from './catalog.fixture.ts';
import { buildPlan, exerciseTreatment, nextDayLabel } from './plan.ts';
import { REGIONS } from './types.ts';
import type { Plan, Profile } from './types.ts';

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  experience: 'intermediate',
  goalIntensity: 'standard',
  daysPerWeek: 3,
  equipment: 'full_gym',
  avoidAreas: [],
  lightAreas: [],
  ...overrides,
});

const slugsByDay = (plan: Plan): Record<string, string[]> => {
  const days: Record<string, string[]> = {};
  for (const item of plan.items) (days[item.dayLabel] ??= []).push(item.exerciseSlug);
  return days;
};

const lightSlugs = (plan: Plan): string[] =>
  plan.items.filter((item) => item.isLight).map((item) => item.exerciseSlug);

describe('exerciseTreatment', () => {
  it('excludes an exercise whose equipment is not in the setup', () => {
    const dumbbellsOnly = profile({ equipment: 'dumbbells_only' });
    expect(exerciseTreatment(fixtureExercise('bench_press'), dumbbellsOnly)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('leg_press'), dumbbellsOnly)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('lat_pulldown'), dumbbellsOnly)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('goblet_squat'), dumbbellsOnly)).toBe('normal');
    expect(exerciseTreatment(fixtureExercise('bench_press'), profile())).toBe('normal');
  });

  it('excludes the deadlift for new lifters only (D52)', () => {
    const deadlift = fixtureExercise('deadlift');
    expect(exerciseTreatment(deadlift, profile({ experience: 'new' }))).toBe('excluded');
    expect(exerciseTreatment(deadlift, profile({ experience: 'new', lightAreas: ['wrist'] }))).toBe(
      'excluded',
    );
    expect(exerciseTreatment(deadlift, profile({ experience: 'intermediate' }))).toBe('normal');
    expect(exerciseTreatment(deadlift, profile({ experience: 'experienced' }))).toBe('normal');
    expect(
      exerciseTreatment(fixtureExercise('romanian_deadlift'), profile({ experience: 'new' })),
    ).toBe('normal');
  });

  it('excludes an avoided area whether the exercise loads it great or light (D51)', () => {
    const avoidShoulder = profile({ avoidAreas: ['shoulder'] });
    expect(exerciseTreatment(fixtureExercise('bench_press'), avoidShoulder)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('barbell_row'), avoidShoulder)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('leg_curl'), avoidShoulder)).toBe('normal');
    const avoidLowerBack = profile({ avoidAreas: ['lower_back'] });
    expect(exerciseTreatment(fixtureExercise('deadlift'), avoidLowerBack)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('back_squat'), avoidLowerBack)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('leg_press'), avoidLowerBack)).toBe('excluded');
  });

  it('keeps a dumbbell or machine exercise light for a light area, great or light (D51)', () => {
    const lightShoulder = profile({ lightAreas: ['shoulder'] });
    expect(exerciseTreatment(fixtureExercise('dumbbell_bench_press'), lightShoulder)).toBe('light');
    expect(exerciseTreatment(fixtureExercise('lat_pulldown'), lightShoulder)).toBe('light');
    const lightLowerBack = profile({ lightAreas: ['lower_back'] });
    expect(exerciseTreatment(fixtureExercise('leg_press'), lightLowerBack)).toBe('light');
    expect(exerciseTreatment(fixtureExercise('goblet_squat'), lightLowerBack)).toBe('light');
    expect(exerciseTreatment(fixtureExercise('leg_curl'), lightLowerBack)).toBe('normal');
  });

  it('drops a main lift or barbell lift that loads a light area (D47)', () => {
    const lightShoulder = profile({ lightAreas: ['shoulder'] });
    expect(exerciseTreatment(fixtureExercise('bench_press'), lightShoulder)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('overhead_press'), lightShoulder)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('barbell_row'), lightShoulder)).toBe('excluded');
    const lightLowerBack = profile({ lightAreas: ['lower_back'] });
    expect(exerciseTreatment(fixtureExercise('back_squat'), lightLowerBack)).toBe('excluded');
    expect(exerciseTreatment(fixtureExercise('romanian_deadlift'), lightLowerBack)).toBe(
      'excluded',
    );
  });

  it('never trains around an area light: an exercise loading an avoided area stays out', () => {
    const mixed = profile({ avoidAreas: ['knee'], lightAreas: ['shoulder'] });
    expect(exerciseTreatment(fixtureExercise('dumbbell_bench_press'), mixed)).toBe('light');
    expect(exerciseTreatment(fixtureExercise('leg_curl'), mixed)).toBe('excluded');
    const both = profile({ avoidAreas: ['wrist'], lightAreas: ['wrist'] });
    expect(exerciseTreatment(fixtureExercise('dumbbell_curl'), both)).toBe('excluded');
  });
});

describe('buildPlan', () => {
  it('gives a new lifter two full-body workouts of 2 sets, 8-10 reps, 4 in reserve', () => {
    const plan = buildPlan(profile({ experience: 'new', daysPerWeek: 3 }), FIXTURE_CATALOG);
    expect(plan.split).toBe('full_body');
    expect(plan.daysPerWeek).toBe(3);
    expect(slugsByDay(plan)).toEqual({
      A: ['back_squat', 'bench_press', 'lat_pulldown', 'leg_curl', 'dumbbell_curl'],
      B: [
        'romanian_deadlift',
        'overhead_press',
        'barbell_row',
        'dumbbell_reverse_lunge',
        'triceps_pushdown',
      ],
    });
    for (const item of plan.items) {
      expect([item.sets, item.repMin, item.repMax, item.rir, item.isLight]).toEqual([
        2,
        8,
        10,
        4,
        false,
      ]);
    }
  });

  it('numbers positions from 1 within each day', () => {
    const plan = buildPlan(profile({ experience: 'new' }), FIXTURE_CATALOG);
    expect(plan.items.filter((i) => i.dayLabel === 'A').map((i) => i.position)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(plan.items.filter((i) => i.dayLabel === 'B').map((i) => i.position)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('gives an experienced lifter on 6 days push/pull/legs with the deadlift, 3 sets of 6-8', () => {
    const plan = buildPlan(profile({ experience: 'experienced', daysPerWeek: 6 }), FIXTURE_CATALOG);
    expect(plan.split).toBe('push_pull_legs');
    expect(plan.daysPerWeek).toBe(6);
    expect(slugsByDay(plan)).toEqual({
      A: ['bench_press', 'overhead_press', 'dumbbell_lateral_raise', 'triceps_pushdown'],
      B: ['lat_pulldown', 'barbell_row', 'dumbbell_curl'],
      C: ['back_squat', 'deadlift', 'dumbbell_reverse_lunge', 'leg_curl', 'dumbbell_calf_raise'],
    });
    for (const item of plan.items) {
      expect([item.sets, item.repMin, item.repMax, item.rir]).toEqual([3, 6, 8, 2]);
    }
  });

  it('gives an experienced lifter on 4 days upper/lower', () => {
    const plan = buildPlan(profile({ experience: 'experienced', daysPerWeek: 4 }), FIXTURE_CATALOG);
    expect(plan.split).toBe('upper_lower');
    expect(slugsByDay(plan)).toEqual({
      A: [
        'bench_press',
        'barbell_row',
        'overhead_press',
        'lat_pulldown',
        'dumbbell_lateral_raise',
        'dumbbell_curl',
      ],
      B: [
        'back_squat',
        'deadlift',
        'dumbbell_reverse_lunge',
        'leg_extension',
        'dumbbell_calf_raise',
      ],
    });
  });

  it('never moves a new lifter with an intense goal to the experienced row (D15)', () => {
    const plan = buildPlan(
      profile({ experience: 'new', goalIntensity: 'intense', daysPerWeek: 6 }),
      FIXTURE_CATALOG,
    );
    expect(plan.split).toBe('full_body');
    expect(plan.daysPerWeek).toBe(3);
    expect(plan.items.every((item) => item.sets === 2 && item.repMax === 10)).toBe(true);
  });

  it('fills the dumbbells-only vertical pull with a second row (D43)', () => {
    const plan = buildPlan(
      profile({ equipment: 'dumbbells_only', daysPerWeek: 3 }),
      FIXTURE_CATALOG,
    );
    expect(plan.split).toBe('upper_lower');
    expect(slugsByDay(plan)).toEqual({
      A: [
        'dumbbell_bench_press',
        'chest_supported_dumbbell_row',
        'seated_dumbbell_shoulder_press',
        'one_arm_dumbbell_row',
        'dumbbell_lateral_raise',
        'dumbbell_curl',
      ],
      B: [
        'goblet_squat',
        'dumbbell_romanian_deadlift',
        'dumbbell_reverse_lunge',
        'dumbbell_calf_raise',
      ],
    });
  });

  it('trains a light area with light exercises and drops the barbell or main lift', () => {
    const plan = buildPlan(
      profile({ experience: 'experienced', daysPerWeek: 2, lightAreas: ['shoulder'] }),
      FIXTURE_CATALOG,
    );
    expect(plan.split).toBe('full_body');
    expect(slugsByDay(plan)).toEqual({
      A: ['back_squat', 'dumbbell_bench_press', 'lat_pulldown', 'leg_curl', 'dumbbell_curl'],
      B: [
        'deadlift',
        'seated_dumbbell_shoulder_press',
        'chest_supported_dumbbell_row',
        'dumbbell_reverse_lunge',
        'triceps_pushdown',
      ],
    });
    const byslug = Object.fromEntries(plan.items.map((i) => [i.exerciseSlug, i]));
    expect(lightSlugs(plan).sort()).toEqual([
      'chest_supported_dumbbell_row',
      'dumbbell_bench_press',
      'lat_pulldown',
      'seated_dumbbell_shoulder_press',
    ]);
    expect(byslug['dumbbell_bench_press']).toMatchObject({
      sets: 2,
      repMin: 10,
      repMax: 12,
      rir: 4,
    });
    expect(byslug['back_squat']).toMatchObject({ sets: 2, repMin: 8, repMax: 10, rir: 4 });
    expect(plan.items.map((i) => i.exerciseSlug)).not.toContain('bench_press');
    expect(plan.items.map((i) => i.exerciseSlug)).not.toContain('overhead_press');
  });

  it('keeps a light lower-back exercise where the avoided version would leave the slot empty', () => {
    const light = buildPlan(
      profile({ daysPerWeek: 2, lightAreas: ['lower_back'] }),
      FIXTURE_CATALOG,
    );
    expect(slugsByDay(light)).toEqual({
      A: ['leg_press', 'bench_press', 'lat_pulldown', 'leg_curl', 'dumbbell_curl'],
      B: [
        'dumbbell_romanian_deadlift',
        'seated_dumbbell_shoulder_press',
        'chest_supported_dumbbell_row',
        'dumbbell_reverse_lunge',
        'triceps_pushdown',
      ],
    });
    expect(lightSlugs(light)).toEqual(['leg_press', 'dumbbell_romanian_deadlift']);

    const avoided = buildPlan(
      profile({ daysPerWeek: 2, avoidAreas: ['lower_back'] }),
      FIXTURE_CATALOG,
    );
    expect(slugsByDay(avoided)).toEqual({
      A: ['bench_press', 'lat_pulldown', 'leg_curl', 'dumbbell_curl'],
      B: [
        'seated_dumbbell_shoulder_press',
        'chest_supported_dumbbell_row',
        'dumbbell_reverse_lunge',
        'triceps_pushdown',
      ],
    });
    expect(lightSlugs(avoided)).toEqual([]);
  });

  it('skips the slots an avoided area empties and keeps the plan valid', () => {
    const plan = buildPlan(profile({ avoidAreas: ['shoulder'] }), FIXTURE_CATALOG);
    expect(plan.split).toBe('full_body');
    expect(slugsByDay(plan)).toEqual({
      A: ['back_squat', 'leg_curl', 'dumbbell_curl'],
      B: ['deadlift', 'dumbbell_reverse_lunge', 'triceps_pushdown'],
    });
    expect(plan.items.map((i) => i.position)).toEqual([1, 2, 3, 1, 2, 3]);
    for (const item of plan.items) {
      expect([item.sets, item.repMin, item.repMax, item.rir]).toEqual([2, 8, 10, 4]);
    }
  });

  it('uses 10-12 reps for a new lifter with an area to avoid', () => {
    const plan = buildPlan(
      profile({ experience: 'new', avoidAreas: ['shoulder'] }),
      FIXTURE_CATALOG,
    );
    expect(plan.items.length).toBeGreaterThan(0);
    for (const item of plan.items) {
      expect([item.sets, item.repMin, item.repMax, item.rir]).toEqual([2, 10, 12, 4]);
    }
  });

  it('returns an empty plan, not an error, when every area is avoided', () => {
    const plan = buildPlan(profile({ avoidAreas: [...REGIONS] }), FIXTURE_CATALOG);
    expect(plan.items).toEqual([]);
    expect(nextDayLabel(plan, null)).toBeNull();
    expect(nextDayLabel(plan, 'A')).toBeNull();
  });

  it('drops a workout with no exercises and relabels the rest from A', () => {
    const catalog = [
      fixtureExercise('romanian_deadlift'),
      fixtureExercise('dumbbell_reverse_lunge'),
    ];
    const plan = buildPlan(profile({ experience: 'new' }), catalog);
    expect(slugsByDay(plan)).toEqual({ A: ['romanian_deadlift', 'dumbbell_reverse_lunge'] });
    expect(plan.items.map((item) => item.position)).toEqual([1, 2]);
    expect(nextDayLabel(plan, 'A')).toBe('A');
  });

  it('does not mutate the catalog', () => {
    const before = FIXTURE_CATALOG.map((e) => e.slug);
    buildPlan(profile({ experience: 'experienced', daysPerWeek: 6 }), FIXTURE_CATALOG);
    expect(FIXTURE_CATALOG.map((e) => e.slug)).toEqual(before);
  });
});

describe('nextDayLabel', () => {
  const plan = buildPlan(profile({ experience: 'experienced', daysPerWeek: 6 }), FIXTURE_CATALOG);

  it('starts at the first label when nothing is recorded', () => {
    expect(nextDayLabel(plan, null)).toBe('A');
  });

  it('moves to the next label and wraps after the last', () => {
    expect(nextDayLabel(plan, 'A')).toBe('B');
    expect(nextDayLabel(plan, 'B')).toBe('C');
    expect(nextDayLabel(plan, 'C')).toBe('A');
  });

  it('starts over when the last label is not in the plan', () => {
    expect(nextDayLabel(plan, 'D')).toBe('A');
    expect(nextDayLabel(plan, 'Z')).toBe('A');
  });

  it('alternates A and B for full body', () => {
    const fullBody = buildPlan(profile({ experience: 'new' }), FIXTURE_CATALOG);
    expect(nextDayLabel(fullBody, 'A')).toBe('B');
    expect(nextDayLabel(fullBody, 'B')).toBe('A');
  });
});
