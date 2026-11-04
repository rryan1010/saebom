// Everything the phone-only POC knows about a lifter, and the pure functions that change it. The
// plan engine in _shared/rules does the training math; this file only keeps state and calls it.
// No React Native imports and no clock or randomness, so Vitest covers it from the repo root.
import { CATALOG } from '@shared/rules/catalog.ts';
import {
  buildPlan,
  estimateE1rmLb,
  lowerTarget,
  nextDayLabel,
  progressTarget,
  roundDownToLoad,
  type Effort,
  type Exercise,
  type MuscleGroup,
  type Plan,
  type PlanItem,
  type Profile,
  type Region,
  type Split,
  type Target,
} from '@shared/rules/index.ts';

export const STORE_VERSION = 1;

export interface SetEntry {
  weightLb: number;
  reps: number;
  /** 1 easy, 2 OK, 3 hard; null until the lifter rates the set. */
  effort: Effort | null;
  loggedAt: string;
}

export interface ExerciseLog {
  exerciseSlug: string;
  sets: SetEntry[];
  /** Ended early with "Pain? Stop" (D50). */
  stopped: boolean;
}

export interface ActiveSession {
  id: string;
  dayLabel: string;
  startedAt: string;
  /** Started with "Go lighter today" (D50). */
  wentLighter: boolean;
  exercises: ExerciseLog[];
}

export interface TargetChange {
  exerciseSlug: string;
  beforeLb: number | null;
}

export interface CompletedSession extends ActiveSession {
  endedAt: string;
  durationS: number;
  /** Each logged exercise's target weight before this session moved it. */
  changes: TargetChange[];
  /** "Lower my targets" was applied after this session. */
  loweredAfter: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  /** JavaScript weekdays: 0 is Sunday, 6 is Saturday. */
  weekdays: number[];
  hour: number;
  minute: number;
}

export interface WorkoutState {
  version: typeof STORE_VERSION;
  profile: Profile | null;
  plan: Plan | null;
  /** The next target for each exercise in the plan, by slug. */
  targets: Record<string, Target>;
  /** Finished sessions, oldest first. */
  sessions: CompletedSession[];
  /** The session in progress, saved after every set. */
  active: ActiveSession | null;
  reminders: ReminderSettings;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  weekdays: [1, 3, 5],
  hour: 18,
  minute: 0,
};

export const EMPTY_STATE: WorkoutState = {
  version: STORE_VERSION,
  profile: null,
  plan: null,
  targets: {},
  sessions: [],
  active: null,
  reminders: DEFAULT_REMINDERS,
};

export const DEFAULT_PROFILE: Profile = {
  experience: 'new',
  goalIntensity: 'standard',
  daysPerWeek: 3,
  equipment: 'full_gym',
  avoidAreas: [],
  lightAreas: [],
};

const BY_SLUG: ReadonlyMap<string, Exercise> = new Map(CATALOG.map((e) => [e.slug, e]));

export function exerciseFor(slug: string): Exercise | undefined {
  return BY_SLUG.get(slug);
}

// ---------------------------------------------------------------------------------------------
// Labels

export const REGION_LABELS: Record<Region, string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  neck: 'Neck',
  lower_back: 'Lower back',
  hip: 'Hip',
  knee: 'Knee',
  ankle: 'Ankle',
};

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  legs: 'Legs',
  back: 'Back',
  chest: 'Chest',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
};

export const SPLIT_NAMES: Record<Split, string> = {
  full_body: 'Full body',
  upper_lower: 'Upper/lower',
  push_pull_legs: 'Push/pull/legs',
};

const WORKOUT_NAMES: Record<Split, readonly string[]> = {
  full_body: ['Full body A', 'Full body B'],
  upper_lower: ['Upper body', 'Lower body'],
  push_pull_legs: ['Push', 'Pull', 'Legs'],
};

/** "Legs · Back, light" (D51): the great muscle group, then the light one. */
export function muscleLine(exercise: Exercise): string {
  const great = MUSCLE_LABELS[exercise.muscleGreat];
  return exercise.muscleLight ? `${great} · ${MUSCLE_LABELS[exercise.muscleLight]}, light` : great;
}

/** 1720 → "1,720 lb", 22.5 → "22.5 lb". */
export function formatLb(weightLb: number): string {
  return `${weightLb.toLocaleString('en-US', { maximumFractionDigits: 1 })} lb`;
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function elapsedS(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(startedAt)) / 1000));
}

// ---------------------------------------------------------------------------------------------
// Plan

export function dayLabels(plan: Plan): string[] {
  return [...new Set(plan.items.map((item) => item.dayLabel))].sort();
}

/** "Upper body" when every workout of the split made it into the plan, otherwise "Workout A". */
export function workoutName(plan: Plan, dayLabel: string): string {
  const labels = dayLabels(plan);
  const names = WORKOUT_NAMES[plan.split];
  const at = labels.indexOf(dayLabel);
  const name = labels.length === names.length && at >= 0 ? names[at] : undefined;
  return name ?? `Workout ${dayLabel}`;
}

export function itemsFor(plan: Plan, dayLabel: string): PlanItem[] {
  return plan.items
    .filter((item) => item.dayLabel === dayLabel)
    .sort((a, b) => a.position - b.position);
}

export function itemFor(plan: Plan, dayLabel: string, exerciseSlug: string): PlanItem | undefined {
  return plan.items.find((i) => i.dayLabel === dayLabel && i.exerciseSlug === exerciseSlug);
}

function freshTarget(item: PlanItem): Target {
  return {
    exerciseSlug: item.exerciseSlug,
    targetWeightLb: null,
    repMin: item.repMin,
    repMax: item.repMax,
    rir: item.rir,
    belowRangeStreak: 0,
  };
}

/**
 * Builds the plan from the profile with the rules engine (D2). Exercises that stay in the plan keep
 * their weights, and new ones start with a calibration set (D33).
 */
export function createPlan(state: WorkoutState, profile: Profile): WorkoutState {
  const plan = buildPlan(profile, CATALOG);
  const targets: Record<string, Target> = {};
  for (const item of plan.items) {
    const kept = state.targets[item.exerciseSlug];
    targets[item.exerciseSlug] = kept
      ? { ...kept, repMin: item.repMin, repMax: item.repMax, rir: item.rir }
      : freshTarget(item);
  }
  return { ...state, profile, plan, targets };
}

export function lastSession(state: WorkoutState): CompletedSession | undefined {
  return state.sessions[state.sessions.length - 1];
}

/** Workouts rotate in order, A, B, C… (D17). */
export function nextWorkoutLabel(state: WorkoutState): string | null {
  if (!state.plan) return null;
  return nextDayLabel(state.plan, lastSession(state)?.dayLabel ?? null);
}

export function isCalibrating(target: Target | undefined): boolean {
  return (target?.targetWeightLb ?? null) === null;
}

/** The weight to aim for in this session: one step lighter after "Go lighter today" (D50). */
export function sessionTargetLb(
  target: Target | undefined,
  exercise: Exercise,
  wentLighter: boolean,
): number | null {
  const weightLb = target?.targetWeightLb ?? null;
  if (weightLb === null) return null;
  return wentLighter ? roundDownToLoad(weightLb - exercise.incrementLb, exercise) : weightLb;
}

// ---------------------------------------------------------------------------------------------
// Session

export function startSession(
  state: WorkoutState,
  input: { id: string; now: Date; wentLighter: boolean },
): WorkoutState {
  if (state.active || !state.plan) return state;
  const dayLabel = nextWorkoutLabel(state);
  if (dayLabel === null) return state;
  const items = itemsFor(state.plan, dayLabel);
  if (items.length === 0) return state;
  return {
    ...state,
    active: {
      id: input.id,
      dayLabel,
      startedAt: input.now.toISOString(),
      wentLighter: input.wentLighter,
      exercises: items.map((item) => ({
        exerciseSlug: item.exerciseSlug,
        sets: [],
        stopped: false,
      })),
    },
  };
}

function withExercise(
  state: WorkoutState,
  index: number,
  change: (log: ExerciseLog) => ExerciseLog | null,
): WorkoutState {
  const active = state.active;
  const log = active?.exercises[index];
  if (!active || !log) return state;
  const next = change(log);
  if (next === null) return state;
  const exercises = active.exercises.map((e, i) => (i === index ? next : e));
  return { ...state, active: { ...active, exercises } };
}

export const MAX_WEIGHT_LB = 1500;
export const MAX_REPS_LOGGED = 100;

export function logSet(
  state: WorkoutState,
  index: number,
  set: { weightLb: number; reps: number; now: Date },
): WorkoutState {
  const valid =
    set.weightLb > 0 &&
    set.weightLb <= MAX_WEIGHT_LB &&
    Number.isInteger(set.reps) &&
    set.reps >= 1 &&
    set.reps <= MAX_REPS_LOGGED;
  if (!valid) return state;
  return withExercise(state, index, (log) =>
    log.stopped
      ? null
      : {
          ...log,
          sets: [
            ...log.sets,
            {
              weightLb: set.weightLb,
              reps: set.reps,
              effort: null,
              loggedAt: set.now.toISOString(),
            },
          ],
        },
  );
}

export function rateSet(
  state: WorkoutState,
  index: number,
  setIndex: number,
  effort: Effort,
): WorkoutState {
  return withExercise(state, index, (log) =>
    log.sets[setIndex]
      ? { ...log, sets: log.sets.map((s, i) => (i === setIndex ? { ...s, effort } : s)) }
      : null,
  );
}

export function removeLastSet(state: WorkoutState, index: number): WorkoutState {
  return withExercise(state, index, (log) =>
    log.sets.length > 0 ? { ...log, sets: log.sets.slice(0, -1) } : null,
  );
}

export function setStopped(state: WorkoutState, index: number, stopped: boolean): WorkoutState {
  return withExercise(state, index, (log) =>
    log.stopped === stopped ? null : { ...log, stopped },
  );
}

export function discardSession(state: WorkoutState): WorkoutState {
  return state.active ? { ...state, active: null } : state;
}

export function setsLogged(session: Pick<ActiveSession, 'exercises'>): number {
  return session.exercises.reduce((n, log) => n + log.sets.length, 0);
}

/** Sets done out of sets planned; an exercise stopped early counts what it logged. */
export function sessionProgress(
  plan: Plan,
  session: ActiveSession,
): { done: number; planned: number } {
  let done = 0;
  let planned = 0;
  for (const log of session.exercises) {
    const sets = itemFor(plan, session.dayLabel, log.exerciseSlug)?.sets ?? 0;
    done += Math.min(log.sets.length, sets);
    planned += log.stopped ? Math.min(log.sets.length, sets) : sets;
  }
  return { done, planned };
}

/** Where the weight stepper starts: the last set, the target, the last time, or the empty load. */
export function suggestedWeightLb(state: WorkoutState, index: number): number | null {
  const active = state.active;
  const log = active?.exercises[index];
  const exercise = log ? exerciseFor(log.exerciseSlug) : undefined;
  if (!active || !log || !exercise) return null;
  const last = log.sets[log.sets.length - 1];
  if (last) return last.weightLb;
  const target = sessionTargetLb(state.targets[log.exerciseSlug], exercise, active.wentLighter);
  if (target !== null) return target;
  return lastWeightUsedLb(state.sessions, log.exerciseSlug) ?? exercise.minLoadLb;
}

export function suggestedReps(state: WorkoutState, index: number): number | null {
  const active = state.active;
  const log = active?.exercises[index];
  if (!active || !log || !state.plan) return null;
  const last = log.sets[log.sets.length - 1];
  if (last) return last.reps;
  return itemFor(state.plan, active.dayLabel, log.exerciseSlug)?.repMax ?? null;
}

export function lastWeightUsedLb(
  sessions: readonly CompletedSession[],
  exerciseSlug: string,
): number | null {
  for (let s = sessions.length - 1; s >= 0; s--) {
    const log = sessions[s]?.exercises.find((e) => e.exerciseSlug === exerciseSlug);
    const last = log?.sets[log.sets.length - 1];
    if (last) return last.weightLb;
  }
  return null;
}

/**
 * Records the session and moves each logged exercise's target with the engine's double
 * progression. "Go lighter today" and "Pain? Stop" leave targets where they were (D50), so easing
 * off never counts as progress or as falling behind. A session with no sets isn't recorded.
 */
export function finishSession(state: WorkoutState, now: Date): WorkoutState {
  const { active, plan } = state;
  if (!active || !plan || setsLogged(active) === 0) return state;

  const targets = { ...state.targets };
  const changes: TargetChange[] = [];
  for (const log of active.exercises) {
    const exercise = exerciseFor(log.exerciseSlug);
    const item = itemFor(plan, active.dayLabel, log.exerciseSlug);
    const target = targets[log.exerciseSlug] ?? (item ? freshTarget(item) : undefined);
    if (!exercise || !item || !target || log.sets.length === 0) continue;
    changes.push({ exerciseSlug: log.exerciseSlug, beforeLb: target.targetWeightLb });
    if (log.stopped) continue;
    targets[log.exerciseSlug] = progressTarget({
      target,
      exercise,
      item,
      sets: log.sets.map(({ weightLb, reps, effort }) => ({ weightLb, reps, effort })),
      wentLighter: active.wentLighter,
      lowerTargets: false,
    });
  }

  const finished: CompletedSession = {
    ...active,
    endedAt: now.toISOString(),
    durationS: elapsedS(active.startedAt, now),
    changes,
    loweredAfter: false,
  };
  return { ...state, active: null, targets, sessions: [...state.sessions, finished] };
}

/** "Lower my targets" (D50): one step off each exercise in the session, once. */
export function lowerTargetsAfter(state: WorkoutState, sessionId: string): WorkoutState {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session || session.loweredAfter) return state;
  const targets = { ...state.targets };
  for (const log of session.exercises) {
    const target = targets[log.exerciseSlug];
    const exercise = exerciseFor(log.exerciseSlug);
    if (target && exercise && log.sets.length > 0) {
      targets[log.exerciseSlug] = lowerTarget(target, exercise);
    }
  }
  const sessions = state.sessions.map((s) =>
    s.id === sessionId ? { ...s, loweredAfter: true } : s,
  );
  return { ...state, targets, sessions };
}

// ---------------------------------------------------------------------------------------------
// History and records

const recordKey = (exerciseSlug: string, weightLb: number) => `${exerciseSlug}@${weightLb}`;

/** The most reps ever logged at each weight, per exercise. */
export function repRecords(sessions: readonly CompletedSession[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const session of sessions) {
    for (const log of session.exercises) {
      for (const set of log.sets) {
        const key = recordKey(log.exerciseSlug, set.weightLb);
        if ((best.get(key) ?? 0) < set.reps) best.set(key, set.reps);
      }
    }
  }
  return best;
}

/** Which sets beat the earlier best at the same weight. A first set at a new weight has nothing to beat. */
export function newRecordIndexes(
  records: ReadonlyMap<string, number>,
  exerciseSlug: string,
  sets: readonly Pick<SetEntry, 'weightLb' | 'reps'>[],
): Set<number> {
  const best = new Map(records);
  const found = new Set<number>();
  sets.forEach((set, i) => {
    const key = recordKey(exerciseSlug, set.weightLb);
    const previous = best.get(key);
    if (previous !== undefined && set.reps > previous) found.add(i);
    if (previous === undefined || set.reps > previous) best.set(key, set.reps);
  });
  return found;
}

export function recordsIn(state: WorkoutState, sessionId: string): number {
  const at = state.sessions.findIndex((s) => s.id === sessionId);
  const session = state.sessions[at];
  if (!session) return 0;
  const before = repRecords(state.sessions.slice(0, at));
  return session.exercises.reduce(
    (n, log) => n + newRecordIndexes(before, log.exerciseSlug, log.sets).size,
    0,
  );
}

export function volumeLb(session: Pick<ActiveSession, 'exercises'>): number {
  return session.exercises.reduce(
    (total, log) => total + log.sets.reduce((sum, set) => sum + set.weightLb * set.reps, 0),
    0,
  );
}

/** Each exercise's best estimated one-rep max (Epley, sets of 12 reps or fewer), best first. */
export function bestE1rms(
  sessions: readonly CompletedSession[],
): { exerciseSlug: string; e1rmLb: number }[] {
  const best = new Map<string, number>();
  for (const session of sessions) {
    for (const log of session.exercises) {
      for (const set of log.sets) {
        const e1rm = estimateE1rmLb(set.weightLb, set.reps);
        if (e1rm !== null && e1rm > (best.get(log.exerciseSlug) ?? 0)) {
          best.set(log.exerciseSlug, e1rm);
        }
      }
    }
  }
  return [...best]
    .map(([exerciseSlug, e1rmLb]) => ({ exerciseSlug, e1rmLb }))
    .sort((a, b) => b.e1rmLb - a.e1rmLb);
}

// ---------------------------------------------------------------------------------------------
// Days and weeks, in the phone's local time (D66)

export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Today's workout counts as done once a session started today was finished, or is under way. */
export function workoutDoneToday(state: WorkoutState, now: Date): boolean {
  const today = (iso: string) => sameLocalDay(new Date(iso), now);
  return (
    state.sessions.some((s) => today(s.startedAt)) ||
    (!!state.active && today(state.active.startedAt))
  );
}

export function startOfLocalWeek(now: Date): Date {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
}

export function sessionsThisWeek(sessions: readonly CompletedSession[], now: Date): number {
  const start = startOfLocalWeek(now);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return sessions.filter((s) => {
    const at = Date.parse(s.startedAt);
    return at >= start.getTime() && at < end.getTime();
  }).length;
}

// ---------------------------------------------------------------------------------------------
// Storage

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads what the store saved; anything unreadable starts the app fresh. */
export function parseState(raw: string | null): WorkoutState {
  if (!raw) return EMPTY_STATE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_STATE;
  }
  if (!isRecord(data) || data.version !== STORE_VERSION) return EMPTY_STATE;
  return {
    version: STORE_VERSION,
    profile: isRecord(data.profile) ? (data.profile as unknown as Profile) : null,
    plan: isRecord(data.plan) ? (data.plan as unknown as Plan) : null,
    targets: isRecord(data.targets) ? (data.targets as Record<string, Target>) : {},
    sessions: Array.isArray(data.sessions) ? (data.sessions as CompletedSession[]) : [],
    active: isRecord(data.active) ? (data.active as unknown as ActiveSession) : null,
    reminders: {
      ...DEFAULT_REMINDERS,
      ...(isRecord(data.reminders) ? (data.reminders as Partial<ReminderSettings>) : {}),
    },
  };
}
