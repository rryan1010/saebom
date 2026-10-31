import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CATALOG } from './catalog.fixture.ts';
import { buildPlan } from './plan.ts';
import { profileRow } from './profiles.ts';
import { EFFORTS, progressTarget } from './progression.ts';
import type { LoggedSet, Target } from './progression.ts';
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

type AreaStatus = 'none' | 'avoid' | 'light';

const STATUSES: readonly AreaStatus[] = ['none', 'avoid', 'light'];

const withStatuses = (profile: Profile, statuses: readonly AreaStatus[]): Profile => ({
  ...profile,
  avoidAreas: REGIONS.filter((_, i) => statuses[i] === 'avoid'),
  lightAreas: REGIONS.filter((_, i) => statuses[i] === 'light'),
});

const statusesArb: fc.Arbitrary<AreaStatus[]> = fc.array(fc.constantFrom(...STATUSES), {
  minLength: REGIONS.length,
  maxLength: REGIONS.length,
});

const profileArb: fc.Arbitrary<Profile> = fc
  .record({
    experience: fc.constantFrom(...EXPERIENCE),
    goalIntensity: fc.constantFrom(...GOAL_INTENSITY),
    daysPerWeek: fc.integer({ min: 2, max: 6 }),
    equipment: fc.constantFrom(...EQUIPMENT_SETUPS),
    // Half the runs flag no area, so the uninjured rows and D48's baseline get real coverage.
    statuses: fc.oneof(fc.constant<AreaStatus[]>(REGIONS.map(() => 'none')), statusesArb),
  })
  .map(({ statuses, ...rest }) =>
    withStatuses({ ...rest, avoidAreas: [], lightAreas: [] }, statuses),
  );

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

describe('changing injured areas and choices', () => {
  it('never loads an area now being trained around, whatever it was before (D46, D51)', () => {
    fc.assert(
      fc.property(profileArb, statusesArb, (profile, statuses) => {
        const changed = withStatuses(profile, statuses);
        for (const item of buildPlan(changed, FIXTURE_CATALOG).items) {
          for (const area of changed.avoidAreas) {
            expect(loads(exerciseOf(item), area), `${item.exerciseSlug} loads ${area}`).toBe(false);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it('drops every exercise that loads an area moved from light to avoid', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const moved: Profile = {
          ...profile,
          avoidAreas: [...new Set([...profile.avoidAreas, ...profile.lightAreas])],
          lightAreas: [],
        };
        const plan = buildPlan(moved, FIXTURE_CATALOG);
        for (const item of plan.items) {
          expect(item.isLight).toBe(false);
          for (const area of profile.lightAreas) {
            expect(loads(exerciseOf(item), area), `${item.exerciseSlug} loads ${area}`).toBe(false);
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe('readiness answers (D49)', () => {
  const answersArb = fc.record({
    heart: fc.boolean(),
    lung: fc.boolean(),
    joint: fc.boolean(),
    chestPain: fc.boolean(),
    dizziness: fc.boolean(),
    recentInjury: fc.boolean(),
    pregnant: fc.boolean(),
  });

  it('builds the same plan whatever the tester answered or acknowledged', () => {
    fc.assert(
      fc.property(profileArb, answersArb, fc.boolean(), (profile, answers, acknowledged) => {
        const withReadiness = {
          ...profile,
          readinessAnswers: answers,
          readinessAckAt: acknowledged ? '2026-10-30T12:00:00Z' : null,
          lightAckAt: acknowledged ? '2026-10-30T12:00:00Z' : null,
        } as Profile;
        expect(buildPlan(withReadiness, FIXTURE_CATALOG)).toEqual(
          buildPlan(profile, FIXTURE_CATALOG),
        );
      }),
      { numRuns: 300 },
    );
  });

  it('always builds a plan for a tester who avoids no area', () => {
    check((profile, plan) => {
      if (profile.avoidAreas.length > 0) return;
      expect(plan.items.length).toBeGreaterThan(0);
    });
  });
});

describe('weights from profile to progression', () => {
  const onGrid = (weightLb: number, exercise: Exercise): boolean => {
    const tenths = weightLb * 10;
    const stepTenths = Math.round(exercise.incrementLb * 10);
    return (
      Math.abs(tenths - Math.round(tenths)) < 1e-6 &&
      (Math.round(tenths) - Math.round(exercise.minLoadLb * 10)) % stepTenths === 0
    );
  };

  const setArb = fc.record({
    pick: fc.constantFrom('random', 'target', 'above', 'below'),
    weightLb: fc.double({ min: 1, max: 1500, noNaN: true }),
    reps: fc.integer({ min: 1, max: 30 }),
    effort: fc.option(fc.constantFrom(...EFFORTS), { nil: null }),
  });

  const sessionArb = fc.record({
    sets: fc.array(setArb, { maxLength: 6 }),
    wentLighter: fc.integer({ min: 0, max: 5 }).map((n) => n === 0),
    lowerTargets: fc.integer({ min: 0, max: 5 }).map((n) => n === 0),
  });

  const calibrationArb = fc.record({
    sets: fc.array(setArb, { minLength: 1, maxLength: 6 }),
    wentLighter: fc.constant(false),
    lowerTargets: fc.constant(false),
  });

  it('keeps every target on the exercise load grid, never negative, rising by at most one step', () => {
    fc.assert(
      fc.property(
        profileArb,
        calibrationArb,
        fc.array(sessionArb, { minLength: 1, maxLength: 6 }),
        (profile, calibration, later) => {
          for (const item of buildPlan(profile, FIXTURE_CATALOG).items) {
            const exercise = exerciseOf(item);
            let target: Target = {
              exerciseSlug: item.exerciseSlug,
              targetWeightLb: null,
              repMin: item.repMin,
              repMax: item.repMax,
              rir: item.rir,
              belowRangeStreak: 0,
            };
            const chain = [calibration, ...later];
            for (const session of chain) {
              const before = target.targetWeightLb;
              const anchor = before ?? 100;
              const logged: LoggedSet[] = session.sets.map((set) => ({
                weightLb:
                  set.pick === 'target'
                    ? anchor
                    : set.pick === 'above'
                      ? anchor + exercise.incrementLb
                      : set.pick === 'below'
                        ? Math.max(1, anchor - exercise.incrementLb)
                        : set.weightLb,
                reps: set.reps,
                effort: set.effort,
              }));
              target = progressTarget({
                target,
                exercise,
                item,
                sets: logged,
                wentLighter: session.wentLighter,
                lowerTargets: session.lowerTargets,
              });
              const after = target.targetWeightLb;
              if (after === null) {
                expect(before, `${item.exerciseSlug} lost its weight`).toBeNull();
                continue;
              }
              const label = `${item.exerciseSlug} ${before} -> ${after}`;
              expect(after, label).toBeGreaterThanOrEqual(0);
              expect(after, label).toBeGreaterThanOrEqual(exercise.minLoadLb);
              expect(onGrid(after, exercise), label).toBe(true);
              const heaviest = Math.max(0, ...logged.map((set) => set.weightLb));
              const ceiling = Math.max(
                exercise.minLoadLb,
                (before ?? heaviest) + exercise.incrementLb,
              );
              expect(after, label).toBeLessThanOrEqual(ceiling + 1e-6);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});
