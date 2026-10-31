import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { lighterWeekAllowed, lighterWeekDue, lighterWeekSets } from './lighter-weeks.ts';

const MONDAY = '2026-01-05';

const addDays = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
};

const daysBetween = (a: string, b: string): number =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

describe('lighterWeekAllowed', () => {
  it('allows a first lighter week', () => {
    expect(lighterWeekAllowed('2026-03-02', [])).toBe(true);
  });

  it('refuses a week 27 days after an earlier one and allows 28', () => {
    expect(lighterWeekAllowed(addDays(MONDAY, 27), [MONDAY])).toBe(false);
    expect(lighterWeekAllowed(addDays(MONDAY, 28), [MONDAY])).toBe(true);
  });

  it('refuses a week 27 days before a later one and allows 28', () => {
    expect(lighterWeekAllowed(addDays(MONDAY, -27), [MONDAY])).toBe(false);
    expect(lighterWeekAllowed(addDays(MONDAY, -28), [MONDAY])).toBe(true);
  });

  it('refuses the same week', () => {
    expect(lighterWeekAllowed(MONDAY, [MONDAY])).toBe(false);
  });

  it('checks every existing lighter week', () => {
    const starts = ['2025-10-06', addDays(MONDAY, 21), '2025-06-02'];
    expect(lighterWeekAllowed(MONDAY, starts)).toBe(false);
  });

  it('counts days across month, year and leap-day boundaries', () => {
    expect(lighterWeekAllowed('2027-01-04', ['2026-12-07'])).toBe(true);
    expect(lighterWeekAllowed('2027-01-04', ['2026-12-08'])).toBe(false);
    expect(lighterWeekAllowed('2028-02-28', ['2028-01-31'])).toBe(true);
    expect(lighterWeekAllowed('2028-02-28', ['2028-02-01'])).toBe(false);
    expect(lighterWeekAllowed('2028-03-01', ['2028-02-02'])).toBe(true);
    expect(lighterWeekAllowed('2028-03-01', ['2028-02-03'])).toBe(false);
  });

  it('rejects a malformed date instead of allowing the week', () => {
    expect(() => lighterWeekAllowed(MONDAY, ['soon'])).toThrow(RangeError);
  });

  it('rejects a date that does not exist instead of rolling it over', () => {
    expect(() => lighterWeekAllowed(MONDAY, ['2026-02-30'])).toThrow(RangeError);
    expect(() => lighterWeekAllowed('2026-99-99', [])).toThrow(RangeError);
    expect(lighterWeekAllowed('2028-02-29', [])).toBe(true);
  });
});

describe('lighterWeekDue', () => {
  const slugs = ['back_squat', 'bench_press', 'barbell_row', 'overhead_press'];
  const stale = addDays(MONDAY, -22);
  const fresh = addDays(MONDAY, -3);
  const due = (
    lastRecordOn: Record<string, string | null>,
    overrides: Partial<Parameters<typeof lighterWeekDue>[0]> = {},
  ) =>
    lighterWeekDue({
      weekStart: MONDAY,
      planExerciseSlugs: slugs,
      lastRecordOn,
      lighterWeekStarts: [],
      ...overrides,
    });

  it('is due when half of the exercises have gone stale', () => {
    expect(
      due({ back_squat: stale, bench_press: stale, barbell_row: fresh, overhead_press: fresh }),
    ).toBe(true);
  });

  it('is not due when fewer than half have gone stale', () => {
    expect(
      due({ back_squat: stale, bench_press: fresh, barbell_row: fresh, overhead_press: fresh }),
    ).toBe(false);
  });

  it('is due when every exercise has gone stale', () => {
    expect(due(Object.fromEntries(slugs.map((slug) => [slug, stale])))).toBe(true);
  });

  it('treats a record exactly 21 days old as recent and 22 days as stale', () => {
    const edge = (days: number) =>
      due(Object.fromEntries(slugs.map((slug) => [slug, addDays(MONDAY, -days)])));
    expect(edge(21)).toBe(false);
    expect(edge(22)).toBe(true);
  });

  it('does not count exercises that were never logged as stale, but keeps them in the plan', () => {
    expect(due({ back_squat: stale, bench_press: null })).toBe(false);
    expect(due({ back_squat: stale, bench_press: stale, barbell_row: null })).toBe(true);
    expect(due({})).toBe(false);
  });

  it('counts a duplicated slug once', () => {
    const input = {
      planExerciseSlugs: ['back_squat', 'bench_press', 'bench_press', 'bench_press'],
    };
    expect(due({ back_squat: stale, bench_press: fresh }, input)).toBe(true);
    expect(due({ back_squat: fresh, bench_press: stale }, input)).toBe(true);
    expect(due({ back_squat: fresh, bench_press: fresh }, input)).toBe(false);
  });

  it('is never due for an empty plan', () => {
    expect(due({}, { planExerciseSlugs: [] })).toBe(false);
  });

  it('is not due when a record is dated after the week starts', () => {
    const later = addDays(MONDAY, 2);
    expect(due(Object.fromEntries(slugs.map((slug) => [slug, later])))).toBe(false);
  });

  it('is not due when a lighter week started fewer than 28 days away, on either side', () => {
    const allStale = Object.fromEntries(slugs.map((slug) => [slug, stale]));
    expect(due(allStale, { lighterWeekStarts: [addDays(MONDAY, -27)] })).toBe(false);
    expect(due(allStale, { lighterWeekStarts: [addDays(MONDAY, 27)] })).toBe(false);
    expect(due(allStale, { lighterWeekStarts: [addDays(MONDAY, -28)] })).toBe(true);
    expect(due(allStale, { lighterWeekStarts: [addDays(MONDAY, 28)] })).toBe(true);
  });
});

describe('lighterWeekSets', () => {
  it('halves the sets, rounded down, and keeps at least one', () => {
    expect([1, 2, 3, 4, 5].map((sets) => lighterWeekSets(sets))).toEqual([1, 1, 1, 2, 2]);
  });
});

describe('lighter weeks properties', () => {
  const slugs = ['a', 'b', 'c', 'd', 'e', 'f'];

  const scenarioArb = fc.record({
    weekIndexes: fc.uniqueArray(fc.integer({ min: 0, max: 40 }), { minLength: 1, maxLength: 40 }),
    planSize: fc.integer({ min: 0, max: slugs.length }),
    coachWeeks: fc.array(fc.integer({ min: 0, max: 40 }), { maxLength: 4 }),
    // Offsets are in days before each Monday; null is a never-logged exercise.
    recordAges: fc.array(
      fc.array(fc.option(fc.integer({ min: 0, max: 60 }), { nil: null }), {
        minLength: slugs.length,
        maxLength: slugs.length,
      }),
      { minLength: 41, maxLength: 41 },
    ),
  });

  it('never schedules two lighter weeks fewer than 28 days apart, the coach included', () => {
    fc.assert(
      fc.property(scenarioArb, ({ weekIndexes, planSize, coachWeeks, recordAges }) => {
        const starts = coachWeeks.map((week) => addDays(MONDAY, week * 7));
        for (const week of [...weekIndexes].sort((a, b) => a - b)) {
          const weekStart = addDays(MONDAY, week * 7);
          const lastRecordOn: Record<string, string | null> = {};
          slugs.forEach((slug, i) => {
            const age = recordAges[week]?.[i] ?? null;
            lastRecordOn[slug] = age === null ? null : addDays(weekStart, -age);
          });
          const isDue = lighterWeekDue({
            weekStart,
            planExerciseSlugs: slugs.slice(0, planSize),
            lastRecordOn,
            lighterWeekStarts: starts,
          });
          if (!isDue) continue;
          for (const other of starts) {
            expect(daysBetween(weekStart, other)).toBeGreaterThanOrEqual(28);
          }
          starts.push(weekStart);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('halves the sets without ever reaching zero or growing', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (sets) => {
        const lighter = lighterWeekSets(sets);
        expect(lighter).toBeGreaterThanOrEqual(1);
        expect(lighter).toBeLessThanOrEqual(sets);
        expect(lighter * 2).toBeLessThanOrEqual(Math.max(2, sets));
      }),
      { numRuns: 500 },
    );
  });
});
