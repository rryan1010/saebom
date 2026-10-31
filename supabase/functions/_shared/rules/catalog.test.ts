import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog.ts';
import { EQUIPMENT, MOVEMENT_PATTERNS, MUSCLE_GROUPS, REGIONS } from './types.ts';

const bySlug = new Map(CATALOG.map((exercise) => [exercise.slug, exercise]));

describe('catalog', () => {
  it('has the 25 exercises of D54 with unique slugs', () => {
    expect(CATALOG).toHaveLength(25);
    expect(bySlug.size).toBe(25);
  });

  it('names every exercise the handoff lists', () => {
    for (const slug of [
      'back_squat',
      'bench_press',
      'deadlift',
      'overhead_press',
      'romanian_deadlift',
      'leg_press',
      'lat_pulldown',
      'single_arm_cable_pulldown',
      'chest_supported_dumbbell_row',
      'seated_dumbbell_shoulder_press',
      'machine_shoulder_press',
      'dumbbell_curl',
      'triceps_pushdown',
      'dumbbell_lateral_raise',
      'leg_curl',
      'leg_extension',
      'dumbbell_calf_raise',
    ]) {
      expect(bySlug.has(slug), slug).toBe(true);
    }
  });

  it('flags exactly the four main lifts of D41', () => {
    expect(
      CATALOG.filter((exercise) => exercise.isMainLift)
        .map((exercise) => exercise.slug)
        .sort(),
    ).toEqual(['back_squat', 'bench_press', 'deadlift', 'overhead_press']);
  });

  it('only swaps to an existing exercise of the same pattern that is not a main lift (D44)', () => {
    for (const exercise of CATALOG) {
      for (const swap of exercise.allowedSwaps) {
        const target = bySlug.get(swap);
        expect(target, `${exercise.slug} swaps to ${swap}`).toBeDefined();
        expect(target?.movementPattern, `${exercise.slug} swaps to ${swap}`).toBe(
          exercise.movementPattern,
        );
        expect(target?.isMainLift, `${exercise.slug} swaps to ${swap}`).toBe(false);
        expect(swap).not.toBe(exercise.slug);
      }
    }
  });

  it('gives every non-accessory exercise at least one swap (D54)', () => {
    for (const exercise of CATALOG) {
      if (exercise.movementPattern === 'accessory') continue;
      expect(exercise.allowedSwaps.length, exercise.slug).toBeGreaterThan(0);
    }
  });

  it('keeps every row within the database check constraints', () => {
    for (const exercise of CATALOG) {
      expect(exercise.slug).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
      expect(MOVEMENT_PATTERNS).toContain(exercise.movementPattern);
      expect(MUSCLE_GROUPS).toContain(exercise.muscleGreat);
      expect(exercise.muscleLight).not.toBe(exercise.muscleGreat);
      expect(exercise.equipment.length).toBeGreaterThan(0);
      for (const item of exercise.equipment) expect(EQUIPMENT).toContain(item);
      for (const region of [...exercise.regionsGreat, ...exercise.regionsLight]) {
        expect(REGIONS).toContain(region);
      }
      expect(exercise.regionsGreat.filter((r) => exercise.regionsLight.includes(r))).toEqual([]);
      expect(exercise.incrementLb).toBeGreaterThan(0);
      expect(exercise.minLoadLb).toBeGreaterThan(0);
      expect(exercise.cues.length).toBeGreaterThanOrEqual(2);
      expect(exercise.cues.length).toBeLessThanOrEqual(3);
    }
  });

  it('follows D53 for steps and minimum loads', () => {
    for (const exercise of CATALOG) {
      if (exercise.equipment.includes('barbell')) {
        expect(exercise.minLoadLb, exercise.slug).toBe(45);
        expect([5, 10], exercise.slug).toContain(exercise.incrementLb);
      } else {
        expect(exercise.minLoadLb, exercise.slug).toBe(5);
        expect(exercise.incrementLb, exercise.slug).toBe(5);
      }
    }
  });

  it('cues the deadlift to raise the bar on blocks when small plates leave it low (D52)', () => {
    expect(bySlug.get('deadlift')?.cues).toContain(
      'Raise the bar on blocks if small plates leave it low',
    );
  });

  it('gives dumbbells only a squat, hinge, lunge, horizontal push and two rows (D43)', () => {
    const dumbbellOnly = CATALOG.filter((e) => e.equipment.every((i) => i === 'dumbbell'));
    const count = (pattern: string) =>
      dumbbellOnly.filter((e) => e.movementPattern === pattern).length;
    for (const pattern of ['squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push']) {
      expect(count(pattern), pattern).toBeGreaterThanOrEqual(1);
    }
    expect(count('horizontal_pull')).toBeGreaterThanOrEqual(2);
    expect(count('vertical_pull')).toBe(0);
  });
});
