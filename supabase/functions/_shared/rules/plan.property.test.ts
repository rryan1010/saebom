import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CATALOG } from './catalog.fixture.ts';
import { buildPlan } from './plan.ts';
import { profileRow } from './profiles.ts';
import { SPLIT_WORKOUTS } from './templates.ts';
import { EQUIPMENT_SETUPS, EXPERIENCE, GOAL_INTENSITY, REGIONS } from './types.ts';
import type { Exercise, Plan, PlanItem, Profile, Region } from './types.ts';

const bySlug = new Map(FIXTURE_CATALOG.map((exercise) => [exercise.slug, exercise]));

const exerciseOf = (item: PlanItem): Exercise => {
  const exercise = bySlug.get(item.exerciseSlug);
  if (exercise === undefined) throw new Error(`plan names unknown exercise ${item.exerciseSlug}`);
  return exercise;
};

const loads = (exercise: Exercise, area: Region): boolean =>
  exercise.regionsGreat.includes(area) || exercise.regionsLight.includes(area);

const profileArb: fc.Arbitrary<Profile> = fc
  .record({
    experience: fc.constantFrom(...EXPERIENCE),
    goalIntensity: fc.constantFrom(...GOAL_INTENSITY),
    daysPerWeek: fc.integer({ min: 2, max: 6 }),
    equipment: fc.constantFrom(...EQUIPMENT_SETUPS),
    // Half the runs flag no area, so the uninjured rows and D48's baseline get real coverage.
    statuses: fc.oneof(
      fc.constant(REGIONS.map(() => 'none')),
      fc.array(fc.constantFrom('none', 'avoid', 'light'), {
        minLength: REGIONS.length,
        maxLength: REGIONS.length,
      }),
    ),
  })
  .map(({ statuses, ...rest }) => ({
    ...rest,
    avoidAreas: REGIONS.filter((_, i) => statuses[i] === 'avoid'),
    lightAreas: REGIONS.filter((_, i) => statuses[i] === 'light'),
  }));

const itemsByDay = (plan: Plan): PlanItem[][] => {
  const days = new Map<string, PlanItem[]>();
  for (const item of plan.items)
    days.set(item.dayLabel, [...(days.get(item.dayLabel) ?? []), item]);
  return [...days.values()];
};

const check = (property: (profile: Profile, plan: Plan) => void) =>
  fc.assert(
    fc.property(profileArb, (profile) => property(profile, buildPlan(profile, FIXTURE_CATALOG))),
    { numRuns: 500 },
  );

describe('buildPlan properties', () => {
  it('never goes above 12 reps, nor above 10 without a flagged area (D48)', () => {
    check((profile, plan) => {
      const flagged = profile.avoidAreas.length + profile.lightAreas.length > 0;
      for (const item of plan.items) {
        expect(item.repMax).toBeLessThanOrEqual(12);
        if (!flagged) expect(item.repMax).toBeLessThanOrEqual(10);
        expect(item.repMin).toBeLessThanOrEqual(item.repMax);
      }
    });
  });

  it('gives 6-8 reps to anyone past 6 months with no flagged area, and 8-10 to new lifters', () => {
    check((profile, plan) => {
      if (profile.avoidAreas.length + profile.lightAreas.length > 0) return;
      const expected = profile.experience === 'new' ? [8, 10] : [6, 8];
      for (const item of plan.items) expect([item.repMin, item.repMax]).toEqual(expected);
    });
  });

  it('keeps days and split within the row', () => {
    check((profile, plan) => {
      const row = profileRow(profile);
      expect(plan.daysPerWeek).toBeGreaterThanOrEqual(2);
      expect(plan.daysPerWeek).toBeLessThanOrEqual(Math.min(row.maxDays, profile.daysPerWeek));
      const allowed = ['full_body', ...row.splits.map((step) => step.split)];
      expect(allowed).toContain(plan.split);
      expect(itemsByDay(plan).length).toBeLessThanOrEqual(SPLIT_WORKOUTS[plan.split].length);
    });
  });

  it('gives every normal item the row prescription', () => {
    check((profile, plan) => {
      const row = profileRow(profile);
      for (const item of plan.items.filter((i) => !i.isLight)) {
        expect([item.sets, item.repMin, item.repMax, item.rir]).toEqual([
          row.sets,
          row.repMin,
          row.repMax,
          row.rir,
        ]);
      }
    });
  });

  it('shapes every light item as 2 sets of 10-12 at 4 in reserve, never a main or barbell lift', () => {
    check((profile, plan) => {
      for (const item of plan.items.filter((i) => i.isLight)) {
        const exercise = exerciseOf(item);
        expect([item.sets, item.repMin, item.repMax, item.rir]).toEqual([2, 10, 12, 4]);
        expect(exercise.isMainLift).toBe(false);
        expect(exercise.equipment).not.toContain('barbell');
        expect(profile.lightAreas.some((area) => loads(exercise, area))).toBe(true);
        expect(profile.avoidAreas.some((area) => loads(exercise, area))).toBe(false);
      }
    });
  });

  it('marks as light exactly the items that load a light area', () => {
    check((profile, plan) => {
      for (const item of plan.items) {
        const loadsLight = profile.lightAreas.some((area) => loads(exerciseOf(item), area));
        expect(item.isLight).toBe(loadsLight);
      }
    });
  });

  it('never includes an exercise that loads an avoided area, great or light (D51)', () => {
    check((profile, plan) => {
      for (const item of plan.items) {
        for (const area of profile.avoidAreas) {
          expect(loads(exerciseOf(item), area), `${item.exerciseSlug} loads ${area}`).toBe(false);
        }
      }
    });
  });

  it('never includes the deadlift for a new lifter (D52)', () => {
    check((profile, plan) => {
      if (profile.experience !== 'new') return;
      expect(plan.items.map((item) => item.exerciseSlug)).not.toContain('deadlift');
    });
  });

  it('only uses equipment the setup has', () => {
    check((profile, plan) => {
      if (profile.equipment !== 'dumbbells_only') return;
      for (const item of plan.items) {
        expect(exerciseOf(item).equipment).toEqual(['dumbbell']);
      }
    });
  });

  it('never repeats an exercise within a workout and never leaves a workout empty', () => {
    check((_profile, plan) => {
      for (const day of itemsByDay(plan)) {
        expect(day.length).toBeGreaterThan(0);
        const slugs = day.map((item) => item.exerciseSlug);
        expect(new Set(slugs).size).toBe(slugs.length);
      }
    });
  });

  it('labels workouts A.. consecutively and numbers positions 1..n', () => {
    check((_profile, plan) => {
      itemsByDay(plan).forEach((day, index) => {
        const label = String.fromCharCode(65 + index);
        expect(day.map((item) => item.dayLabel)).toEqual(day.map(() => label));
        expect(day.map((item) => item.position)).toEqual(day.map((_, at) => at + 1));
        expect(label).toMatch(/^[A-Z]$/);
      });
    });
  });

  it('is deterministic and leaves the profile untouched', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const snapshot = JSON.stringify(profile);
        expect(buildPlan(profile, FIXTURE_CATALOG)).toEqual(buildPlan(profile, FIXTURE_CATALOG));
        expect(JSON.stringify(profile)).toBe(snapshot);
      }),
    );
  });
});
