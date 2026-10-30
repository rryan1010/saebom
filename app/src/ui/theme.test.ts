import { describe, expect, it } from 'vitest';

import { COLORS, MOTION, type ColorRole, type Scheme } from './theme.ts';

function channel(hex: string, start: number): number {
  const c = parseInt(hex.slice(start, start + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: { fg: ColorRole; bg: ColorRole; min: number }[] = [
  { fg: 'text', bg: 'background', min: 4.5 },
  { fg: 'text', bg: 'surface', min: 4.5 },
  { fg: 'textSecondary', bg: 'background', min: 4.5 },
  { fg: 'textSecondary', bg: 'surface', min: 4.5 },
  { fg: 'onAccent', bg: 'accent', min: 4.5 },
  { fg: 'accent', bg: 'background', min: 3 },
  { fg: 'accent', bg: 'surface', min: 3 },
];

const SCHEMES: Scheme[] = ['dark', 'light'];

describe.each(SCHEMES)('%s theme contrast', (scheme) => {
  it.each(PAIRS)('$fg on $bg is at least $min:1', ({ fg, bg, min }) => {
    const ratio = contrast(COLORS[scheme][fg], COLORS[scheme][bg]);
    expect(ratio, `${scheme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
  });
});

describe('motion', () => {
  it('keeps transitions at 300 ms or less (§8)', () => {
    expect(MOTION.durationMs).toBeLessThanOrEqual(300);
  });
});
