// Writes the app icon and the splash image from the logo's master SVG (D78), so the images the
// app loads never drift from it. Rerun after changing the master or the theme's accent or
// background. Runs on Node 24 (.nvmrc): `npm run brand:export`.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import { COLORS } from '../app/src/ui/theme.ts';

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export const MASTER_SVG_PATH = fromHere('../app/assets/brand/saebom-mark.svg');
export const ICON_PATH = fromHere('../app/assets/images/icon.png');
export const SPLASH_PATH = fromHere('../app/assets/images/splash-icon.png');
export const APP_JSON_PATH = fromHere('../app/app.json');

/** Both images are 1024 × 1024, the size Expo asks for. */
export const SIZE_PX = 1024;
/** Share of the icon's width the master's viewBox fills; the rest is margin iOS's mask can't clip. */
export const ICON_MARK_SHARE = 0.64;
/** The splash image is mostly mark; `imageWidth` in app.json sets its size on screen. */
export const SPLASH_MARK_SHARE = 0.94;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type Master = { viewBox: [number, number, number, number]; path: string };

/** Reads the master's viewBox and its single `<path … />` element, which carries the stroke. */
export function readMaster(svg: string): Master {
  const viewBox = svg
    .match(/<svg[^>]*\sviewBox="([^"]+)"/)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
  const paths = svg.match(/<path\b[^>]*\/>/g) ?? [];
  if (viewBox?.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) {
    throw new Error('saebom-mark.svg needs a viewBox of four numbers');
  }
  if (paths.length !== 1 || paths[0] === undefined) {
    throw new Error('saebom-mark.svg needs exactly one self-closing <path />');
  }
  const [x = 0, y = 0, w = 0, h = 0] = viewBox;
  return { viewBox: [x, y, w, h], path: paths[0] };
}

/** A square SVG of SIZE_PX with the mark centred at `share` of its width, on `background` if given. */
export function composeSvg(master: Master, share: number, background?: string): string {
  const [x, y, w, h] = master.viewBox;
  const side = w / share;
  const left = x - (side - w) / 2;
  const top = y - (side - h) / 2;
  const box = `${left} ${top} ${side} ${side}`;
  const fill = background
    ? `<rect x="${left}" y="${top}" width="${side}" height="${side}" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE_PX}" height="${SIZE_PX}" viewBox="${box}">${fill}${master.path}</svg>`;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * Encodes RGBA pixels as an RGB PNG with no alpha channel, which App Store Connect requires of
 * the app icon. Throws if any pixel isn't fully opaque, since dropping its alpha would change it.
 */
export function encodeOpaquePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== width * height * 4) throw new Error('pixel buffer size mismatch');
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      if (rgba[from + 3] !== 255) throw new Error(`pixel ${x},${y} isn't opaque`);
      const to = y * stride + 1 + x * 3;
      raw[to] = rgba[from] ?? 0;
      raw[to + 1] = rgba[from + 1] ?? 0;
      raw[to + 2] = rgba[from + 2] ?? 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // color type 2: RGB, no alpha
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function exportBrand(): void {
  const master = readMaster(readFileSync(MASTER_SVG_PATH, 'utf8'));

  const icon = new Resvg(composeSvg(master, ICON_MARK_SHARE, COLORS.dark.background)).render();
  writeFileSync(ICON_PATH, encodeOpaquePng(icon.width, icon.height, icon.pixels));

  const splash = new Resvg(composeSvg(master, SPLASH_MARK_SHARE)).render();
  writeFileSync(SPLASH_PATH, splash.asPng());

  console.log(`Wrote ${ICON_PATH} and ${SPLASH_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  exportBrand();
}
