import type { Exercise } from './types.ts';

type LoadGrid = Pick<Exercise, 'minLoadLb' | 'incrementLb'>;

const TENTHS = 10;
// Absorbs float error so a weight that is on the grid in decimal never rounds down off it.
const FLOAT_SLACK = 1e-9;

/** Epley, as in the `e1rm_by_week` view: null above 12 reps, a single rep counts as its weight. */
export function estimateE1rmLb(weightLb: number, reps: number): number | null {
  if (reps < 1 || reps > 12) return null;
  if (reps === 1) return weightLb;
  return Math.round(weightLb * (1 + reps / 30) * TENTHS) / TENTHS;
}

/**
 * Loads sit on the grid `minLoadLb + k × incrementLb`, so a 45 lb bar with 10 lb steps loads 45, 55,
 * 65. Rounds down onto it and never goes below the minimum.
 */
export function roundDownToLoad(weightLb: number, exercise: LoadGrid): number {
  const minTenths = Math.round(exercise.minLoadLb * TENTHS);
  const stepTenths = Math.round(exercise.incrementLb * TENTHS);
  const weightTenths = Math.floor(weightLb * TENTHS + FLOAT_SLACK);
  if (!(weightTenths > minTenths)) return minTenths / TENTHS;
  const steps = Math.floor((weightTenths - minTenths) / stepTenths);
  return (minTenths + steps * stepTenths) / TENTHS;
}

/** `w = e1RM / (1 + (r + k) / 30)` with r the bottom of the rep range, rounded down onto the loads. */
export function targetWeightLb(
  e1rmLb: number,
  repMin: number,
  rir: number,
  exercise: LoadGrid,
): number {
  return roundDownToLoad(e1rmLb / (1 + (repMin + rir) / 30), exercise);
}
