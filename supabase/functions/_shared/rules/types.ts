export const REGIONS = [
  'shoulder',
  'elbow',
  'wrist',
  'neck',
  'lower_back',
  'hip',
  'knee',
  'ankle',
] as const;
export type Region = (typeof REGIONS)[number];

export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'accessory',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLE_GROUPS = ['legs', 'back', 'chest', 'shoulders', 'arms', 'core'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EXPERIENCE = ['new', 'intermediate', 'experienced'] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const GOAL_INTENSITY = ['standard', 'intense'] as const;
export type GoalIntensity = (typeof GOAL_INTENSITY)[number];

export const EQUIPMENT_SETUPS = ['full_gym', 'dumbbells_only'] as const;
export type EquipmentSetup = (typeof EQUIPMENT_SETUPS)[number];

export const SPLITS = ['full_body', 'upper_lower', 'push_pull_legs'] as const;
export type Split = (typeof SPLITS)[number];

/** Mirror of an `exercises` row. */
export interface Exercise {
  slug: string;
  name: string;
  movementPattern: MovementPattern;
  equipment: readonly Equipment[];
  muscleGreat: MuscleGroup;
  muscleLight: MuscleGroup | null;
  regionsGreat: readonly Region[];
  regionsLight: readonly Region[];
  incrementLb: number;
  minLoadLb: number;
  isMainLift: boolean;
  allowedSwaps: readonly string[];
  cues: readonly string[];
}

/**
 * What the engine knows about a tester. Readiness answers and acknowledgment times are left out on
 * purpose: nothing the engine can see may stop or change a plan on their account (D49).
 */
export interface Profile {
  experience: Experience;
  goalIntensity: GoalIntensity;
  daysPerWeek: number;
  equipment: EquipmentSetup;
  avoidAreas: readonly Region[];
  lightAreas: readonly Region[];
}

/** One `plan_items` row, minus its ids and `start_weight_lb`. */
export interface PlanItem {
  /** A single capital letter, matching `^[A-Z]$`. */
  dayLabel: string;
  /** 1-based within the day. */
  position: number;
  exerciseSlug: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  isLight: boolean;
}

export interface Plan {
  split: Split;
  daysPerWeek: number;
  items: PlanItem[];
}
