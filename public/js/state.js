// State bersama antara dua device.
//
// Setiap kunci menyimpan {v, ts, by}. Saat dua device mengubah kunci yang sama, nilai dengan
// (ts, by) lebih besar yang menang (last-writer-wins dengan jam Lamport). Karena itu urutan pesan
// tidak penting, dan saat koneksi pulih cukup kirim ulang seluruh snapshot untuk menyamakan keadaan.

import { STICKERS } from './lib/stickers.js';
import { TEMPLATES, DEFAULT_TEMPLATE } from './lib/templates.js';
import { clamp, rid } from './lib/util.js';
import { MIN_SHOTS, MAX_SHOTS } from './lib/layout.js';

export class SharedState extends EventTarget {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.clock = 0;
    this.map = new Map();
    /** @type {null | ((ops: object[]) => void)} */
    this.onLocalOps = null;
  }

  get(key, dflt) {
    const e = this.map.get(key);
    return e === undefined ? dflt : e.v;
  }

  set(key, value) {
    this.setMany({ [key]: value });
  }

  setMany(obj) {
    const ops = [];
    for (const [k, v] of Object.entries(obj)) {
      const ts = ++this.clock;
      this.map.set(k, { v, ts, by: this.clientId });
      ops.push({ k, v, ts, by: this.clientId });
    }
    if (!ops.length) return;
    this._emit(ops.map((o) => o.k), true);
    if (this.onLocalOps) this.onLocalOps(ops);
  }

  /** Terapkan operasi dari pasangan. Mengembalikan daftar kunci yang berubah. */
  apply(ops) {
    if (!Array.isArray(ops)) return [];
    const changed = [];
    for (const op of ops) {
      if (!op || typeof op.k !== 'string' || op.k.length > 40 || !Number.isFinite(op.ts) || typeof op.by !== 'string') continue;
      this.clock = Math.max(this.clock, op.ts);
      const cur = this.map.get(op.k);
      if (!cur || op.ts > cur.ts || (op.ts === cur.ts && op.by > cur.by)) {
        this.map.set(op.k, { v: op.v, ts: op.ts, by: op.by });
        changed.push(op.k);
      }
    }
    if (changed.length) this._emit(changed, false);
    return changed;
  }

  snapshot() {
    return [...this.map].map(([k, e]) => ({ k, v: e.v, ts: e.ts, by: e.by }));
  }

  /** Kosongkan semuanya (saat keluar dari room). */
  clear() {
    this.map.clear();
    this.clock = 0;
    this._emit(['*'], false);
  }

  _emit(keys, local) {
    this.dispatchEvent(new CustomEvent('change', { detail: { keys, local } }));
  }
}

// ---------------------------------------------------------------------------
// Validasi nilai dari jaringan -> tampilan yang aman untuk digambar
// ---------------------------------------------------------------------------
const num = (v, d, a, b) => (Number.isFinite(v) ? clamp(v, a, b) : d);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeSpec(s) {
  if (!s || typeof s !== 'object') return null;
  switch (s.type) {
    case 'solid':
      return HEX.test(s.color) ? { type: 'solid', color: s.color } : null;
    case 'gradient':
      return HEX.test(s.from) && HEX.test(s.to) ? { type: 'gradient', from: s.from, to: s.to, angle: num(s.angle, 160, 0, 360) } : null;
    case 'pattern':
      return ['dots', 'stripes', 'checks', 'hearts', 'stars', 'paws', 'bones', 'zigzag'].includes(s.kind) && HEX.test(s.base) && HEX.test(s.accent)
        ? { type: 'pattern', kind: s.kind, base: s.base, accent: s.accent }
        : null;
    case 'scene':
      return ['sky', 'sunset', 'night', 'bamboo', 'bokeh'].includes(s.kind) ? { type: 'scene', kind: s.kind } : null;
    case 'image':
      return typeof s.id === 'string' && /^[A-Za-z0-9_-]{4,16}$/.test(s.id) ? { type: 'image', id: s.id } : null;
    default:
      return null;
  }
}

export function sanitizeSticker(o) {
  if (!o || typeof o !== 'object') return null;
  if (!STICKERS[o.s] || typeof o.id !== 'string') return null;
  return {
    id: o.id.slice(0, 16),
    s: o.s,
    fx: num(o.fx, 0.5, -0.1, 1.1),
    fy: num(o.fy, 0.5, -0.1, 1.1),
    size: num(o.size, 120, 24, 520),
    rot: num(o.rot, 0, -3600, 3600),
    flip: !!o.flip,
    z: num(o.z, 0, -1e6, 1e9),
  };
}

export function isImageDataUrl(v) {
  return typeof v === 'string' && v.length < 3_000_000 && /^data:image\/(jpeg|png|webp);base64,/.test(v);
}

export const DEFAULTS = {
  template: DEFAULT_TEMPLATE,
  shots: 4,
  timer: 3,
  mirror: true,
  decor: true,
  showDate: true,
};

/** Bangun objek tampilan untuk renderer dari state bersama. */
export function buildView(shared, extras = {}) {
  const g = (k, d) => shared.get(k, d);
  const tplId = TEMPLATES.some((t) => t.id === g('template')) ? g('template') : DEFAULTS.template;
  const stickers = [];
  for (const [k, e] of shared.map) {
    if (!k.startsWith('stk:') || !e.v) continue;
    const s = sanitizeSticker(e.v);
    if (s) stickers.push(s);
    if (stickers.length >= 80) break;
  }
  stickers.sort((a, b) => a.z - b.z);
  const title = g('title', null);
  const caption = g('caption', null);
  return {
    shots: Math.round(num(g('shots', DEFAULTS.shots), 4, MIN_SHOTS, MAX_SHOTS)),
    timer: [3, 5, 10].includes(g('timer')) ? g('timer') : DEFAULTS.timer,
    template: tplId,
    bg: sanitizeSpec(g('bg', null)),
    photoBg: sanitizeSpec(g('photoBg', null)),
    title: typeof title === 'string' ? title.slice(0, 60) : null,
    caption: typeof caption === 'string' ? caption.slice(0, 60) : null,
    showDate: g('showDate', DEFAULTS.showDate) !== false,
    date: str(g('date', ''), 40),
    names: { host: str(g('name:host', ''), 24), guest: str(g('name:guest', ''), 24) },
    mirror: g('mirror', DEFAULTS.mirror) !== false,
    decor: g('decor', DEFAULTS.decor) !== false,
    stickers,
    frames: extras.frames || [],
  };
}

// ---------------------------------------------------------------------------
// Operasi stiker
// ---------------------------------------------------------------------------
export function newStickerId() {
  return rid(8);
}

export function nextZ(shared) {
  let max = 0;
  for (const [k, e] of shared.map) if (k.startsWith('stk:') && e.v && Number.isFinite(e.v.z)) max = Math.max(max, e.v.z);
  return max + 1;
}

export function minZ(shared) {
  let min = 0;
  for (const [k, e] of shared.map) if (k.startsWith('stk:') && e.v && Number.isFinite(e.v.z)) min = Math.min(min, e.v.z);
  return min - 1;
}

export function stickerCount(shared) {
  let n = 0;
  for (const [k, e] of shared.map) if (k.startsWith('stk:') && e.v) n++;
  return n;
}
