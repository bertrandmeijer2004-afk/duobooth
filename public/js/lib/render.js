// Menggambar strip foto. Fungsi yang sama dipakai untuk pratinjau, thumbnail template, dan ekspor PNG.

import { computeLayout, photoRects } from './layout.js';
import { getTemplate, resolveDecor } from './templates.js';
import { drawBackdrop, drawCover, specLuma } from './backgrounds.js';
import { STICKERS } from './stickers.js';

export const FONT = '"Fredoka", "Baloo 2", "Nunito", ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Warna teks otomatis: terang di latar gelap, gelap di latar terang. */
export function inkFor(luma, tpl) {
  return luma < 0.5
    ? { fill: '#ffffff', stroke: 'rgba(24,18,56,.78)' }
    : { fill: tpl.ink, stroke: '#ffffff' };
}

function setFont(ctx, weight, size) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** Ukuran font terbesar (<= size) yang membuat semua baris muat dalam maxW. */
function fitSize(ctx, lines, weight, size, minSize, maxW) {
  let s = size;
  setFont(ctx, weight, s);
  while (s > minSize && lines.some((l) => ctx.measureText(l).width > maxW)) {
    s -= 1;
    setFont(ctx, weight, s);
  }
  return s;
}

/** Pecah teks jadi dua baris yang paling seimbang (pada spasi). null bila tidak ada spasi. */
function balancedSplit(ctx, text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { w, lines: [a, b] };
  }
  return best.lines;
}

function drawLabel(ctx, text, x, y, { size, weight = 700, maxW, fill, stroke, strokeW, minSize = 14, maxLines = 1 }) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let lines = [text];
  let s = fitSize(ctx, lines, weight, size, minSize, maxW);
  // Bila satu baris jadi terlalu kecil, coba dua baris dengan huruf lebih besar.
  if (maxLines > 1 && s < size * 0.78) {
    setFont(ctx, weight, size);
    const two = balancedSplit(ctx, text);
    if (two) {
      const s2 = fitSize(ctx, two, weight, size, minSize, maxW);
      if (s2 > s) {
        lines = two;
        s = s2;
      }
    }
  }
  setFont(ctx, weight, s);
  lines = lines.map((l) => {
    let t = l;
    while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
    return t !== l ? t.trimEnd() + '…' : t;
  });

  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  const lh = s * 1.08;
  lines.forEach((l, i) => {
    const ly = y + (i - (lines.length - 1) / 2) * lh;
    ctx.strokeText(l, x, ly);
    ctx.fillText(l, x, ly);
  });
  ctx.restore();
}

function drawPlaceholder(ctx, r, transparent) {
  if (!transparent) {
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, 'rgba(255,255,255,.88)');
    g.addColorStop(1, 'rgba(255,255,255,.6)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = transparent ? 'rgba(255,255,255,.55)' : 'rgba(150,120,175,.26)';
  const cx = r.x + r.w / 2;
  ctx.beginPath();
  ctx.arc(cx, r.y + r.h * 0.4, r.w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, r.y + r.h, r.w * 0.38, r.h * 0.3, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPerson(ctx, item, rect, mirror, usePhotoBg) {
  let source = null;
  if (item) source = usePhotoBg && item.cutout ? item.cutout : item.img;
  if (!source) {
    drawPlaceholder(ctx, rect, usePhotoBg);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (mirror) {
    ctx.translate(rect.x + rect.w, rect.y);
    ctx.scale(-1, 1);
    drawCover(ctx, source, 0, 0, rect.w, rect.h, 0.5, 0.35);
  } else {
    drawCover(ctx, source, rect.x, rect.y, rect.w, rect.h, 0.5, 0.35);
  }
  ctx.restore();
}

function drawFrame(ctx, k, L, view, tpl, env, scale) {
  const f = L.frames[k];
  const R = photoRects(f, L);

  ctx.save();
  ctx.shadowColor = 'rgba(48,24,60,.24)';
  ctx.shadowBlur = 16 * scale;
  ctx.shadowOffsetY = 5 * scale;
  ctx.fillStyle = tpl.frame;
  roundRectPath(ctx, f.x, f.y, f.w, f.h, L.radius);
  ctx.fill();
  ctx.restore();

  const innerRadius = Math.max(4, L.radius - L.border);
  ctx.save();
  roundRectPath(ctx, R.inner.x, R.inner.y, R.inner.w, R.inner.h, innerRadius);
  ctx.clip();

  const fr = (view.frames && view.frames[k]) || {};
  const usePhotoBg = !!(view.photoBg && view.photoBg.type);
  let host = R.host;
  let guest = R.guest;
  if (usePhotoBg) {
    // satu latar bersama, tanpa pembatas, supaya terlihat satu pemandangan
    drawBackdrop(ctx, view.photoBg, R.inner.x, R.inner.y, R.inner.w, R.inner.h, env);
    const hw = R.inner.w / 2;
    host = { x: R.inner.x, y: R.inner.y, w: hw, h: R.inner.h };
    guest = { x: R.inner.x + hw, y: R.inner.y, w: hw, h: R.inner.h };
  }
  drawPerson(ctx, fr.host, host, view.mirror, usePhotoBg);
  drawPerson(ctx, fr.guest, guest, view.mirror, usePhotoBg);
  ctx.restore();
}

function drawStickerImage(ctx, id, x, y, size, rot, flip, env, scale, shadow = true) {
  const img = env.sticker ? env.sticker(id) : null;
  if (!img) return;
  const def = STICKERS[id];
  const w = size;
  const h = size * (def ? def.aspect : 1);
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(40,20,50,.22)';
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;
  }
  ctx.translate(x, y);
  ctx.rotate(((rot || 0) * Math.PI) / 180);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Daftar semua id stiker yang dipakai tampilan ini (untuk pramuat sebelum ekspor). */
export function stickerIdsUsed(view) {
  const L = computeLayout(view.shots);
  const tpl = getTemplate(view.template);
  const ids = new Set();
  if (view.decor !== false) for (const d of resolveDecor(tpl, L)) ids.add(d.s);
  for (const s of view.stickers || []) ids.add(s.s);
  return [...ids];
}

/** Pengelola tampilan: nilai bawaan + teks. */
export function resolveTexts(view, tpl) {
  const title = view.title != null && view.title !== '' ? view.title : tpl.title;
  const h = (view.names && view.names.host) || '';
  const g = (view.names && view.names.guest) || '';
  const auto = h && g ? `${h} & ${g}` : h || g || 'DuoBooth';
  const caption = view.caption != null && view.caption !== '' ? view.caption : auto;
  return { title, caption };
}

/**
 * @param ctx   konteks 2D
 * @param view  { shots, template, bg, photoBg, title, caption, showDate, date, names, mirror, decor, stickers, frames }
 * @param opts  { scale, env: { sticker(id), image(id), imageLuma(id) }, overlay(ctx, L) }
 */
export function renderStrip(ctx, view, opts = {}) {
  const scale = opts.scale || 1;
  const env = opts.env || {};
  const L = computeLayout(view.shots);
  const tpl = getTemplate(view.template);
  const bg = view.bg || tpl.bg;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawBackdrop(ctx, bg, 0, 0, L.W, L.H, env);

  const decor = view.decor === false ? [] : resolveDecor(tpl, L);
  for (const d of decor) if (d.layer === 'back') drawStickerImage(ctx, d.s, d.x, d.y, d.size, d.rot, false, env, scale);

  for (let k = 0; k < L.n; k++) drawFrame(ctx, k, L, view, tpl, env, scale);

  for (const d of decor) if (d.layer !== 'back') drawStickerImage(ctx, d.s, d.x, d.y, d.size, d.rot, false, env, scale);

  // teks
  const luma = specLuma(bg, env);
  const ink = inkFor(luma, tpl);
  const texts = resolveTexts(view, tpl);
  // Teks menyisakan ruang di kiri-kanan untuk dekorasi bila template punya.
  const hasTopDecor = decor.some((d) => d.y < L.top - 100);
  const hasFooterDecor = decor.some((d) => d.y > L.H - L.footer);
  drawLabel(ctx, texts.title, L.title.x, L.title.y, {
    size: 46,
    weight: 700,
    maxW: hasTopDecor ? 340 : L.title.w,
    fill: ink.fill,
    stroke: ink.stroke,
    strokeW: 9,
    minSize: 22,
    maxLines: 2,
  });
  drawLabel(ctx, texts.caption, L.caption.x, L.caption.y, {
    size: 38,
    weight: 700,
    maxW: hasFooterDecor ? 330 : L.caption.w,
    fill: ink.fill,
    stroke: ink.stroke,
    strokeW: 8,
    minSize: 18,
  });
  if (view.showDate !== false) {
    drawLabel(ctx, view.date || '', L.date.x, L.date.y, {
      size: 24,
      weight: 600,
      maxW: hasFooterDecor ? 330 : L.date.w,
      fill: ink.fill,
      stroke: ink.stroke,
      strokeW: 6,
      minSize: 14,
    });
  }

  // stiker pengguna (koordinat disimpan sebagai pecahan agar tetap pas saat jumlah foto berubah)
  const sorted = [...(view.stickers || [])].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const s of sorted) drawStickerImage(ctx, s.s, s.fx * L.W, s.fy * L.H, s.size, s.rot, s.flip, env, scale);

  if (opts.overlay) opts.overlay(ctx, L);
  ctx.restore();
  return L;
}
