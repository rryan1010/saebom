import type { Exercise, PlanItem } from './types.ts';
import { estimateE1rmLb, roundDownToLoad, targetWeightLb } from './weight.ts';

/** `set_logs.effort`: 1 easy, 2 OK, 3 hard. */
export const EFFORTS = [1, 2, 3] as const;
export type Effort = (typeof EFFORTS)[number];
export const HARD_EFFORT: Effort = 3;

/** Falling short of the range this many sessions in a row drops the weight. */
export const BELOW_RANGE_SESSIONS_TO_DROP = 2;
const DROP_FRACTION = 0.9;

type LoadGrid = Pick<Exercise, 'minLoadLb' | 'incrementLb'>;

/** One `set_logs` row for one exercise in one session, minus ids. */
export interface LoggedSet {
  weightLb: number;
  reps: number;
  effort: Effort | null;
}

/** Mirror of a `next_targets` row, minus `user_id`. The weight is null until the calibration pass. */
export interface Target {
  exerciseSlug: string;
  targetWeightLb: number | null;
  repMin: number;
  repMax: number;
  rir: number;
  belowRangeStreak: number;
}

export interface SessionResult {
  target: Target;
  exercise: LoadGrid;
  /** The plan item this session followed. */
  item: Pick<PlanItem, 'sets' | 'isLight'>;
  /** This exercise's logged sets for the session. */
  sets: readonly LoggedSet[];
  /** The session started with "Go lighter today" (D50). */
  wentLighter: boolean;
  /** The tester picked this exercise under "Lower my targets" (D50). */
  lowerTargets: boolean;
}

type Outcome = 'top' | 'within' | 'below';

function classifySession(
  weightLb: number,
  target: Target,
  item: SessionResult['item'],
  sets: readonly LoggedSet[],
): Outcome {
  const reachesTop = (set: LoggedSet): boolean =>
    set.weightLb >= weightLb && set.reps >= target.repMax;
  // A light exercise (D47) also needs no hard set; its repMax of 12 covers "every set hit 12 reps".
  const isTop =
    sets.length >= item.sets &&
    sets.every(reachesTop) &&
    (!item.isLight || sets.every((set) => set.effort !== HARD_EFFORT));
  if (isTop) return 'top';
  // Default pending the owner's answer (#TBD): one set under repMin puts the whole session below the range.
  if (sets.some((set) => set.reps < target.repMin)) return 'below';
  return 'within';
}

function calibratedWeight(target: Target, exercise: LoadGrid, sets: readonly LoggedSet[]): number {
  const heaviest = Math.max(...sets.map((set) => set.weightLb));
  const e1rms = sets.flatMap((set) => {
    const e1rm = estimateE1rmLb(set.weightLb, set.reps);
    return e1rm === null ? [] : [e1rm];
  });
  const e1rm = e1rms.length > 0 ? Math.max(...e1rms) : heaviest;
  const raw = targetWeightLb(e1rm, target.repMin, target.rir, exercise);
  return roundDownToLoad(Math.min(raw, heaviest + exercise.incrementLb), exercise);
}

/** "Lower my targets" (D50): one increment off, never below the minimum load, streak reset. */
export function lowerTarget(target: Target, exercise: LoadGrid): Target {
  const { targetWeightLb: weightLb } = target;
  return {
    ...target,
    targetWeightLb:
      weightLb === null ? null : roundDownToLoad(weightLb - exercise.incrementLb, exercise),
    belowRangeStreak: 0,
  };
}

/** The target for this exercise's next session, from what was logged in this one. */
export function progressTarget(result: SessionResult): Target {
  const { target, exercise, item, sets, wentLighter, lowerTargets } = result;
  if (lowerTargets) return lowerTarget(target, exercise);
  if (wentLighter || sets.length === 0) return target;

  const weightLb = target.targetWeightLb;
  if (weightLb === null) {
    return {
      ...target,
      targetWeightLb: calibratedWeight(target, exercise, sets),
      belowRangeStreak: 0,
    };
  }

  switch (classifySession(weightLb, target, item, sets)) {
    case 'top':
      return {
        ...target,
        targetWeightLb: roundDownToLoad(weightLb + exercise.incrementLb, exercise),
        belowRangeStreak: 0,
      };
    case 'within':
      return { ...target, belowRangeStreak: 0 };
    case 'below': {
      const streak = target.belowRangeStreak + 1;
      if (streak < BELOW_RANGE_SESSIONS_TO_DROP) return { ...target, belowRangeStreak: streak };
      return {
        ...target,
        targetWeightLb: roundDownToLoad(weightLb * DROP_FRACTION, exercise),
        belowRangeStreak: 0,
      };
    }
  }
}
