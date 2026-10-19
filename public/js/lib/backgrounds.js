// Latar belakang: warna polos, gradasi, pola, pemandangan (digambar lewat kode), dan gambar unggahan.
// Dipakai untuk latar strip dan juga latar di belakang orang (ganti background foto).

import { mulberry32, hexToRgb, luma, clamp } from './util.js';

// ---------------------------------------------------------------------------
// Pilihan yang ditampilkan di panel
// ---------------------------------------------------------------------------
export const SOLID_COLORS = [
  '#ffc8dd', '#ffafcc', '#ff8fab', '#ffd6a5', '#ffe5a0', '#fdffb6',
  '#d4f4c4', '#a8e6cf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#e0bbff',
  '#ffc6ff', '#ffffff', '#fff1e6', '#f3e9dc', '#cfd8dc', '#8d99ae',
  '#ef476f', '#ff9f1c', '#06d6a0', '#118ab2', '#3d405b', '#2b2d42',
];

export const GRADIENTS = [
  { from: '#ffd6e0', to: '#ffe9c9', angle: 160 },
  { from: '#ff9a9e', to: '#fecfef', angle: 135 },
  { from: '#a1c4fd', to: '#c2e9fb', angle: 160 },
  { from: '#c4b5fd', to: '#fbcfe8', angle: 150 },
  { from: '#a8edea', to: '#fed6e3', angle: 140 },
  { from: '#fff3b0', to: '#ffb88c', angle: 165 },
  { from: '#d4fc79', to: '#96e6a1', angle: 150 },
  { from: '#fbc2eb', to: '#a6c1ee', angle: 140 },
  { from: '#667eea', to: '#764ba2', angle: 150 },
  { from: '#2b2d5a', to: '#6a4c93', angle: 160 },
  { from: '#f6d365', to: '#fda085', angle: 150 },
  { from: '#84fab0', to: '#8fd3f4', angle: 140 },
].map((g) => ({ type: 'gradient', ...g }));

export const PATTERNS = [
  { kind: 'dots', base: '#ffd6e0', accent: '#ffb3c6' },
  { kind: 'hearts', base: '#ffe5ec', accent: '#ffb3c6' },
  { kind: 'stars', base: '#e7f0ff', accent: '#bcd4ff' },
  { kind: 'stripes', base: '#fff1e6', accent: '#ffd6a5' },
  { kind: 'checks', base: '#ffffff', accent: '#ffd6e7' },
  { kind: 'zigzag', base: '#e8fff3', accent: '#b6f0d0' },
  { kind: 'paws', base: '#fff0e1', accent: '#ffd9b8' },
  { kind: 'bones', base: '#e6f4ff', accent: '#c3e1f8' },
  { kind: 'dots', base: '#2b2d42', accent: '#3f4263' },
  { kind: 'hearts', base: '#ff8fab', accent: '#ffb3c6' },
  { kind: 'stars', base: '#3d405b', accent: '#5b5f86' },
  { kind: 'paws', base: '#f1f0ea', accent: '#e2e0d6' },
].map((p) => ({ type: 'pattern', ...p }));

export const SCENES = [
  { type: 'scene', kind: 'sky', name: 'Langit' },
  { type: 'scene', kind: 'sunset', name: 'Senja' },
  { type: 'scene', kind: 'night', name: 'Malam' },
  { type: 'scene', kind: 'bamboo', name: 'Hutan Bambu' },
  { type: 'scene', kind: 'bokeh', name: 'Bokeh' },
];

const SCENE_DARK = { sky: false, sunset: true, night: true, bamboo: false, bokeh: false };

/** Dua spec dianggap sama bila isinya sama (untuk menandai pilihan aktif). */
export function sameSpec(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Pembantu menggambar
// ---------------------------------------------------------------------------
function heartAt(ctx, cx, cy, s) {
  const k = s / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + k * 0.95);
  ctx.bezierCurveTo(cx - k * 1.35, cy + k * 0.05, cx - k * 1.15, cy - k * 1.05, cx, cy - k * 0.4);
  ctx.bezierCurveTo(cx + k * 1.15, cy - k * 1.05, cx + k * 1.35, cy + k * 0.05, cx, cy + k * 0.95);
  ctx.closePath();
  ctx.fill();
}

function starAt(ctx, cx, cy, R, r = R * 0.45, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function sparkleAt(ctx, cx, cy, R) {
  const c = R * 0.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - R);
  ctx.quadraticCurveTo(cx + c, cy - c, cx + R, cy);
  ctx.quadraticCurveTo(cx + c, cy + c, cx, cy + R);
  ctx.quadraticCurveTo(cx - c, cy + c, cx - R, cy);
  ctx.quadraticCurveTo(cx - c, cy - c, cx, cy - R);
  ctx.closePath();
  ctx.fill();
}

function pawAt(ctx, cx, cy, s, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const u = s / 100;
  ctx.beginPath();
  ctx.ellipse(0, 16 * u, 24 * u, 20 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [[-30, -14, -0.45], [-11, -34, -0.12], [11, -34, 0.12], [30, -14, 0.45]];
  for (const [tx, ty, tr] of toes) {
    ctx.beginPath();
    ctx.ellipse(tx * u, ty * u, 9 * u, 13 * u, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function boneAt(ctx, cx, cy, s, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const u = s / 100;
  const L = 34 * u;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-L, -7 * u, L * 2, 14 * u, 6 * u) : ctx.rect(-L, -7 * u, L * 2, 14 * u);
  ctx.fill();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * L, sy * 8 * u, 9 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function cloudAt(ctx, cx, cy, s, alpha = 0.95) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 30 * s, 0, Math.PI * 2);
  ctx.arc(cx - 36 * s, cy + 10 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(cx + 38 * s, cy + 8 * s, 25 * s, 0, Math.PI * 2);
  ctx.arc(cx - 10 * s, cy - 18 * s, 24 * s, 0, Math.PI * 2);
  ctx.arc(cx + 18 * s, cy - 14 * s, 20 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(cx - 58 * s, cy + 6 * s, 118 * s, 26 * s);
  ctx.fill();
  ctx.restore();
}

function linearGradient(ctx, x, y, w, h, angleDeg, stops) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

// ---------------------------------------------------------------------------
// Pola
// ---------------------------------------------------------------------------
function drawPattern(ctx, spec, x, y, w, h) {
  const { kind, base, accent } = spec;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  const S = 64;

  if (kind === 'stripes') {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-Math.PI / 4);
    const span = Math.hypot(w, h);
    for (let i = -span; i < span; i += S * 0.8) ctx.fillRect(i, -span, S * 0.4, span * 2);
    ctx.restore();
    return;
  }
  if (kind === 'checks') {
    const c = S * 0.75;
    for (let j = 0; j * c < h + c; j++) {
      for (let i = 0; i * c < w + c; i++) {
        if ((i + j) % 2 === 0) ctx.fillRect(x + i * c, y + j * c, c, c);
      }
    }
    return;
  }
  if (kind === 'zigzag') {
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const amp = 12;
    const step = 22;
    for (let yy = y + 20; yy < y + h + S; yy += S * 0.7) {
      ctx.beginPath();
      let up = false;
      for (let xx = x - step; xx < x + w + step; xx += step) {
        const py = yy + (up ? -amp : amp);
        if (xx === x - step) ctx.moveTo(xx, py);
        else ctx.lineTo(xx, py);
        up = !up;
      }
      ctx.stroke();
    }
    return;
  }

  let row = 0;
  for (let yy = y + S / 2; yy < y + h + S; yy += S * 0.9, row++) {
    const off = row % 2 ? S / 2 : 0;
    let col = 0;
    for (let xx = x + off; xx < x + w + S; xx += S, col++) {
      const k = row * 7 + col * 3;
      if (kind === 'dots') {
        ctx.beginPath();
        ctx.arc(xx, yy, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'hearts') heartAt(ctx, xx, yy, 24);
      else if (kind === 'stars') starAt(ctx, xx, yy, 12);
      else if (kind === 'paws') pawAt(ctx, xx, yy, 34, ((k % 3) - 1) * 0.5);
      else if (kind === 'bones') boneAt(ctx, xx, yy, 46, ((k % 3) - 1) * 0.6 + 0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// Pemandangan
// ---------------------------------------------------------------------------
function drawScene(ctx, spec, x, y, w, h) {
  const kind = spec.kind;
  const u = w / 600;
  const rng = mulberry32(kind.length * 7919 + 13);
  ctx.save();
  ctx.translate(x, y);

  if (kind === 'sky') {
    ctx.fillStyle = linearGradient(ctx, 0, 0, w, h, 180, [[0, '#62b8f7'], [0.55, '#a5dcff'], [1, '#e6f7ff']]);
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.85, h * 0.05, 0, w * 0.85, h * 0.05, w * 0.7);
    glow.addColorStop(0, 'rgba(255,255,255,.65)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const count = Math.max(4, Math.round(h / (230 * u)));
    for (let i = 0; i < count; i++) {
      const cy = ((i + 0.5) / count) * h + (rng() - 0.5) * 80 * u;
      const cx = (i % 2 ? 0.2 : 0.8) * w + (rng() - 0.5) * 160 * u;
      cloudAt(ctx, cx, cy, (0.9 + rng() * 0.9) * u, 0.92);
    }
  } else if (kind === 'sunset') {
    ctx.fillStyle = linearGradient(ctx, 0, 0, w, h, 180, [[0, '#3a3a8c'], [0.42, '#b8509f'], [0.74, '#ff8f6b'], [1, '#ffd27d']]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 46; i++) {
      ctx.globalAlpha = 0.25 + rng() * 0.7;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h * 0.45, (0.6 + rng() * 1.6) * u * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const sun = ctx.createRadialGradient(w * 0.5, h * 0.9, 0, w * 0.5, h * 0.9, w * 0.55);
    sun.addColorStop(0, 'rgba(255,244,205,.95)');
    sun.addColorStop(0.35, 'rgba(255,214,150,.55)');
    sun.addColorStop(1, 'rgba(255,170,120,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,50,120,.28)';
    for (let i = 0; i < Math.max(3, Math.round(h / 420)); i++) {
      ctx.beginPath();
      ctx.ellipse(rng() * w, h * (0.25 + rng() * 0.5), (90 + rng() * 120) * u, (10 + rng() * 10) * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'night') {
    ctx.fillStyle = linearGradient(ctx, 0, 0, w, h, 180, [[0, '#0d1130'], [1, '#2f2a76']]);
    ctx.fillRect(0, 0, w, h);
    const n = Math.round((w * h) / 4200);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.35 + rng() * 0.65;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, (0.5 + rng() * 1.8) * u * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff6c9';
    for (let i = 0; i < Math.max(4, Math.round(h / 300)); i++) sparkleAt(ctx, rng() * w, rng() * h, (5 + rng() * 6) * u);
    ctx.globalAlpha = 1;
    // bulan sabit lewat kanvas sementara
    const r = Math.max(24, 0.1 * w);
    const m = document.createElement('canvas');
    m.width = m.height = Math.ceil(r * 2 + 6);
    const mc = m.getContext('2d');
    mc.fillStyle = '#ffeaa0';
    mc.beginPath();
    mc.arc(m.width / 2, m.height / 2, r, 0, Math.PI * 2);
    mc.fill();
    mc.globalCompositeOperation = 'destination-out';
    mc.beginPath();
    mc.arc(m.width / 2 + r * 0.42, m.height / 2 - r * 0.2, r * 0.86, 0, Math.PI * 2);
    mc.fill();
    ctx.shadowColor = 'rgba(255,238,170,.7)';
    ctx.shadowBlur = 24 * u;
    ctx.drawImage(m, w * 0.8 - m.width / 2, h * 0.07 - m.height / 2 + r * 0.4);
    ctx.shadowBlur = 0;
  } else if (kind === 'bamboo') {
    ctx.fillStyle = linearGradient(ctx, 0, 0, w, h, 180, [[0, '#f0fae6'], [1, '#c8e8b8']]);
    ctx.fillRect(0, 0, w, h);
    const greens = ['#9bd18a', '#84c272', '#a8dc98', '#76b865'];
    const count = Math.max(6, Math.round(w / (70 * u)));
    for (let i = 0; i < count; i++) {
      const sw = (14 + rng() * 22) * u;
      const sx = ((i + 0.3 + rng() * 0.4) / count) * w;
      const col = greens[i % greens.length];
      ctx.globalAlpha = 0.55 + rng() * 0.35;
      ctx.fillStyle = col;
      ctx.fillRect(sx - sw / 2, 0, sw, h);
      ctx.fillStyle = 'rgba(40,110,60,.55)';
      for (let ny = (60 + rng() * 80) * u; ny < h; ny += (120 + rng() * 60) * u) {
        ctx.fillRect(sx - sw / 2 - 2, ny, sw + 4, 6 * u);
        if (rng() > 0.45) {
          ctx.save();
          ctx.translate(sx, ny);
          ctx.rotate((rng() > 0.5 ? -1 : 1) * (0.3 + rng() * 0.5));
          ctx.fillStyle = 'rgba(70,150,80,.75)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(40 * u, -34 * u, 96 * u, -20 * u);
          ctx.quadraticCurveTo(54 * u, 10 * u, 0, 0);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'bokeh') {
    ctx.fillStyle = linearGradient(ctx, 0, 0, w, h, 160, [[0, '#ffd1e8'], [1, '#cdbdff']]);
    ctx.fillRect(0, 0, w, h);
    const n = Math.round((w * h) / 9000);
    for (let i = 0; i < n; i++) {
      const r = (14 + rng() * 44) * u;
      const cx = rng() * w;
      const cy = rng() * h;
      const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      const a = 0.14 + rng() * 0.22;
      g.addColorStop(0, `rgba(255,255,255,${a * 0.6})`);
      g.addColorStop(0.85, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#ffc8dd';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Gambar unggahan (mengisi area, dipotong di tengah)
// ---------------------------------------------------------------------------
export function drawCover(ctx, img, dx, dy, dw, dh, fx = 0.5, fy = 0.5) {
  const sw = img.naturalWidth || img.videoWidth || img.width;
  const sh = img.naturalHeight || img.videoHeight || img.height;
  if (!sw || !sh) return;
  const s = Math.max(dw / sw, dh / sh);
  const vw = dw / s;
  const vh = dh / s;
  const sx = (sw - vw) * clamp(fx, 0, 1);
  const sy = (sh - vh) * clamp(fy, 0, 1);
  ctx.drawImage(img, sx, sy, vw, vh, dx, dy, dw, dh);
}

// ---------------------------------------------------------------------------
// API utama
// ---------------------------------------------------------------------------
/**
 * Gambar latar ke area (x, y, w, h).
 * env.image(id) -> gambar unggahan yang sudah dimuat (atau null)
 */
export function drawBackdrop(ctx, spec, x, y, w, h, env = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const s = spec || { type: 'solid', color: '#ffc8dd' };
  switch (s.type) {
    case 'gradient':
      ctx.fillStyle = linearGradient(ctx, x, y, w, h, s.angle ?? 160, [[0, s.from], [1, s.to]]);
      ctx.fillRect(x, y, w, h);
      break;
    case 'pattern':
      drawPattern(ctx, s, x, y, w, h);
      break;
    case 'scene':
      drawScene(ctx, s, x, y, w, h);
      break;
    case 'image': {
      const img = env.image ? env.image(s.id) : null;
      if (img) drawCover(ctx, img, x, y, w, h);
      else {
        ctx.fillStyle = '#e9e4ec';
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
    case 'solid':
    default:
      ctx.fillStyle = s.color || '#ffc8dd';
      ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Perkiraan kecerahan 0..1 untuk memilih warna teks yang kontras. */
export function specLuma(spec, env = {}) {
  if (!spec) return 0.8;
  switch (spec.type) {
    case 'solid':
      return luma(spec.color || '#ffffff');
    case 'gradient':
      return (luma(spec.from) + luma(spec.to)) / 2;
    case 'pattern':
      return luma(spec.base);
    case 'scene':
      return SCENE_DARK[spec.kind] ? 0.2 : 0.85;
    case 'image':
      return env.imageLuma ? env.imageLuma(spec.id) : 0.6;
    default:
      return 0.8;
  }
}

/** CSS background kecil untuk swatch di panel (tanpa kanvas). */
export function specCss(spec) {
  if (!spec) return '#fff';
  if (spec.type === 'solid') return spec.color;
  if (spec.type === 'gradient') return `linear-gradient(${spec.angle ?? 160}deg, ${spec.from}, ${spec.to})`;
  if (spec.type === 'pattern') return spec.base;
  return '#ddd';
}

export function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
