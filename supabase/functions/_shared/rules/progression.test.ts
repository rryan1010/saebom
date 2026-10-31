import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CATALOG, fixtureExercise } from './catalog.fixture.ts';
import { EFFORTS, lowerTarget, progressTarget } from './progression.ts';
import type { Effort, LoggedSet, SessionResult, Target } from './progression.ts';

const barbell = fixtureExercise('back_squat');
const dumbbell = fixtureExercise('dumbbell_curl');

const targetOf = (weightLb: number | null, overrides: Partial<Target> = {}): Target => ({
  exerciseSlug: 'back_squat',
  targetWeightLb: weightLb,
  repMin: 6,
  repMax: 8,
  rir: 2,
  belowRangeStreak: 0,
  ...overrides,
});

const sets = (weightLb: number, reps: readonly number[], effort: Effort | null = 2): LoggedSet[] =>
  reps.map((rep) => ({ weightLb, reps: rep, effort }));

const sessionOf = (
  target: Target,
  logged: readonly LoggedSet[],
  overrides: Partial<SessionResult> = {},
) =>
  progressTarget({
    target,
    exercise: barbell,
    item: { sets: 3, isLight: false },
    sets: logged,
    wentLighter: false,
    lowerTargets: false,
    ...overrides,
  });

const lightItem = { sets: 2, isLight: true };
const lightTarget = (weightLb: number, overrides: Partial<Target> = {}) =>
  targetOf(weightLb, {
    exerciseSlug: 'dumbbell_curl',
    repMin: 10,
    repMax: 12,
    rir: 2,
    ...overrides,
  });

describe('progressTarget: reaching the top', () => {
  it('adds one increment when every planned set reaches the top of the range', () => {
    const next = sessionOf(targetOf(135, { belowRangeStreak: 1 }), sets(135, [8, 8, 8]));
    expect(next.targetWeightLb).toBe(145);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('counts sets lifted above the target weight', () => {
    expect(sessionOf(targetOf(135), sets(145, [8, 9, 10])).targetWeightLb).toBe(145);
  });

  it('adds only one increment however far above the range the reps go', () => {
    expect(sessionOf(targetOf(135), sets(135, [20, 25, 30])).targetWeightLb).toBe(145);
  });

  it('keeps the rep range and RIR', () => {
    const next = sessionOf(targetOf(135, { repMin: 6, repMax: 8, rir: 3 }), sets(135, [8, 8, 8]));
    expect([next.repMin, next.repMax, next.rir, next.exerciseSlug]).toEqual([
      6,
      8,
      3,
      'back_squat',
    ]);
  });

  it('does not add an increment when fewer sets than planned were logged', () => {
    const next = sessionOf(targetOf(135), sets(135, [8, 8]));
    expect(next.targetWeightLb).toBe(135);
  });

  it('does not count sets lighter than the target weight as reaching the top', () => {
    const next = sessionOf(targetOf(135), [...sets(135, [8, 8]), ...sets(125, [8])]);
    expect(next.targetWeightLb).toBe(135);
  });

  it('does not add an increment when one set falls short of the top', () => {
    expect(sessionOf(targetOf(135), sets(135, [8, 8, 7])).targetWeightLb).toBe(135);
  });

  it('ignores effort on exercises that are not light', () => {
    const next = sessionOf(targetOf(135), sets(135, [8, 8, 8], 3));
    expect(next.targetWeightLb).toBe(145);
  });

  it('rounds onto the grid for dumbbells', () => {
    const next = sessionOf(targetOf(40, { exerciseSlug: 'dumbbell_curl' }), sets(40, [8, 8, 8]), {
      exercise: dumbbell,
    });
    expect(next.targetWeightLb).toBe(45);
  });
});

describe('progressTarget: within the range', () => {
  it('keeps the weight and resets the streak when every set is in range', () => {
    const next = sessionOf(targetOf(135, { belowRangeStreak: 1 }), sets(135, [6, 7, 8]));
    expect(next.targetWeightLb).toBe(135);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('keeps the weight when sets are in range but lighter than the target', () => {
    const next = sessionOf(targetOf(135), sets(125, [8, 8, 8]));
    expect(next.targetWeightLb).toBe(135);
    expect(next.belowRangeStreak).toBe(0);
  });
});

describe('progressTarget: below the range', () => {
  it('counts the first session below the range without changing the weight', () => {
    const next = sessionOf(targetOf(135), sets(135, [8, 8, 5]));
    expect(next.targetWeightLb).toBe(135);
    expect(next.belowRangeStreak).toBe(1);
  });

  it('drops about 10%, rounded down onto the grid, on the second session in a row', () => {
    const next = sessionOf(targetOf(135, { belowRangeStreak: 1 }), sets(135, [5, 4, 4]));
    expect(next.targetWeightLb).toBe(115);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('drops on the 5 lb grid for dumbbells', () => {
    const next = sessionOf(
      targetOf(40, { exerciseSlug: 'dumbbell_curl', belowRangeStreak: 1 }),
      sets(40, [5, 5, 5]),
      { exercise: dumbbell },
    );
    expect(next.targetWeightLb).toBe(35);
  });

  it('never drops below the minimum load', () => {
    const next = sessionOf(targetOf(45, { belowRangeStreak: 1 }), sets(45, [3, 3, 3]));
    expect(next.targetWeightLb).toBe(45);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('is interrupted by a session within the range', () => {
    const first = sessionOf(targetOf(135), sets(135, [5, 5, 5]));
    const between = sessionOf(first, sets(135, [6, 7, 7]));
    const last = sessionOf(between, sets(135, [5, 5, 5]));
    expect([first.belowRangeStreak, between.belowRangeStreak, last.belowRangeStreak]).toEqual([
      1, 0, 1,
    ]);
    expect(last.targetWeightLb).toBe(135);
  });

  it('is interrupted by a session that reaches the top', () => {
    const first = sessionOf(targetOf(135), sets(135, [5, 5, 5]));
    const top = sessionOf(first, sets(135, [8, 8, 8]));
    expect(sessionOf(top, sets(145, [5, 5, 5])).targetWeightLb).toBe(145);
  });
});

describe('progressTarget: light exercises (D47)', () => {
  const lightSession = (target: Target, logged: readonly LoggedSet[]) =>
    sessionOf(target, logged, { exercise: dumbbell, item: lightItem });

  it('goes up only when every set hit 12 reps and none was hard', () => {
    expect(lightSession(lightTarget(20), sets(20, [12, 12], 2)).targetWeightLb).toBe(25);
    expect(lightSession(lightTarget(20), sets(20, [12, 12], 1)).targetWeightLb).toBe(25);
    expect(lightSession(lightTarget(20), sets(20, [12, 12], null)).targetWeightLb).toBe(25);
  });

  it('stays put when one set was rated hard', () => {
    const logged = [...sets(20, [12], 2), ...sets(20, [12], 3)];
    const next = lightSession(lightTarget(20), logged);
    expect(next.targetWeightLb).toBe(20);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('stays put when one set stopped at 11 reps', () => {
    expect(lightSession(lightTarget(20), sets(20, [12, 11])).targetWeightLb).toBe(20);
  });

  it('needs 12 reps even when the stored target still carries an older, lower range', () => {
    const stale = lightTarget(20, { repMin: 8, repMax: 10 });
    expect(lightSession(stale, sets(20, [10, 10])).targetWeightLb).toBe(20);
    expect(lightSession(stale, sets(20, [12, 12])).targetWeightLb).toBe(25);
  });

  it('counts 9 reps as below the range even when the stored target still says 8–10', () => {
    const stale = lightTarget(20, { repMin: 8, repMax: 10, belowRangeStreak: 1 });
    expect(lightSession(stale, sets(20, [9, 9])).targetWeightLb).toBe(15);
  });

  it('calibrates for 10 reps with 4 in reserve even when the stored target says 6–8 at 2', () => {
    const uncalibrated = targetOf(null, { repMin: 6, repMax: 8, rir: 2 });
    expect(lightSession(uncalibrated, sets(30, [12, 12])).targetWeightLb).toBe(25);
  });

  it('still drops after two sessions below the range', () => {
    const next = lightSession(lightTarget(20, { belowRangeStreak: 1 }), sets(20, [9, 9]));
    expect(next.targetWeightLb).toBe(15);
  });
});

describe('progressTarget: calibration', () => {
  const calibrate = (logged: readonly LoggedSet[], overrides: Partial<Target> = {}) =>
    sessionOf(targetOf(null, overrides), logged);

  it('turns the best e1RM into a target weight rounded down onto the grid', () => {
    // 135 x 5 -> e1RM 157.5, / (1 + (6 + 2) / 30) = 124.3 -> 115
    const next = calibrate(sets(135, [5]));
    expect(next.targetWeightLb).toBe(115);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('uses the best e1RM across sets', () => {
    // 100 x 8 -> 126.7 beats 100 x 3 -> 110; 126.7 / 1.2667 = 100 -> 95
    expect(calibrate([...sets(100, [3]), ...sets(100, [8])]).targetWeightLb).toBe(95);
  });

  it('ignores sets above 12 reps while a countable set exists', () => {
    // Only 50 x 10 counts: 66.7 / 1.2667 = 52.6 -> 45
    expect(calibrate([...sets(100, [20]), ...sets(50, [10])]).targetWeightLb).toBe(45);
  });

  it('uses the heaviest weight when no set is countable', () => {
    // 60 stands in for the e1RM: 60 / 1.2667 = 47.4 -> 45 on a barbell
    expect(calibrate([...sets(60, [20]), ...sets(50, [25])]).targetWeightLb).toBe(45);
  });

  it('never goes more than one increment above the heaviest weight lifted', () => {
    // 100 x 12 with RIR 0: e1RM 140, / 1.2 = 116.7 -> 115, capped at 100 + 5
    const next = sessionOf(
      targetOf(null, { rir: 0, exerciseSlug: 'dumbbell_curl' }),
      sets(100, [12]),
      { exercise: dumbbell },
    );
    expect(next.targetWeightLb).toBe(105);
  });

  it('starts at the minimum load for a tiny lift', () => {
    expect(calibrate(sets(5, [1])).targetWeightLb).toBe(45);
  });

  it('resets the streak', () => {
    expect(calibrate(sets(135, [5]), { belowRangeStreak: 1 }).belowRangeStreak).toBe(0);
  });
});

describe('progressTarget: skipped exercise', () => {
  it('leaves the target alone when nothing was logged', () => {
    const target = targetOf(135, { belowRangeStreak: 1 });
    expect(sessionOf(target, [])).toEqual(target);
    const uncalibrated = targetOf(null);
    expect(sessionOf(uncalibrated, [])).toEqual(uncalibrated);
  });
});

describe('Go lighter today (D50)', () => {
  const lighter = (target: Target, logged: readonly LoggedSet[]) =>
    sessionOf(target, logged, { wentLighter: true });

  it('leaves the target unchanged even with every set at the top', () => {
    const target = targetOf(135, { belowRangeStreak: 1 });
    expect(lighter(target, sets(135, [8, 8, 8]))).toEqual(target);
  });

  it('leaves the target unchanged, streak included, with every set below the range', () => {
    const target = targetOf(135, { belowRangeStreak: 1 });
    expect(lighter(target, sets(115, [3, 3, 3]))).toEqual(target);
  });

  it('does not calibrate a target that is still unset', () => {
    expect(lighter(targetOf(null), sets(135, [5])).targetWeightLb).toBeNull();
  });
});

describe('Lower my targets (D50)', () => {
  it('takes one increment off and resets the streak', () => {
    const next = lowerTarget(targetOf(135, { belowRangeStreak: 1 }), barbell);
    expect(next.targetWeightLb).toBe(125);
    expect(next.belowRangeStreak).toBe(0);
  });

  it('never goes below the minimum load', () => {
    expect(lowerTarget(targetOf(45), barbell).targetWeightLb).toBe(45);
    expect(
      lowerTarget(targetOf(5, { exerciseSlug: 'dumbbell_curl' }), dumbbell).targetWeightLb,
    ).toBe(5);
  });

  it('leaves an unset weight unset', () => {
    const next = lowerTarget(targetOf(null, { belowRangeStreak: 1 }), barbell);
    expect(next.targetWeightLb).toBeNull();
    expect(next.belowRangeStreak).toBe(0);
  });

  it('wins over the logged sets and over Go lighter today', () => {
    const topSets = sets(135, [8, 8, 8]);
    expect(sessionOf(targetOf(135), topSets, { lowerTargets: true }).targetWeightLb).toBe(125);
    const both = sessionOf(targetOf(135), topSets, { lowerTargets: true, wentLighter: true });
    expect(both.targetWeightLb).toBe(125);
  });
});

describe('progressTarget properties', () => {
  const gridWeight = (exercise: (typeof FIXTURE_CATALOG)[number], k: number): number =>
    (Math.round(exercise.minLoadLb * 10) + k * Math.round(exercise.incrementLb * 10)) / 10;

  const onGrid = (weightLb: number, exercise: (typeof FIXTURE_CATALOG)[number]): boolean => {
    const tenths = weightLb * 10;
    const stepTenths = Math.round(exercise.incrementLb * 10);
    return (
      Math.abs(tenths - Math.round(tenths)) < 1e-6 &&
      (Math.round(tenths) - Math.round(exercise.minLoadLb * 10)) % stepTenths === 0
    );
  };

  const sessionArb: fc.Arbitrary<SessionResult> = fc
    .record({
      exercise: fc.constantFrom(...FIXTURE_CATALOG),
      k: fc.option(fc.integer({ min: 0, max: 80 }), { nil: null }),
      repMin: fc.integer({ min: 1, max: 12 }),
      repSpan: fc.integer({ min: 0, max: 6 }),
      rir: fc.integer({ min: 0, max: 4 }),
      belowRangeStreak: fc.integer({ min: 0, max: 5 }),
      itemSets: fc.integer({ min: 1, max: 6 }),
      isLight: fc.boolean(),
      wentLighter: fc.boolean(),
      lowerTargets: fc.boolean(),
      logged: fc.array(
        fc.record({
          pick: fc.constantFrom('random', 'target', 'above', 'below'),
          weightLb: fc.double({ min: 1, max: 1500, noNaN: true }),
          reps: fc.integer({ min: 1, max: 100 }),
          effort: fc.option(fc.constantFrom(...EFFORTS), { nil: null }),
        }),
        { maxLength: 8 },
      ),
    })
    .map((r) => {
      const weight = r.k === null ? null : gridWeight(r.exercise, r.k);
      const anchor = weight ?? 100;
      const weightOf = (pick: string, random: number): number =>
        pick === 'target'
          ? anchor
          : pick === 'above'
            ? anchor + r.exercise.incrementLb
            : pick === 'below'
              ? Math.max(1, anchor - r.exercise.incrementLb)
              : random;
      return {
        target: {
          exerciseSlug: r.exercise.slug,
          targetWeightLb: weight,
          repMin: r.repMin,
          repMax: Math.min(12, r.repMin + r.repSpan),
          rir: r.rir,
          belowRangeStreak: r.belowRangeStreak,
        },
        exercise: r.exercise,
        item: { sets: r.itemSets, isLight: r.isLight },
        sets: r.logged.map((s) => ({
          weightLb: weightOf(s.pick, s.weightLb),
          reps: s.reps,
          effort: s.effort,
        })),
        wentLighter: r.wentLighter,
        lowerTargets: r.lowerTargets,
      };
    });

  const check = (property: (result: SessionResult, next: Target) => void) =>
    fc.assert(
      fc.property(sessionArb, (result) => property(result, progressTarget(result))),
      { numRuns: 500 },
    );

  it('keeps weights on the grid, at or above the minimum load, with a non-negative streak', () => {
    check((result, next) => {
      const { targetWeightLb: before } = result.target;
      if (next.targetWeightLb === null) {
        expect(before).toBeNull();
        const calibrated = !result.lowerTargets && !result.wentLighter && result.sets.length > 0;
        expect(calibrated).toBe(false);
      } else {
        expect(next.targetWeightLb).toBeGreaterThanOrEqual(result.exercise.minLoadLb);
        expect(next.targetWeightLb).toBeGreaterThanOrEqual(0);
        expect(onGrid(next.targetWeightLb, result.exercise)).toBe(true);
      }
      expect(next.belowRangeStreak).toBeGreaterThanOrEqual(0);
    });
  });

  it('never raises a weight by more than one increment per session', () => {
    check((result, next) => {
      if (next.targetWeightLb === null) return;
      const { incrementLb, minLoadLb } = result.exercise;
      const { targetWeightLb: before } = result.target;
      const heaviest = Math.max(0, ...result.sets.map((set) => set.weightLb));
      const base = before ?? heaviest;
      expect(next.targetWeightLb).toBeLessThanOrEqual(
        Math.max(minLoadLb, base + incrementLb) + 1e-6,
      );
    });
  });

  it('leaves the rep range, RIR and slug alone', () => {
    check((result, next) => {
      expect([next.exerciseSlug, next.repMin, next.repMax, next.rir]).toEqual([
        result.target.exerciseSlug,
        result.target.repMin,
        result.target.repMax,
        result.target.rir,
      ]);
    });
  });

  it('leaves the target untouched after Go lighter today, unless targets are lowered', () => {
    check((result, next) => {
      if (result.wentLighter && !result.lowerTargets) expect(next).toEqual(result.target);
    });
  });

  it('lowers by at most one increment, never below the minimum load, and resets the streak', () => {
    check((result, next) => {
      const { targetWeightLb: before } = result.target;
      if (!result.lowerTargets || before === null) return;
      expect(next.targetWeightLb).toBeLessThanOrEqual(before);
      expect(next.targetWeightLb).toBeGreaterThanOrEqual(
        before - result.exercise.incrementLb - 1e-6,
      );
      expect(next.targetWeightLb).toBeGreaterThanOrEqual(result.exercise.minLoadLb);
      expect(next.belowRangeStreak).toBe(0);
    });
  });

  it('never raises the weight when every set was lighter than the target', () => {
    check((result, next) => {
      const { targetWeightLb: before } = result.target;
      if (before === null || next.targetWeightLb === null) return;
      if (result.sets.length === 0 || !result.sets.every((set) => set.weightLb < before)) return;
      expect(next.targetWeightLb).toBeLessThanOrEqual(before);
    });
  });

  it('raises a light exercise only after every set hit 12 reps and none was hard', () => {
    check((result, next) => {
      const { targetWeightLb: before } = result.target;
      if (!result.item.isLight || before === null || next.targetWeightLb === null) return;
      if (next.targetWeightLb <= before) return;
      expect(result.sets.length).toBeGreaterThanOrEqual(result.item.sets);
      expect(result.sets.every((set) => set.reps >= 12)).toBe(true);
      expect(result.sets.some((set) => set.effort === 3)).toBe(false);
    });
  });

  it('never drops by more than about 10% without being lowered by choice', () => {
    check((result, next) => {
      const { targetWeightLb: before } = result.target;
      if (before === null || next.targetWeightLb === null || result.lowerTargets) return;
      const floor = Math.max(result.exercise.minLoadLb, before * 0.9 - result.exercise.incrementLb);
      expect(next.targetWeightLb).toBeGreaterThanOrEqual(floor - 1e-6);
    });
  });
});
