import type { MovementPattern, MuscleGroup, Split } from './types.ts';

export interface SlotOption {
  pattern: MovementPattern;
  /** Only for accessories: the exercise's great muscle group. */
  muscle?: MuscleGroup;
  /** Slugs tried first, in order. With none available the first candidate by slug is used. */
  prefer: readonly string[];
}

/** Tried in order; the first option that yields an exercise fills the slot. */
export type Slot = readonly SlotOption[];
export type Workout = readonly Slot[];

type CompoundPattern = Exclude<MovementPattern, 'accessory'>;

const PREFER: Record<CompoundPattern, readonly string[]> = {
  squat: ['back_squat', 'leg_press'],
  hinge: ['deadlift', 'romanian_deadlift'],
  lunge: [],
  horizontal_push: ['bench_press'],
  vertical_push: ['overhead_press', 'seated_dumbbell_shoulder_press', 'machine_shoulder_press'],
  horizontal_pull: [],
  vertical_pull: ['lat_pulldown', 'single_arm_cable_pulldown'],
};

const compound = (pattern: CompoundPattern): Slot => [{ pattern, prefer: PREFER[pattern] }];

const accessory = (muscle: MuscleGroup, prefer: string): Slot => [
  { pattern: 'accessory', muscle, prefer: [prefer] },
];

// Dumbbells only has no loaded vertical pull, and an injured area can rule one out; a second row
// fills the slot (D43).
const VERTICAL_PULL: Slot = [
  ...compound('vertical_pull'),
  { pattern: 'horizontal_pull', prefer: ['chest_supported_dumbbell_row'] },
];

// Workout contents are defaults pending the owner's answer on issue #12.
const FULL_BODY_A: Workout = [
  compound('squat'),
  compound('horizontal_push'),
  VERTICAL_PULL,
  accessory('legs', 'leg_curl'),
  accessory('arms', 'dumbbell_curl'),
];

const FULL_BODY_B: Workout = [
  compound('hinge'),
  compound('vertical_push'),
  compound('horizontal_pull'),
  compound('lunge'),
  accessory('arms', 'triceps_pushdown'),
];

const UPPER: Workout = [
  compound('horizontal_push'),
  compound('horizontal_pull'),
  compound('vertical_push'),
  VERTICAL_PULL,
  accessory('shoulders', 'dumbbell_lateral_raise'),
  accessory('arms', 'dumbbell_curl'),
];

const LOWER: Workout = [
  compound('squat'),
  compound('hinge'),
  compound('lunge'),
  accessory('legs', 'leg_extension'),
  accessory('legs', 'dumbbell_calf_raise'),
];

const PUSH: Workout = [
  compound('horizontal_push'),
  compound('vertical_push'),
  accessory('shoulders', 'dumbbell_lateral_raise'),
  accessory('arms', 'triceps_pushdown'),
];

const PULL: Workout = [
  VERTICAL_PULL,
  compound('horizontal_pull'),
  accessory('arms', 'dumbbell_curl'),
];

const LEGS: Workout = [
  compound('squat'),
  compound('hinge'),
  compound('lunge'),
  accessory('legs', 'leg_curl'),
  accessory('legs', 'dumbbell_calf_raise'),
];

export const SPLIT_WORKOUTS: Record<Split, readonly Workout[]> = {
  full_body: [FULL_BODY_A, FULL_BODY_B],
  upper_lower: [UPPER, LOWER],
  push_pull_legs: [PUSH, PULL, LEGS],
};
