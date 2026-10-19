// Kanvas strip foto. Mode pratinjau (tanpa interaksi) atau mode editor (stiker bisa digeser,
// diubah ukuran/diputar lewat handle, dicubit dengan dua jari, dan dihapus).

import { el } from '../lib/util.js';
import { computeLayout } from '../lib/layout.js';
import { renderStrip } from '../lib/render.js';
import { STICKERS } from '../lib/stickers.js';
import { onAssetLoad } from '../lib/assets.js';
import { readSticker, patchSticker, removeSticker, MIN_SIZE, MAX_SIZE } from '../lib/stickerops.js';
import { clamp } from '../lib/util.js';

const HANDLE_R = 13; // jari-jari handle dalam piksel layar
const HIT_R = 20; // area sentuh handle (px layar)

export class StripView {
  /**
   * @param {import('../app.js').App} app
   * @param {{interactive?: boolean, sizing: () => {maxW: number, maxH: number}}} opts
   */
  constructor(app, { interactive = false, sizing }) {
    this.app = app;
    this.interactive = interactive;
    this.sizing = sizing;
    this.canvas = el('canvas', { class: 'strip-canvas', 'aria-label': 'Pratinjau strip foto', role: 'img' });
    this.el = el('div', { class: 'strip-holder' }, [this.canvas]);
    this.selected = null;
    this.onSelect = null;
    this._raf = 0;
    this._view = null;
    this._L = null;
    this._cssW = 300;
    this._pointers = new Map();
    this._mode = null;
  }

  // --- siklus hidup ---------------------------------------------------------------------
  mount() {
    const app = this.app;
    this._unsubs = [
      app.on('state', () => this.invalidate()),
      app.on('session', () => this.invalidate()),
      app.on('cutouts', () => this.invalidate()),
      onAssetLoad(() => this.invalidate()),
    ];
    this._ro = new ResizeObserver(() => this.layout());
    if (this.el.parentElement) this._ro.observe(this.el.parentElement);
    this._onWinResize = () => this.layout();
    window.addEventListener('resize', this._onWinResize);
    if (this.interactive) {
      this._bind();
      window.__duoStrip = this; // hook debug/pengujian
    }
    this.layout();
  }

  destroy() {
    for (const u of this._unsubs || []) u();
    this._ro && this._ro.disconnect();
    window.removeEventListener('resize', this._onWinResize);
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (window.__duoStrip === this) window.__duoStrip = null;
  }

  // --- ukuran & gambar --------------------------------------------------------------------
  layout() {
    const { maxW, maxH } = this.sizing();
    const shots = this.app.view().shots;
    const L = computeLayout(shots);
    const ratio = L.H / L.W;
    let w = Math.min(maxW, Number.isFinite(maxH) ? maxH / ratio : maxW);
    w = Math.max(90, Math.floor(w));
    const h = Math.round(w * ratio);
    this._cssW = w;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.min(900, Math.round(w * dpr));
    this.canvas.width = bw;
    this.canvas.height = Math.round(bw * ratio);
    this.invalidate();
  }

  invalidate() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.render();
    });
  }

  render() {
    const v = this.app.view();
    const L = computeLayout(v.shots);
    const ratio = L.H / L.W;
    // jumlah foto berubah -> ukuran kanvas ikut berubah
    if (Math.abs(this.canvas.height - Math.round(this.canvas.width * ratio)) > 1) {
      this.layout();
      return;
    }
    this._view = v;
    this._L = L;
    if (this.selected && !v.stickers.some((s) => s.id === this.selected)) this.select(null);
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    renderStrip(ctx, v, {
      scale: this.canvas.width / L.W,
      env: this.app.env,
      overlay: this.interactive ? (c, layout) => this._drawSelection(c, layout) : null,
    });
  }

  // --- pilihan -------------------------------------------------------------------------------
  select(id) {
    if (this.selected === id) return;
    this.selected = id;
    this.invalidate();
    if (this.onSelect) this.onSelect(id);
  }

  /** Pecahan tinggi strip yang sedang terlihat di layar (untuk menaruh stiker baru). */
  visibleCenter() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.height) return { fx: 0.5, fy: 0.5 };
    const top = Math.max(0, -r.top);
    const bottom = Math.min(r.height, window.innerHeight - r.top);
    const fy = bottom > top ? (top + bottom) / 2 / r.height : 0.5;
    return { fx: 0.5, fy: clamp(fy, 0.1, 0.9) };
  }

  // --- geometri ---------------------------------------------------------------------------------
  _box(s) {
    const def = STICKERS[s.s];
    const L = this._L;
    return { cx: s.fx * L.W, cy: s.fy * L.H, w: s.size, h: s.size * (def ? def.aspect : 1), rot: (s.rot * Math.PI) / 180 };
  }

  _toLocal(p, b) {
    const dx = p.x - b.cx;
    const dy = p.y - b.cy;
    const c = Math.cos(-b.rot);
    const s = Math.sin(-b.rot);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  _fromLocal(x, y, b) {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    return { x: b.cx + x * c - y * s, y: b.cy + x * s + y * c };
  }

  get _k() {
    // satuan logis per piksel layar
    return this._L ? this._L.W / this._cssW : 1;
  }

  _point(ev) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * this._L.W, y: ((ev.clientY - r.top) / r.height) * this._L.H };
  }

  _selectedSticker() {
    return this._view && this.selected ? this._view.stickers.find((s) => s.id === this.selected) || null : null;
  }

  _hitHandle(p) {
    const s = this._selectedSticker();
    if (!s) return null;
    const b = this._box(s);
    const r = HIT_R * this._k;
    const del = this._fromLocal(-b.w / 2, -b.h / 2, b);
    const scl = this._fromLocal(b.w / 2, b.h / 2, b);
    if (Math.hypot(p.x - scl.x, p.y - scl.y) <= r) return 'scale';
    if (Math.hypot(p.x - del.x, p.y - del.y) <= r) return 'delete';
    return null;
  }

  _hitSticker(p) {
    if (!this._view) return null;
    const list = this._view.stickers;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const b = this._box(s);
      const l = this._toLocal(p, b);
      const pad = 4 * this._k;
      if (Math.abs(l.x) <= b.w / 2 + pad && Math.abs(l.y) <= b.h / 2 + pad) return s;
    }
    return null;
  }

  // --- gambar pilihan ---------------------------------------------------------------------------
  _drawSelection(ctx) {
    const s = this._selectedSticker();
    if (!s) return;
    const b = this._box(s);
    const k = this._k;
    ctx.save();
    ctx.translate(b.cx, b.cy);
    ctx.rotate(b.rot);
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = '#ff4f8b';
    ctx.setLineDash([7 * k, 5 * k]);
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.setLineDash([]);

    const r = HANDLE_R * k;
    // hapus (kiri atas)
    ctx.beginPath();
    ctx.arc(-b.w / 2, -b.h / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2 * k;
    ctx.stroke();
    ctx.beginPath();
    const d = r * 0.42;
    ctx.moveTo(-b.w / 2 - d, -b.h / 2 - d);
    ctx.lineTo(-b.w / 2 + d, -b.h / 2 + d);
    ctx.moveTo(-b.w / 2 + d, -b.h / 2 - d);
    ctx.lineTo(-b.w / 2 - d, -b.h / 2 + d);
    ctx.lineWidth = 2.4 * k;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ubah ukuran + putar (kanan bawah)
    ctx.beginPath();
    ctx.arc(b.w / 2, b.h / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4f8b';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.2 * k;
    ctx.beginPath();
    ctx.arc(b.w / 2, b.h / 2, r * 0.5, Math.PI * 0.15, Math.PI * 1.45);
    ctx.stroke();
    const ax = b.w / 2 + Math.cos(Math.PI * 1.45) * r * 0.5;
    const ay = b.h / 2 + Math.sin(Math.PI * 1.45) * r * 0.5;
    ctx.beginPath();
    ctx.moveTo(ax - r * 0.32, ay + r * 0.05);
    ctx.lineTo(ax + r * 0.05, ay - r * 0.3);
    ctx.lineTo(ax + r * 0.3, ay + r * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  // --- interaksi ----------------------------------------------------------------------------------
  _bind() {
    const c = this.canvas;
    c.style.touchAction = 'pan-y';
    c.addEventListener('touchstart', (ev) => {
      if (!this._L) return;
      this._sync();
      if (ev.touches.length > 1 && this.selected) return ev.preventDefault();
      const t = ev.touches[0];
      const p = this._point(t);
      if (this._hitHandle(p) || this._hitSticker(p)) ev.preventDefault();
    }, { passive: false });
    c.addEventListener('touchmove', (ev) => {
      if (this._mode) ev.preventDefault();
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', (e) => this._up(e));
  }

  /** Ambil state terbaru (render dijadwalkan per frame, jadi cache bisa tertinggal sesaat). */
  _sync() {
    const v = this.app.view();
    this._view = v;
    this._L = computeLayout(v.shots);
  }

  _down(e) {
    if (!this._L || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this._sync();
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* abaikan */
    }
    const s = this._selectedSticker();

    if (this._pointers.size === 2 && s) {
      const [a, b] = [...this._pointers.values()];
      this._mode = {
        type: 'pinch',
        id: s.id,
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        ang: Math.atan2(b.y - a.y, b.x - a.x),
        size: s.size,
        rot: s.rot,
      };
      return;
    }
    if (this._pointers.size > 1) return;

    const p = this._point(e);
    const handle = this._hitHandle(p);
    if (handle === 'delete') {
      removeSticker(this.app.shared, s.id);
      this.select(null);
      this._mode = null;
      return;
    }
    if (handle === 'scale') {
      const b = this._box(s);
      this._mode = {
        type: 'scale',
        id: s.id,
        dist: Math.hypot(p.x - b.cx, p.y - b.cy) || 1,
        ang: Math.atan2(p.y - b.cy, p.x - b.cx),
        size: s.size,
        rot: s.rot,
      };
      return;
    }
    const hit = this._hitSticker(p);
    if (hit) {
      this.select(hit.id);
      const b = this._box(hit);
      this._mode = { type: 'drag', id: hit.id, dx: p.x - b.cx, dy: p.y - b.cy };
    } else {
      this.select(null);
      this._mode = null;
    }
  }

  _move(e) {
    if (!this._L) return;
    if (this._pointers.has(e.pointerId)) this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = this._mode;
    if (!m) {
      if (e.pointerType === 'mouse') this._hover(e);
      return;
    }
    const shared = this.app.shared;
    if (m.type === 'drag') {
      const p = this._point(e);
      patchSticker(shared, m.id, { fx: (p.x - m.dx) / this._L.W, fy: (p.y - m.dy) / this._L.H });
    } else if (m.type === 'scale') {
      const p = this._point(e);
      const s = readSticker(shared, m.id);
      if (!s) return;
      const b = this._box(s);
      const dist = Math.hypot(p.x - b.cx, p.y - b.cy);
      const ang = Math.atan2(p.y - b.cy, p.x - b.cx);
      let rot = m.rot + ((ang - m.ang) * 180) / Math.PI;
      if (Math.abs(((rot % 360) + 360) % 360) < 3 || Math.abs(((rot % 360) + 360) % 360 - 360) < 3) rot = Math.round(rot / 360) * 360;
      patchSticker(shared, m.id, { size: clamp((m.size * dist) / m.dist, MIN_SIZE, MAX_SIZE), rot });
    } else if (m.type === 'pinch' && this._pointers.size >= 2) {
      const [a, b] = [...this._pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      patchSticker(shared, m.id, {
        size: clamp((m.size * dist) / m.dist, MIN_SIZE, MAX_SIZE),
        rot: m.rot + ((ang - m.ang) * 180) / Math.PI,
      });
    }
  }

  _up(e) {
    this._pointers.delete(e.pointerId);
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* abaikan */
    }
    if (this._pointers.size === 0) this._mode = null;
    else if (this._mode && this._mode.type === 'pinch') this._mode = null;
  }

  _hover(e) {
    const p = this._point(e);
    const h = this._hitHandle(p);
    this.canvas.style.cursor = h === 'scale' ? 'nwse-resize' : h === 'delete' ? 'pointer' : this._hitSticker(p) ? 'grab' : 'default';
  }
}
