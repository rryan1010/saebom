import type { Profile, Split } from './types.ts';

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
}

export interface SplitStep {
  minDays: number;
  split: Split;
}

export interface ProfileRow extends Prescription {
  name: 'new_with_areas' | 'areas' | 'new' | 'experienced' | 'intermediate';
  matches: (profile: Profile) => boolean;
  minDays: number;
  maxDays: number;
  /** Ordered by minDays. A plan uses the last step it reaches, and full body below the first. */
  splits: readonly SplitStep[];
}

/** Fewest days a plan can have: availability below a row's minimum drops to this at worst (§7). */
export const MIN_PLAN_DAYS = 2;

/** Light exercises ignore the row they sit in (D47). */
export const LIGHT_PRESCRIPTION: Prescription = { sets: 2, repMin: 10, repMax: 12, rir: 4 };

const flaggedAreaCount = (profile: Profile): number =>
  new Set([...profile.avoidAreas, ...profile.lightAreas]).size;

// Sets, reps and rir are defaults pending the owner's answer on issue #13.
// Order is the precedence of D15: first match wins.
export const PROFILE_ROWS: readonly ProfileRow[] = [
  {
    name: 'new_with_areas',
    matches: (p) => p.experience === 'new' && flaggedAreaCount(p) > 0,
    minDays: 2,
    maxDays: 3,
    splits: [],
    sets: 2,
    repMin: 10,
    repMax: 12,
    rir: 4,
  },
  {
    name: 'areas',
    matches: (p) => flaggedAreaCount(p) > 0,
    minDays: 2,
    maxDays: 3,
    splits: [],
    sets: 2,
    repMin: 8,
    repMax: 10,
    rir: 4,
  },
  {
    name: 'new',
    matches: (p) => p.experience === 'new',
    minDays: 2,
    maxDays: 3,
    splits: [],
    sets: 2,
    repMin: 8,
    repMax: 10,
    rir: 4,
  },
  {
    name: 'experienced',
    matches: (p) =>
      p.experience === 'experienced' ||
      (p.experience === 'intermediate' && p.goalIntensity === 'intense'),
    minDays: 4,
    maxDays: 6,
    splits: [
      { minDays: 4, split: 'upper_lower' },
      { minDays: 5, split: 'push_pull_legs' },
    ],
    sets: 3,
    repMin: 6,
    repMax: 8,
    rir: 2,
  },
  {
    // Every other profile is an intermediate lifter, so this row catches whatever is left.
    name: 'intermediate',
    matches: () => true,
    minDays: 3,
    maxDays: 4,
    splits: [{ minDays: 3, split: 'upper_lower' }],
    sets: 3,
    repMin: 6,
    repMax: 8,
    rir: 3,
  },
];

export function profileRow(profile: Profile): ProfileRow {
  const row = PROFILE_ROWS.find((candidate) => candidate.matches(profile));
  if (row === undefined) throw new Error('PROFILE_ROWS must end with a catch-all row');
  return row;
}

export function planDays(profile: Profile): number {
  return Math.max(MIN_PLAN_DAYS, Math.min(profile.daysPerWeek, profileRow(profile).maxDays));
}

export function planSplit(profile: Profile): Split {
  const days = planDays(profile);
  const reached = profileRow(profile).splits.filter((step) => step.minDays <= days);
  return reached[reached.length - 1]?.split ?? 'full_body';
}
