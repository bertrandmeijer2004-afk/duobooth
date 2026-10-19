// Tata letak strip foto dalam satuan logis (lebar tetap 600).
// Tinggi bergantung jumlah foto. Satu frame berisi DUA foto berdampingan:
// host di kiri, guest di kanan, supaya kelihatan seperti foto bersama.

import { clamp } from './util.js';

export const STRIP_W = 600;
export const MIN_SHOTS = 2;
export const MAX_SHOTS = 4;

const PAD_X = 40;
const FRAME_W = 520;
const FRAME_H = 344;
const GAP = 22;
const TOP = 190;
const FOOTER = 196;

export function computeLayout(n = 4) {
  n = clamp(Math.round(n) || 4, MIN_SHOTS, MAX_SHOTS);
  const frames = [];
  for (let k = 0; k < n; k++) {
    frames.push({ x: PAD_X, y: TOP + k * (FRAME_H + GAP), w: FRAME_W, h: FRAME_H });
  }
  const H = TOP + n * FRAME_H + (n - 1) * GAP + FOOTER;
  return {
    W: STRIP_W,
    H,
    n,
    frames,
    gap: GAP,
    top: TOP,
    footer: FOOTER,
    border: 9, // tebal bingkai putih di sekeliling foto
    divider: 7, // jarak antara foto host dan guest
    radius: 24,
    title: { x: STRIP_W / 2, y: 60, w: STRIP_W - 110 },
    caption: { x: STRIP_W / 2, y: H - FOOTER + 82, w: STRIP_W - 100 },
    date: { x: STRIP_W / 2, y: H - FOOTER + 132, w: STRIP_W - 100 },
  };
}

/** Area foto di dalam sebuah frame: seluruh area dalam, separuh host, dan separuh guest. */
export function photoRects(f, L) {
  const b = L.border;
  const d = L.divider;
  const ix = f.x + b;
  const iy = f.y + b;
  const iw = f.w - 2 * b;
  const ih = f.h - 2 * b;
  const hw = (iw - d) / 2;
  return {
    inner: { x: ix, y: iy, w: iw, h: ih },
    host: { x: ix, y: iy, w: hw, h: ih },
    guest: { x: ix + hw + d, y: iy, w: hw, h: ih },
  };
}
