import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { SAEBOM_MARK } from '../app/src/ui/saebom-mark.ts';
import { COLORS } from '../app/src/ui/theme.ts';
import {
  APP_JSON_PATH,
  ICON_PATH,
  MASTER_SVG_PATH,
  SIZE_PX,
  SPLASH_PATH,
  encodeOpaquePng,
  readMaster,
} from './export-brand.ts';

type Png = { width: number; height: number; colorType: number; idat: Buffer };

function readPng(file: Buffer): Png {
  let at = 8;
  let header: Buffer | undefined;
  const idat: Buffer[] = [];
  while (at < file.length) {
    const length = file.readUInt32BE(at);
    const type = file.toString('ascii', at + 4, at + 8);
    const data = file.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') idat.push(data);
    at += 12 + length;
  }
  if (!header) throw new Error('no IHDR chunk');
  return {
    width: header.readUInt32BE(0),
    height: header.readUInt32BE(4),
    colorType: header[9] ?? -1,
    idat: Buffer.concat(idat),
  };
}

/** Decodes an RGB PNG written by encodeOpaquePng (every row uses filter 0) into hex colors. */
function rgbPixels(png: Png): string[] {
  const raw = inflateSync(png.idat);
  const stride = png.width * 3 + 1;
  const out: string[] = [];
  for (let y = 0; y < png.height; y++) {
    expect(raw[y * stride], 'row filter').toBe(0);
    for (let x = 0; x < png.width; x++) {
      const at = y * stride + 1 + x * 3;
      const hex = [raw[at], raw[at + 1], raw[at + 2]]
        .map((c) => (c ?? 0).toString(16).padStart(2, '0'))
        .join('');
      out.push(`#${hex.toUpperCase()}`);
    }
  }
  return out;
}

const masterSvg = readFileSync(MASTER_SVG_PATH, 'utf8');
const attr = (element: string, name: string): string | undefined =>
  element.match(new RegExp(`\\s${name}="([^"]+)"`))?.[1];

describe('the master SVG and the in-app mark (D78)', () => {
  const master = readMaster(masterSvg);

  it('share one viewBox', () => {
    expect(master.viewBox.join(' ')).toBe(SAEBOM_MARK.viewBox);
  });

  it('share one path and stroke', () => {
    expect(attr(master.path, 'd')).toBe(SAEBOM_MARK.d);
    expect(Number(attr(master.path, 'stroke-width'))).toBe(SAEBOM_MARK.strokeWidth);
    expect(Number(attr(master.path, 'stroke-miterlimit'))).toBe(SAEBOM_MARK.strokeMiterlimit);
  });

  it("is drawn in the dark theme's accent (D77)", () => {
    expect(attr(master.path, 'stroke')?.toUpperCase()).toBe(COLORS.dark.accent.toUpperCase());
  });
});

describe('encodeOpaquePng', () => {
  it('writes an RGB PNG with no alpha channel that decodes to the same colors', () => {
    const rgba = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 11, 13, 12, 255]);
    const png = readPng(encodeOpaquePng(2, 2, rgba));
    expect(png).toMatchObject({ width: 2, height: 2, colorType: 2 });
    expect(rgbPixels(png)).toEqual(['#FF0000', '#00FF00', '#0000FF', '#0B0D0C']);
  });

  it("refuses pixels that aren't fully opaque", () => {
    expect(() => encodeOpaquePng(1, 1, Uint8Array.from([0, 0, 0, 254]))).toThrow(/opaque/);
  });
});

describe('the exported images match the master and the theme (rerun npm run brand:export)', () => {
  it('the icon is a 1024 × 1024 RGB PNG with no alpha channel', () => {
    const png = readPng(readFileSync(ICON_PATH));
    expect(png).toMatchObject({ width: SIZE_PX, height: SIZE_PX, colorType: 2 });
  });

  it('the icon is the accent mark on the dark background', () => {
    const pixels = rgbPixels(readPng(readFileSync(ICON_PATH)));
    expect(pixels[0]).toBe(COLORS.dark.background);
    const counts = new Map<string, number>();
    for (const p of pixels)
      if (p !== COLORS.dark.background) counts.set(p, (counts.get(p) ?? 0) + 1);
    const [mostUsed] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
    expect(mostUsed).toBe(COLORS.dark.accent);
  });

  it('the splash image is a 1024 × 1024 PNG with a transparent background', () => {
    const png = readPng(readFileSync(SPLASH_PATH));
    expect(png).toMatchObject({ width: SIZE_PX, height: SIZE_PX, colorType: 6 });
  });

  it("app.json points at both images and the splash uses the theme's background", () => {
    const app = JSON.parse(readFileSync(APP_JSON_PATH, 'utf8')) as {
      expo: { icon: string; plugins: unknown[] };
    };
    expect(app.expo.icon).toBe('./assets/images/icon.png');
    const splash = app.expo.plugins.find(
      (p): p is [string, { backgroundColor: string; image: string }] =>
        Array.isArray(p) && p[0] === 'expo-splash-screen',
    );
    expect(splash?.[1]).toMatchObject({
      backgroundColor: COLORS.dark.background,
      image: './assets/images/splash-icon.png',
    });
  });
});
