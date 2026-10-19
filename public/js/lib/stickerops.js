// Operasi pada stiker pengguna. Semua perubahan lewat state bersama, jadi otomatis tersinkron ke pasangan.

import { newStickerId, nextZ, minZ, sanitizeSticker, stickerCount } from '../state.js';
import { clamp } from './util.js';

export const MAX_STICKERS = 60;
export const MIN_SIZE = 28;
export const MAX_SIZE = 520;

export function readSticker(shared, id) {
  const e = shared.map.get('stk:' + id);
  return e && e.v ? sanitizeSticker(e.v) : null;
}

function write(shared, st) {
  shared.set('stk:' + st.id, st);
  return st;
}

/** Tambah stiker baru. Mengembalikan stiker, atau null bila sudah terlalu banyak. */
export function addSticker(shared, stickerId, { fx = 0.5, fy = 0.5, size = 130 } = {}) {
  if (stickerCount(shared) >= MAX_STICKERS) return null;
  const st = {
    id: newStickerId(),
    s: stickerId,
    fx: clamp(fx, 0.04, 0.96),
    fy: clamp(fy, 0.03, 0.97),
    size,
    rot: Math.round((Math.random() - 0.5) * 16),
    flip: false,
    z: nextZ(shared),
  };
  return write(shared, st);
}

export function patchSticker(shared, id, patch) {
  const cur = readSticker(shared, id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  next.size = clamp(next.size, MIN_SIZE, MAX_SIZE);
  next.fx = clamp(next.fx, 0, 1);
  next.fy = clamp(next.fy, 0, 1);
  return write(shared, next);
}

export function removeSticker(shared, id) {
  shared.set('stk:' + id, null);
}

export function clearStickers(shared) {
  const obj = {};
  for (const [k, e] of shared.map) if (k.startsWith('stk:') && e.v) obj[k] = null;
  shared.setMany(obj);
}

export function duplicateSticker(shared, id) {
  const cur = readSticker(shared, id);
  if (!cur || stickerCount(shared) >= MAX_STICKERS) return null;
  return write(shared, {
    ...cur,
    id: newStickerId(),
    fx: clamp(cur.fx + 0.05, 0.04, 0.96),
    fy: clamp(cur.fy + 0.025, 0.03, 0.97),
    z: nextZ(shared),
  });
}

export const bringToFront = (shared, id) => patchSticker(shared, id, { z: nextZ(shared) });
export const sendToBack = (shared, id) => patchSticker(shared, id, { z: minZ(shared) });

export function stickerCountOf(shared) {
  return stickerCount(shared);
}
