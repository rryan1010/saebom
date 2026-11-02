import { describe, expect, it } from 'vitest';

import type { Profile } from '@shared/rules/index.ts';

import {
  bestE1rms,
  createPlan,
  DEFAULT_PROFILE,
  DEFAULT_REMINDERS,
  EMPTY_STATE,
  exerciseFor,
  finishSession,
  formatClock,
  formatLb,
  itemsFor,
  logSet,
  lowerTargetsAfter,
  newRecordIndexes,
  nextWorkoutLabel,
  parseState,
  rateSet,
  recordsIn,
  removeLastSet,
  repRecords,
  sessionProgress,
  sessionsThisWeek,
  sessionTargetLb,
  setStopped,
  startSession,
  suggestedReps,
  suggestedWeightLb,
  workoutDoneToday,
  workoutName,
  type WorkoutState,
} from './workout.ts';

const T0 = new Date(2026, 10, 2, 18, 0); // Monday, Nov 2, 2026, 6:00 PM local
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

const planned = (profile: Profile = DEFAULT_PROFILE) => createPlan(EMPTY_STATE, profile);

function started(state: WorkoutState, id = 's1', wentLighter = false): WorkoutState {
  return startSession(state, { id, now: T0, wentLighter });
}

/** Logs `count` sets of weight × reps on the active session's first exercise. */
function logFirst(state: WorkoutState, weightLb: number, reps: number, count: number) {
  let next = state;
  for (let i = 0; i < count; i++) next = logSet(next, 0, { weightLb, reps, now: minutes(i + 1) });
  return next;
}

function firstItem(state: WorkoutState) {
  const plan = state.plan;
  const label = state.active?.dayLabel;
  if (!plan || !label) throw new Error('no active session');
  const item = itemsFor(plan, label)[0];
  const exercise = item && exerciseFor(item.exerciseSlug);
  if (!item || !exercise) throw new Error('empty workout');
  return { item, exercise };
}

describe('the plan', () => {
  it('comes from the rules engine, with every exercise starting in calibration', () => {
    const state = planned();
    expect(state.plan?.items.length).toBeGreaterThan(0);
    for (const item of state.plan?.items ?? []) {
      expect(state.targets[item.exerciseSlug]).toMatchObject({
        targetWeightLb: null,
        repMin: item.repMin,
        repMax: item.repMax,
        belowRangeStreak: 0,
      });
    }
  });

  it('names the workouts of a full-body split', () => {
    const state = planned();
    expect(state.plan?.split).toBe('full_body');
    expect(workoutName(state.plan!, 'A')).toBe('Full body A');
    expect(workoutName(state.plan!, 'B')).toBe('Full body B');
    expect(workoutName(state.plan!, 'Z')).toBe('Workout Z');
  });

  it('never loads an area the lifter trains around', () => {
    const state = planned({ ...DEFAULT_PROFILE, avoidAreas: ['knee'] });
    for (const item of state.plan?.items ?? []) {
      const exercise = exerciseFor(item.exerciseSlug);
      expect([...(exercise?.regionsGreat ?? []), ...(exercise?.regionsLight ?? [])]).not.toContain(
        'knee',
      );
    }
  });

  it('keeps weights for exercises that stay when the profile changes (D33)', () => {
    let state = planned();
    const slug = state.plan!.items[0]!.exerciseSlug;
    state = {
      ...state,
      targets: { ...state.targets, [slug]: { ...state.targets[slug]!, targetWeightLb: 95 } },
    };
    const rebuilt = createPlan(state, { ...DEFAULT_PROFILE, daysPerWeek: 2 });
    if (rebuilt.plan!.items.some((i) => i.exerciseSlug === slug)) {
      expect(rebuilt.targets[slug]?.targetWeightLb).toBe(95);
    }
  });
});

describe('the rotation', () => {
  it('starts at A and moves on after each finished session (D17)', () => {
    let state = planned();
    expect(nextWorkoutLabel(state)).toBe('A');
    state = finishSession(logFirst(started(state), 45, 8, 1), minutes(30));
    expect(nextWorkoutLabel(state)).toBe('B');
    state = finishSession(logFirst(started(state, 's2'), 45, 8, 1), minutes(90));
    expect(nextWorkoutLabel(state)).toBe('A');
  });

  it("doesn't move on for a session that was discarded or had no sets", () => {
    const state = started(planned());
    expect(finishSession(state, minutes(5))).toBe(state);
    expect(nextWorkoutLabel(state)).toBe('A');
  });
});

describe('a session', () => {
  it("holds today's exercises in plan order and only one at a time", () => {
    const state = started(planned());
    const items = itemsFor(state.plan!, 'A');
    expect(state.active?.exercises.map((e) => e.exerciseSlug)).toEqual(
      items.map((i) => i.exerciseSlug),
    );
    expect(started(state, 'another')).toBe(state);
  });

  it('logs, rates and undoes sets, and ignores impossible ones', () => {
    let state = started(planned());
    state = logSet(state, 0, { weightLb: 45, reps: 8, now: minutes(1) });
    state = rateSet(state, 0, 0, 3);
    expect(state.active?.exercises[0]?.sets).toEqual([
      { weightLb: 45, reps: 8, effort: 3, loggedAt: minutes(1).toISOString() },
    ]);
    expect(logSet(state, 0, { weightLb: 0, reps: 8, now: T0 })).toBe(state);
    expect(logSet(state, 0, { weightLb: 45, reps: 0, now: T0 })).toBe(state);
    expect(logSet(state, 0, { weightLb: 45, reps: 2.5, now: T0 })).toBe(state);
    expect(logSet(state, 99, { weightLb: 45, reps: 8, now: T0 })).toBe(state);
    expect(removeLastSet(state, 0).active?.exercises[0]?.sets).toEqual([]);
  });

  it('counts progress against the sets planned, and a stopped exercise against what it logged', () => {
    let state = started(planned());
    const { item } = firstItem(state);
    const total = itemsFor(state.plan!, 'A').reduce((n, i) => n + i.sets, 0);
    state = logFirst(state, 45, 8, 1);
    expect(sessionProgress(state.plan!, state.active!)).toEqual({ done: 1, planned: total });
    state = setStopped(state, 0, true);
    expect(sessionProgress(state.plan!, state.active!)).toEqual({
      done: 1,
      planned: total - item.sets + 1,
    });
    expect(logSet(state, 0, { weightLb: 45, reps: 8, now: T0 })).toBe(state);
  });

  it('suggests the last set, then the target, then the empty load', () => {
    let state = started(planned());
    const { exercise, item } = firstItem(state);
    expect(suggestedWeightLb(state, 0)).toBe(exercise.minLoadLb);
    expect(suggestedReps(state, 0)).toBe(item.repMax);
    state = logSet(state, 0, { weightLb: 65, reps: 7, now: minutes(1) });
    expect(suggestedWeightLb(state, 0)).toBe(65);
    expect(suggestedReps(state, 0)).toBe(7);
  });

  it('counts as done today while it runs and once it is finished', () => {
    const state = started(planned());
    expect(workoutDoneToday(planned(), T0)).toBe(false);
    expect(workoutDoneToday(state, minutes(10))).toBe(true);
    const done = finishSession(logFirst(state, 45, 8, 1), minutes(40));
    expect(workoutDoneToday(done, minutes(60))).toBe(true);
    expect(workoutDoneToday(done, new Date(2026, 10, 3, 9))).toBe(false);
  });
});

describe('finishing', () => {
  it('records the session with its length and clears it from the phone', () => {
    const state = finishSession(logFirst(started(planned()), 45, 8, 2), minutes(42));
    expect(state.active).toBeNull();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]).toMatchObject({ id: 's1', dayLabel: 'A', durationS: 42 * 60 });
  });

  it('turns calibration sets into a target on the load grid', () => {
    const before = started(planned());
    const { exercise, item } = firstItem(before);
    const after = finishSession(logFirst(before, 95, item.repMax, item.sets), minutes(30));
    const weight = after.targets[item.exerciseSlug]?.targetWeightLb;
    expect(weight).not.toBeNull();
    expect(weight!).toBeGreaterThanOrEqual(exercise.minLoadLb);
    expect(weight!).toBeLessThanOrEqual(95 + exercise.incrementLb);
    expect((weight! - exercise.minLoadLb) % exercise.incrementLb).toBe(0);
  });

  it('adds one step when every set reaches the top of the range', () => {
    let state = planned();
    const slug = itemsFor(state.plan!, 'A')[0]!.exerciseSlug;
    state = {
      ...state,
      targets: { ...state.targets, [slug]: { ...state.targets[slug]!, targetWeightLb: 135 } },
    };
    state = started(state);
    const { exercise, item } = firstItem(state);
    state = finishSession(logFirst(state, 135, item.repMax, item.sets), minutes(30));
    expect(state.targets[slug]?.targetWeightLb).toBe(135 + exercise.incrementLb);
  });

  it('leaves targets alone after "Go lighter today" or "Pain? Stop" (D50)', () => {
    let state = planned();
    const slug = itemsFor(state.plan!, 'A')[0]!.exerciseSlug;
    state = {
      ...state,
      targets: { ...state.targets, [slug]: { ...state.targets[slug]!, targetWeightLb: 135 } },
    };

    const lighter = started(state, 'easy', true);
    const { exercise, item } = firstItem(lighter);
    expect(sessionTargetLb(lighter.targets[slug], exercise, true)).toBe(135 - exercise.incrementLb);
    const afterLighter = finishSession(logFirst(lighter, 125, item.repMax, item.sets), minutes(30));
    expect(afterLighter.targets[slug]?.targetWeightLb).toBe(135);

    const stopped = setStopped(logFirst(started(state), 135, item.repMax, 1), 0, true);
    expect(finishSession(stopped, minutes(20)).targets[slug]?.targetWeightLb).toBe(135);
  });

  it('lowers the targets from a session by one step, only once (D50)', () => {
    let state = planned();
    const slug = itemsFor(state.plan!, 'A')[0]!.exerciseSlug;
    state = {
      ...state,
      targets: { ...state.targets, [slug]: { ...state.targets[slug]!, targetWeightLb: 135 } },
    };
    state = started(state);
    const { exercise } = firstItem(state);
    state = finishSession(logFirst(state, 135, 5, 1), minutes(30));
    const lowered = lowerTargetsAfter(state, 's1');
    expect(lowered.targets[slug]?.targetWeightLb).toBe(135 - exercise.incrementLb);
    expect(lowerTargetsAfter(lowered, 's1')).toBe(lowered);
  });
});

describe('records and history', () => {
  it('marks a set that beats the earlier best at the same weight', () => {
    let state = finishSession(logFirst(started(planned()), 95, 8, 1), minutes(30));
    const slug = state.sessions[0]!.exercises[0]!.exerciseSlug;
    expect(repRecords(state.sessions).get(`${slug}@95`)).toBe(8);
    const records = repRecords(state.sessions);
    const sets = [
      { weightLb: 95, reps: 9 },
      { weightLb: 105, reps: 6 },
      { weightLb: 95, reps: 9 },
    ];
    expect([...newRecordIndexes(records, slug, sets)]).toEqual([0]);

    state = startSession(state, { id: 's2', now: minutes(60), wentLighter: false });
    state = finishSession(state, minutes(70)); // nothing logged: not recorded
    expect(state.sessions).toHaveLength(1);
    expect(recordsIn(state, 's1')).toBe(0);
  });

  it('keeps the best estimated max per exercise, best first', () => {
    const state = finishSession(logFirst(started(planned()), 100, 10, 1), minutes(30));
    const [best] = bestE1rms(state.sessions);
    expect(best?.e1rmLb).toBeCloseTo(133.3, 1);
  });

  it('counts sessions in the local Monday-to-Sunday week (D66)', () => {
    const state = finishSession(logFirst(started(planned()), 45, 8, 1), minutes(30));
    expect(sessionsThisWeek(state.sessions, new Date(2026, 10, 8, 23))).toBe(1); // Sunday
    expect(sessionsThisWeek(state.sessions, new Date(2026, 10, 9, 0, 1))).toBe(0); // next Monday
  });
});

describe('saving', () => {
  it('reads back what it saved', () => {
    const state = logFirst(started(planned()), 45, 8, 1);
    expect(parseState(JSON.stringify(state))).toEqual(state);
  });

  it('starts fresh from missing, broken or foreign data', () => {
    expect(parseState(null)).toBe(EMPTY_STATE);
    expect(parseState('{not json')).toBe(EMPTY_STATE);
    expect(parseState(JSON.stringify({ version: 99 }))).toBe(EMPTY_STATE);
  });

  it('fills in reminder settings older saves lack', () => {
    const saved = JSON.stringify({ ...planned(), reminders: undefined });
    expect(parseState(saved).reminders).toEqual(DEFAULT_REMINDERS);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [75, '1:15'],
    [600, '10:00'],
    [3725, '1:02:05'],
  ])('shows %i seconds as %s', (s, text) => {
    expect(formatClock(s)).toBe(text);
  });
});

describe('formatLb', () => {
  it('groups thousands and keeps half pounds', () => {
    expect(formatLb(45)).toBe('45 lb');
    expect(formatLb(22.5)).toBe('22.5 lb');
    expect(formatLb(1720)).toBe('1,720 lb');
  });
});
