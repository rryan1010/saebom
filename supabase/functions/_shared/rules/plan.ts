import { LIGHT_PRESCRIPTION, planDays, planSplit, profileRow } from './profiles.ts';
import type { Prescription } from './profiles.ts';
import { SPLIT_WORKOUTS } from './templates.ts';
import type { Workout } from './templates.ts';
import { EQUIPMENT } from './types.ts';
import type {
  Equipment,
  EquipmentSetup,
  Exercise,
  Plan,
  PlanItem,
  Profile,
  Region,
} from './types.ts';

export type Treatment = 'normal' | 'light' | 'excluded';

const SETUP_EQUIPMENT: Record<EquipmentSetup, readonly Equipment[]> = {
  full_gym: EQUIPMENT,
  dumbbells_only: ['dumbbell'],
};

const loadsArea = (exercise: Exercise, area: Region): boolean =>
  exercise.regionsGreat.includes(area) || exercise.regionsLight.includes(area);

/**
 * An area listed to avoid and to train light is trained around, the safer reading, though the
 * database forbids the overlap.
 */
export function exerciseTreatment(exercise: Exercise, profile: Profile): Treatment {
  const allowed = SETUP_EQUIPMENT[profile.equipment];
  if (!exercise.equipment.every((item) => allowed.includes(item))) return 'excluded';
  if (profile.avoidAreas.some((area) => loadsArea(exercise, area))) return 'excluded';
  if (profile.experience === 'new' && exercise.slug === 'deadlift') return 'excluded';
  if (!profile.lightAreas.some((area) => loadsArea(exercise, area))) return 'normal';
  return exercise.isMainLift || exercise.equipment.includes('barbell') ? 'excluded' : 'light';
}

interface Candidate {
  exercise: Exercise;
  isLight: boolean;
}

function fillWorkout(workout: Workout, candidates: readonly Candidate[]): Candidate[] {
  const picked: Candidate[] = [];
  const used = new Set<string>();
  for (const slot of workout) {
    for (const option of slot) {
      const available = candidates.filter(
        ({ exercise }) =>
          exercise.movementPattern === option.pattern &&
          (option.muscle === undefined || exercise.muscleGreat === option.muscle) &&
          !used.has(exercise.slug),
      );
      const preferred = option.prefer
        .map((slug) => available.find(({ exercise }) => exercise.slug === slug))
        .find((hit) => hit !== undefined);
      const choice = preferred ?? available[0];
      if (choice === undefined) continue;
      picked.push(choice);
      used.add(choice.exercise.slug);
      break;
    }
  }
  return picked;
}

const dayLabel = (index: number): string => String.fromCharCode('A'.charCodeAt(0) + index);

function toItem(
  label: string,
  position: number,
  { exercise, isLight }: Candidate,
  rowPrescription: Prescription,
): PlanItem {
  const { sets, repMin, repMax, rir } = isLight ? LIGHT_PRESCRIPTION : rowPrescription;
  return {
    dayLabel: label,
    position,
    exerciseSlug: exercise.slug,
    sets,
    repMin,
    repMax,
    rir,
    isLight,
  };
}

export function buildPlan(profile: Profile, catalog: readonly Exercise[]): Plan {
  const row = profileRow(profile);
  const split = planSplit(profile);
  const candidates = [...catalog]
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .flatMap((exercise): Candidate[] => {
      const treatment = exerciseTreatment(exercise, profile);
      return treatment === 'excluded' ? [] : [{ exercise, isLight: treatment === 'light' }];
    });

  const items = SPLIT_WORKOUTS[split]
    .map((workout) => fillWorkout(workout, candidates))
    .filter((picked) => picked.length > 0)
    .flatMap((picked, index) =>
      picked.map((candidate, at) => toItem(dayLabel(index), at + 1, candidate, row)),
    );

  return { split, daysPerWeek: planDays(profile), items };
}

/** The label after `lastDayLabel` in the plan's order, wrapping; the first when it is unknown. */
export function nextDayLabel(plan: Plan, lastDayLabel: string | null): string | null {
  const labels = [...new Set(plan.items.map((item) => item.dayLabel))];
  if (lastDayLabel === null) return labels[0] ?? null;
  const at = labels.indexOf(lastDayLabel);
  return labels[(at + 1) % labels.length] ?? null;
}
