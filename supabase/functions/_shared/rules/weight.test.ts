import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIXTURE_CATALOG, fixtureExercise } from './catalog.fixture.ts';
import { estimateE1rmLb, roundDownToLoad, targetWeightLb } from './weight.ts';

const barbellLower = { minLoadLb: 45, incrementLb: 10 };
const dumbbell = { minLoadLb: 5, incrementLb: 5 };

describe('estimateE1rmLb', () => {
  it('applies Epley between 2 and 12 reps, to a tenth of a pound', () => {
    expect(estimateE1rmLb(100, 10)).toBe(133.3);
    expect(estimateE1rmLb(100, 2)).toBe(106.7);
    expect(estimateE1rmLb(135, 5)).toBe(157.5);
    expect(estimateE1rmLb(100, 12)).toBe(140);
  });

  it('counts a single rep as its own weight', () => {
    expect(estimateE1rmLb(225, 1)).toBe(225);
  });

  it('gives nothing above 12 reps', () => {
    expect(estimateE1rmLb(100, 13)).toBeNull();
    expect(estimateE1rmLb(100, 30)).toBeNull();
  });
});

describe('roundDownToLoad', () => {
  it('rounds down onto a 45 lb bar with 10 lb steps', () => {
    expect(roundDownToLoad(100, barbellLower)).toBe(95);
    expect(roundDownToLoad(64.9, barbellLower)).toBe(55);
    expect(roundDownToLoad(154.99, barbellLower)).toBe(145);
  });

  it('rounds down onto a 5 lb grid for dumbbells', () => {
    expect(roundDownToLoad(37.4, dumbbell)).toBe(35);
    expect(roundDownToLoad(52, dumbbell)).toBe(50);
  });

  it('never goes below the minimum load', () => {
    expect(roundDownToLoad(44, barbellLower)).toBe(45);
    expect(roundDownToLoad(3, dumbbell)).toBe(5);
    expect(roundDownToLoad(0, dumbbell)).toBe(5);
    expect(roundDownToLoad(-12, dumbbell)).toBe(5);
  });

  it('leaves a weight that is already on the grid alone', () => {
    expect(roundDownToLoad(65, barbellLower)).toBe(65);
    expect(roundDownToLoad(45, barbellLower)).toBe(45);
    expect(roundDownToLoad(40, dumbbell)).toBe(40);
    expect(roundDownToLoad(0.1 + 0.2 + 64.7, barbellLower)).toBe(65);
  });

  it('handles fractional increments without float drift', () => {
    const fractional = { minLoadLb: 2.5, incrementLb: 2.5 };
    expect(roundDownToLoad(8, fractional)).toBe(7.5);
    expect(roundDownToLoad(9.99, fractional)).toBe(7.5);
    expect(roundDownToLoad(10, fractional)).toBe(10);
    expect(roundDownToLoad(5.1 + 0.1, { minLoadLb: 5, incrementLb: 0.1 })).toBe(5.2);
  });
});

describe('targetWeightLb', () => {
  it('divides the e1RM by 1 + (r + k) / 30 and rounds down onto the loads', () => {
    expect(targetWeightLb(200, 6, 2, barbellLower)).toBe(155);
    expect(targetWeightLb(200, 6, 2, dumbbell)).toBe(155);
    expect(targetWeightLb(100, 8, 4, barbellLower)).toBe(65);
    expect(targetWeightLb(100, 8, 4, dumbbell)).toBe(70);
  });

  it('clamps a tiny e1RM to the minimum load', () => {
    expect(targetWeightLb(20, 6, 2, barbellLower)).toBe(45);
    expect(targetWeightLb(20, 6, 2, dumbbell)).toBe(15);
    expect(targetWeightLb(5, 6, 2, dumbbell)).toBe(5);
  });
});

describe('targetWeightLb properties', () => {
  it('is at least the minimum load, on the grid, and not above the raw value unless clamped', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 3000, noNaN: true }),
        fc.integer({ min: 6, max: 12 }),
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom(...FIXTURE_CATALOG),
        (e1rmLb, repMin, rir, exercise) => {
          const weightLb = targetWeightLb(e1rmLb, repMin, rir, exercise);
          const raw = e1rmLb / (1 + (repMin + rir) / 30);
          const aboveMinTenths = Math.round(weightLb * 10) - Math.round(exercise.minLoadLb * 10);
          expect(weightLb).toBeGreaterThanOrEqual(exercise.minLoadLb);
          expect(aboveMinTenths % Math.round(exercise.incrementLb * 10)).toBe(0);
          expect(weightLb <= raw + 1e-6 || weightLb === exercise.minLoadLb).toBe(true);
        },
      ),
    );
  });

  it('is exact on every grid point of every fixture exercise', () => {
    for (const exercise of FIXTURE_CATALOG) {
      for (let k = 0; k <= 40; k++) {
        const onGrid = exercise.minLoadLb + k * exercise.incrementLb;
        expect(roundDownToLoad(onGrid, exercise), `${exercise.slug} k=${k}`).toBe(onGrid);
      }
    }
    expect(fixtureExercise('back_squat').minLoadLb).toBe(45);
  });
});
