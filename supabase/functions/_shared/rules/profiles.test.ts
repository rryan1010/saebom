import { describe, expect, it } from 'vitest';
import { PROFILE_ROWS, planDays, planSplit, profileRow } from './profiles.ts';
import type { Profile } from './types.ts';

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  experience: 'intermediate',
  goalIntensity: 'standard',
  daysPerWeek: 3,
  equipment: 'full_gym',
  avoidAreas: [],
  lightAreas: [],
  ...overrides,
});

describe('profileRow precedence (D15)', () => {
  const cases: [string, Partial<Profile>, string][] = [
    ['new with an area to avoid', { experience: 'new', avoidAreas: ['knee'] }, 'new_with_areas'],
    ['new with a light area', { experience: 'new', lightAreas: ['wrist'] }, 'new_with_areas'],
    [
      'new with an intense goal and an area',
      { experience: 'new', goalIntensity: 'intense', avoidAreas: ['hip'] },
      'new_with_areas',
    ],
    ['intermediate with an area', { avoidAreas: ['shoulder'] }, 'areas'],
    [
      'experienced with an intense goal and a light area',
      { experience: 'experienced', goalIntensity: 'intense', lightAreas: ['elbow'] },
      'areas',
    ],
    ['new', { experience: 'new' }, 'new'],
    ['new with an intense goal', { experience: 'new', goalIntensity: 'intense' }, 'new'],
    ['experienced', { experience: 'experienced' }, 'experienced'],
    [
      'intermediate with an intense goal',
      { experience: 'intermediate', goalIntensity: 'intense' },
      'experienced',
    ],
    ['intermediate', { experience: 'intermediate' }, 'intermediate'],
  ];

  it.each(cases)('%s', (_name, overrides, expected) => {
    expect(profileRow(profile(overrides)).name).toBe(expected);
  });

  it('lists the rows in precedence order', () => {
    expect(PROFILE_ROWS.map((row) => row.name)).toEqual([
      'new_with_areas',
      'areas',
      'new',
      'experienced',
      'intermediate',
    ]);
  });
});

describe('rep ranges (D36, D48)', () => {
  const reps = (overrides: Partial<Profile>) => {
    const row = profileRow(profile(overrides));
    return [row.repMin, row.repMax];
  };

  it('is 6-8 for anyone with 6 months or more and no injured area', () => {
    expect(reps({ experience: 'intermediate' })).toEqual([6, 8]);
    expect(reps({ experience: 'experienced' })).toEqual([6, 8]);
    expect(reps({ experience: 'intermediate', goalIntensity: 'intense' })).toEqual([6, 8]);
  });

  it('is 8-10 for a new lifter with no injured area', () => {
    expect(reps({ experience: 'new' })).toEqual([8, 10]);
    expect(reps({ experience: 'new', goalIntensity: 'intense' })).toEqual([8, 10]);
  });

  it('is 8-10 with an injured area and 10-12 for a new lifter with one', () => {
    expect(reps({ experience: 'experienced', avoidAreas: ['neck'] })).toEqual([8, 10]);
    expect(reps({ experience: 'new', avoidAreas: ['neck'] })).toEqual([10, 12]);
  });

  it('never goes above 12, nor above 10 without an injured area', () => {
    for (const row of PROFILE_ROWS) expect(row.repMax).toBeLessThanOrEqual(12);
    for (const row of PROFILE_ROWS.filter((r) => r.name !== 'new_with_areas')) {
      expect(row.repMax).toBeLessThanOrEqual(10);
    }
  });
});

describe('sets and reps in reserve', () => {
  it('gives the injured-area and new rows 2 sets with 4 in reserve', () => {
    for (const name of ['new_with_areas', 'areas', 'new']) {
      const row = PROFILE_ROWS.find((r) => r.name === name);
      expect([row?.sets, row?.rir]).toEqual([2, 4]);
    }
  });

  it('gives the experienced row 3 sets with 2 in reserve and intermediate 3 with 3', () => {
    const experienced = PROFILE_ROWS.find((r) => r.name === 'experienced');
    const intermediate = PROFILE_ROWS.find((r) => r.name === 'intermediate');
    expect([experienced?.sets, experienced?.rir]).toEqual([3, 2]);
    expect([intermediate?.sets, intermediate?.rir]).toEqual([3, 3]);
  });
});

describe('planDays and planSplit', () => {
  const daysAndSplit = (overrides: Partial<Profile>) => {
    const p = profile(overrides);
    return [planDays(p), planSplit(p)];
  };

  it('caps the days at the row maximum', () => {
    expect(daysAndSplit({ experience: 'new', daysPerWeek: 6 })).toEqual([3, 'full_body']);
    expect(daysAndSplit({ experience: 'intermediate', daysPerWeek: 6 })).toEqual([
      4,
      'upper_lower',
    ]);
    expect(daysAndSplit({ experience: 'experienced', daysPerWeek: 6 })).toEqual([
      6,
      'push_pull_legs',
    ]);
    expect(daysAndSplit({ avoidAreas: ['knee'], daysPerWeek: 5 })).toEqual([3, 'full_body']);
  });

  it('picks the last split the days reach for the experienced row', () => {
    expect(daysAndSplit({ experience: 'experienced', daysPerWeek: 4 })).toEqual([4, 'upper_lower']);
    expect(daysAndSplit({ experience: 'experienced', daysPerWeek: 5 })).toEqual([
      5,
      'push_pull_legs',
    ]);
  });

  it('uses full body below the row minimum, down to 2 days', () => {
    expect(daysAndSplit({ experience: 'experienced', daysPerWeek: 3 })).toEqual([3, 'full_body']);
    expect(daysAndSplit({ experience: 'experienced', daysPerWeek: 2 })).toEqual([2, 'full_body']);
    expect(daysAndSplit({ experience: 'intermediate', daysPerWeek: 2 })).toEqual([2, 'full_body']);
  });

  it('uses upper/lower for intermediate lifters from 3 days', () => {
    expect(daysAndSplit({ experience: 'intermediate', daysPerWeek: 3 })).toEqual([
      3,
      'upper_lower',
    ]);
  });
});
