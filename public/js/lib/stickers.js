// Pustaka stiker: semuanya digambar sebagai SVG lewat kode (tanpa aset gambar),
// bergaya kawaii dengan tepi putih ala stiker (die-cut).

import { loadImage } from './util.js';

const INK = '#4a3547';

// ---------------------------------------------------------------------------
// Pembantu SVG
// ---------------------------------------------------------------------------
/** Bungkus isi SVG. Ukuran asli dibuat 2x dari viewBox supaya tetap tajam saat di-zoom. */
function wrap(w, h, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

/** Siluet putih tebal di belakang gambar (tepi stiker). Bentuk di dalamnya tidak boleh punya fill/stroke sendiri
 *  (kecuali fill="none" untuk garis). */
const cut = (shapes, width = 14) =>
  `<g fill="#fff" stroke="#fff" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>`;

const tf = (x, y, s = 1, r = 0) => `translate(${x} ${y}) rotate(${r}) scale(${s})`;

const eyeDot = (cx, cy, r = 7.5) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/>` +
  `<circle cx="${cx - r * 0.32}" cy="${cy - r * 0.38}" r="${r * 0.36}" fill="#fff"/>` +
  `<circle cx="${cx + r * 0.4}" cy="${cy + r * 0.36}" r="${r * 0.16}" fill="#fff" opacity=".8"/>`;

const eyeHappy = (cx, cy, w = 10) =>
  `<path d="M${cx - w} ${cy + 3} Q${cx} ${cy - w * 0.95} ${cx + w} ${cy + 3}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;

const eyeSleep = (cx, cy, w = 9) =>
  `<path d="M${cx - w} ${cy - 2} Q${cx} ${cy + w * 0.9} ${cx + w} ${cy - 2}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;

const blush = (cx, cy, rx = 11, ry = 7, c = '#ff8fa8', o = 0.55) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}"/>`;

/** Mulut berbentuk "w" dengan garis turun dari hidung. */
const mouthW = (x, y, s = 1, w = 3.6) =>
  `<path d="M${x} ${y} v${6 * s} M${x} ${y + 6 * s} q${-7 * s} ${9 * s} ${-15 * s} ${2 * s} M${x} ${y + 6 * s} q${7 * s} ${9 * s} ${15 * s} ${2 * s}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const smile = (cx, cy, w = 8, sw = 3.6) =>
  `<path d="M${cx - w} ${cy} Q${cx} ${cy + w * 1.1} ${cx + w} ${cy}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/>`;

const noseTri = (cx, cy, w, h, color) =>
  `<path d="M${cx - w / 2} ${cy} Q${cx} ${cy - h * 0.4} ${cx + w / 2} ${cy} Q${cx + w * 0.14} ${cy + h} ${cx} ${cy + h} Q${cx - w * 0.14} ${cy + h} ${cx - w / 2} ${cy} Z" fill="${color}" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;

function star4(cx, cy, R, k = 0.2) {
  const c = R * k;
  return `M${cx} ${cy - R} Q${cx + c} ${cy - c} ${cx + R} ${cy} Q${cx + c} ${cy + c} ${cx} ${cy + R} Q${cx - c} ${cy + c} ${cx - R} ${cy} Q${cx - c} ${cy - c} ${cx} ${cy - R} Z`;
}

function starN(cx, cy, R, r, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const HEART = 'M100 178 C28 122 12 82 42 52 C68 28 100 46 100 70 C100 46 132 28 158 52 C188 82 172 122 100 178 Z';

// ---------------------------------------------------------------------------
// KUCING
// ---------------------------------------------------------------------------
function catEyeYellow(cx, cy) {
  return (
    `<ellipse cx="${cx}" cy="${cy}" rx="10" ry="11" fill="#ffd54a"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="3.4" ry="8.5" fill="${INK}"/>` +
    `<circle cx="${cx - 3.5}" cy="${cy - 4}" r="2.6" fill="#fff"/>`
  );
}

function cat({ fur, dark, inner = '#ffb7c5', muzzle = '#fff8f0', eyes = 'open', stripes = true, nose = '#ff8fa3' }) {
  const earL = 'M30 104 L33 24 L100 70 Z';
  const earR = 'M170 104 L167 24 L100 70 Z';
  const inL = 'M44 92 L45 47 L84 74 Z';
  const inR = 'M156 92 L155 47 L116 74 Z';
  const eye = (x) => (eyes === 'happy' ? eyeHappy(x, 122, 10) : eyes === 'yellow' ? catEyeYellow(x, 120) : eyeDot(x, 121, 8.5));
  return wrap(
    200,
    200,
    cut(`<path d="${earL}"/><path d="${earR}"/><ellipse cx="100" cy="122" rx="76" ry="62"/>`, 16) +
      `<g fill="${fur}" stroke="${fur}" stroke-width="8" stroke-linejoin="round"><path d="${earL}"/><path d="${earR}"/></g>` +
      `<g fill="${inner}" stroke="${inner}" stroke-width="4" stroke-linejoin="round"><path d="${inL}"/><path d="${inR}"/></g>` +
      `<ellipse cx="100" cy="122" rx="76" ry="62" fill="${fur}"/>` +
      (stripes
        ? `<g stroke="${dark}" stroke-width="6" stroke-linecap="round" fill="none">` +
          `<path d="M100 64 V84"/><path d="M82 68 L86 84"/><path d="M118 68 L114 84"/>` +
          `<path d="M28 112 L44 116"/><path d="M30 128 L45 127"/><path d="M172 112 L156 116"/><path d="M170 128 L155 127"/></g>`
        : '') +
      `<circle cx="86" cy="143" r="19" fill="${muzzle}"/><circle cx="114" cy="143" r="19" fill="${muzzle}"/>` +
      eye(66) +
      eye(134) +
      noseTri(100, 130, 15, 10, nose) +
      mouthW(100, 140, 0.95) +
      blush(46, 140) +
      blush(154, 140)
  );
}

function paw(color, pad = color, size = 1) {
  const toes =
    '<ellipse cx="56" cy="98" rx="14" ry="19" transform="rotate(-22 56 98)"/>' +
    '<ellipse cx="84" cy="68" rx="14" ry="20" transform="rotate(-7 84 68)"/>' +
    '<ellipse cx="116" cy="68" rx="14" ry="20" transform="rotate(7 116 68)"/>' +
    '<ellipse cx="144" cy="98" rx="14" ry="19" transform="rotate(22 144 98)"/>';
  const padPath = '<path d="M100 108 C70 108 52 134 60 156 C66 174 88 168 100 164 C112 168 134 174 140 156 C148 134 130 108 100 108 Z"/>';
  return wrap(
    200,
    200,
    cut(toes + padPath, 14) +
      `<g fill="${color}">${toes}</g>` +
      `<g fill="${pad}">${padPath}</g>` +
      `<ellipse cx="82" cy="126" rx="9" ry="6" fill="#fff" opacity=".28" transform="rotate(-25 82 126)"/>`
  );
}

function fish() {
  const body = '<ellipse cx="88" cy="102" rx="64" ry="40"/>';
  const tail = '<path d="M140 102 L188 66 Q180 102 188 138 Z"/>';
  const fin = '<path d="M70 66 Q92 34 118 64 Z"/>';
  return wrap(
    200,
    200,
    cut(body + tail + fin, 14) +
      `<g fill="#4aa3cc" stroke="#4aa3cc" stroke-width="3" stroke-linejoin="round">${tail}${fin}</g>` +
      `<ellipse cx="88" cy="102" rx="64" ry="40" fill="#6ec1e4"/>` +
      `<path d="M40 112 Q88 150 136 112 Q122 140 88 142 Q54 140 40 112 Z" fill="#b8e4f5"/>` +
      `<path d="M112 70 Q124 102 112 134" fill="none" stroke="#4aa3cc" stroke-width="4" stroke-linecap="round" opacity=".7"/>` +
      eyeDot(56, 92, 7) +
      `<path d="M38 108 Q46 114 54 108" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>` +
      blush(54, 118, 7, 4.5)
  );
}

function yarn() {
  return wrap(
    200,
    200,
    cut('<circle cx="98" cy="100" r="60"/><path d="M142 146 Q180 160 156 184 Q132 200 108 178" fill="none" stroke-width="12"/>', 14) +
      `<path d="M142 146 Q180 160 156 184 Q132 200 108 178" fill="none" stroke="#ff7b9c" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="98" cy="100" r="60" fill="#ff8fa8"/>` +
      `<g fill="none" stroke="#e4607f" stroke-width="4.5" stroke-linecap="round">` +
      `<path d="M50 78 Q98 44 148 82"/><path d="M40 104 Q98 68 158 108"/><path d="M48 130 Q98 96 150 134"/>` +
      `<path d="M66 56 Q74 110 108 158"/><path d="M118 42 Q104 100 128 156"/></g>` +
      `<ellipse cx="70" cy="70" rx="14" ry="8" fill="#fff" opacity=".35" transform="rotate(-35 70 70)"/>`
  );
}

// ---------------------------------------------------------------------------
// ANJING
// ---------------------------------------------------------------------------
function dogFloppy({ fur = '#fbeacb', ear = '#8d5a34', spot = '#b7824f', muzzle = '#fffaf0' } = {}) {
  const earL = `<ellipse cx="42" cy="118" rx="25" ry="50" transform="rotate(14 42 118)"/>`;
  const earR = `<ellipse cx="158" cy="118" rx="25" ry="50" transform="rotate(-14 158 118)"/>`;
  const head = '<ellipse cx="100" cy="114" rx="64" ry="60"/>';
  return wrap(
    200,
    200,
    cut(earL + earR + head, 16) +
      `<g fill="${ear}">${earL}${earR}</g>` +
      `<g fill="#fff" opacity=".12"><ellipse cx="34" cy="100" rx="7" ry="22" transform="rotate(14 34 100)"/><ellipse cx="166" cy="100" rx="7" ry="22" transform="rotate(-14 166 100)"/></g>` +
      `<ellipse cx="100" cy="114" rx="64" ry="60" fill="${fur}"/>` +
      `<path d="M100 54 C84 54 74 70 78 96 C88 88 112 88 122 96 C126 70 116 54 100 54 Z" fill="${spot}" opacity=".85"/>` +
      `<ellipse cx="100" cy="140" rx="38" ry="28" fill="${muzzle}"/>` +
      eyeDot(72, 108, 7.5) +
      eyeDot(128, 108, 7.5) +
      `<ellipse cx="100" cy="126" rx="14" ry="10" fill="${INK}"/><ellipse cx="95" cy="122" rx="5" ry="2.8" fill="#fff" opacity=".6"/>` +
      `<path d="M100 134 V144" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>` +
      `<path d="M100 144 Q88 156 77 146 M100 144 Q112 156 123 146" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>` +
      `<path d="M91 152 Q100 176 109 152 Q100 158 91 152 Z" fill="#ff7a93"/>` +
      blush(58, 132) +
      blush(142, 132)
  );
}

function dogPointy({ fur, mask, inner, eye = 'dot', eyeColor = null, spot = null }) {
  const earL = 'M28 100 L38 26 L96 62 Z';
  const earR = 'M172 100 L162 26 L104 62 Z';
  const inL = 'M44 88 L47 48 L80 68 Z';
  const inR = 'M156 88 L153 48 L120 68 Z';
  const head = '<ellipse cx="100" cy="118" rx="78" ry="60"/>';
  const maskPath = 'M24 124 Q44 100 100 122 Q156 100 176 124 Q168 176 100 178 Q32 176 24 124 Z';
  const eyes =
    eye === 'blue'
      ? `<circle cx="70" cy="112" r="8.5" fill="${eyeColor}"/><circle cx="70" cy="112" r="4.2" fill="${INK}"/><circle cx="67" cy="109" r="2.4" fill="#fff"/>` +
        `<circle cx="130" cy="112" r="8.5" fill="${eyeColor}"/><circle cx="130" cy="112" r="4.2" fill="${INK}"/><circle cx="127" cy="109" r="2.4" fill="#fff"/>`
      : eyeDot(70, 112, 7.5) + eyeDot(130, 112, 7.5);
  return wrap(
    200,
    200,
    cut(`<path d="${earL}"/><path d="${earR}"/>${head}`, 16) +
      `<g fill="${fur}" stroke="${fur}" stroke-width="8" stroke-linejoin="round"><path d="${earL}"/><path d="${earR}"/></g>` +
      `<g fill="${inner}" stroke="${inner}" stroke-width="4" stroke-linejoin="round"><path d="${inL}"/><path d="${inR}"/></g>` +
      `<ellipse cx="100" cy="118" rx="78" ry="60" fill="${fur}"/>` +
      (spot ? `<path d="M100 60 C88 62 82 80 86 98 L114 98 C118 80 112 62 100 60 Z" fill="${spot}"/>` : '') +
      `<path d="${maskPath}" fill="${mask}"/>` +
      (eye === 'dot' ? `<circle cx="70" cy="95" r="6" fill="${mask}"/><circle cx="130" cy="95" r="6" fill="${mask}"/>` : '') +
      eyes +
      `<ellipse cx="100" cy="131" rx="11.5" ry="8.5" fill="${INK}"/><ellipse cx="96" cy="128" rx="4" ry="2.2" fill="#fff" opacity=".6"/>` +
      mouthW(100, 138, 1) +
      blush(56, 142) +
      blush(144, 142)
  );
}

function bone() {
  const shape =
    '<g transform="rotate(-32 100 100)">' +
    '<rect x="48" y="86" width="104" height="28" rx="12"/>' +
    '<circle cx="46" cy="84" r="19"/><circle cx="46" cy="116" r="19"/>' +
    '<circle cx="154" cy="84" r="19"/><circle cx="154" cy="116" r="19"/></g>';
  return wrap(
    200,
    200,
    cut(shape, 14) +
      `<g fill="#fff6e3" stroke="#e8d3a8" stroke-width="4" stroke-linejoin="round">${shape.replace(/<g [^>]*>/, '<g transform="rotate(-32 100 100)">')}</g>` +
      `<g transform="rotate(-32 100 100)"><rect x="60" y="92" width="80" height="8" rx="4" fill="#fff" opacity=".7"/></g>`
  );
}

function ball() {
  return wrap(
    200,
    200,
    cut('<circle cx="100" cy="100" r="62"/>', 14) +
      `<circle cx="100" cy="100" r="62" fill="#d9f04d"/>` +
      `<path d="M52 52 Q82 100 52 148 M148 52 Q118 100 148 148" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>` +
      `<ellipse cx="76" cy="66" rx="16" ry="9" fill="#fff" opacity=".4" transform="rotate(-35 76 66)"/>`
  );
}

// ---------------------------------------------------------------------------
// PANDA & RED PANDA
// ---------------------------------------------------------------------------
function pandaHeadParts() {
  const cutShapes = '<circle cx="46" cy="54" r="27"/><circle cx="154" cy="54" r="27"/><ellipse cx="100" cy="114" rx="78" ry="66"/>';
  const art =
    `<g fill="${INK}"><circle cx="46" cy="54" r="27"/><circle cx="154" cy="54" r="27"/></g>` +
    `<ellipse cx="100" cy="114" rx="78" ry="66" fill="#fffdfa"/>` +
    `<g fill="#34262f"><ellipse cx="64" cy="108" rx="19" ry="25" transform="rotate(24 64 108)"/><ellipse cx="136" cy="108" rx="19" ry="25" transform="rotate(-24 136 108)"/></g>` +
    `<circle cx="66" cy="106" r="8" fill="#fff"/><circle cx="66" cy="106" r="4.6" fill="${INK}"/><circle cx="64.4" cy="104.2" r="1.8" fill="#fff"/>` +
    `<circle cx="134" cy="106" r="8" fill="#fff"/><circle cx="134" cy="106" r="4.6" fill="${INK}"/><circle cx="132.4" cy="104.2" r="1.8" fill="#fff"/>` +
    noseTri(100, 126, 17, 11, '#34262f') +
    mouthW(100, 138, 0.95) +
    blush(48, 136, 12, 7.5) +
    blush(152, 136, 12, 7.5);
  return { cutShapes, art };
}

function pandaFace() {
  const p = pandaHeadParts();
  return wrap(200, 200, cut(p.cutShapes, 16) + p.art);
}

function pandaSit() {
  const p = pandaHeadParts();
  const sc = 0.74;
  const headT = `translate(100 96) scale(${sc}) translate(-100 -114)`;
  const bodyCut =
    '<ellipse cx="100" cy="184" rx="58" ry="50"/><ellipse cx="62" cy="222" rx="27" ry="16" transform="rotate(-10 62 222)"/><ellipse cx="138" cy="222" rx="27" ry="16" transform="rotate(10 138 222)"/>' +
    '<ellipse cx="50" cy="176" rx="15" ry="31" transform="rotate(20 50 176)"/><ellipse cx="150" cy="176" rx="15" ry="31" transform="rotate(-20 150 176)"/>';
  return wrap(
    200,
    252,
    cut(bodyCut, 14) +
      `<g transform="${headT}">${cut(p.cutShapes, 14 / sc)}</g>` +
      `<ellipse cx="100" cy="184" rx="58" ry="50" fill="#fffdfa"/>` +
      `<g fill="#34262f"><ellipse cx="62" cy="222" rx="27" ry="16" transform="rotate(-10 62 222)"/><ellipse cx="138" cy="222" rx="27" ry="16" transform="rotate(10 138 222)"/>` +
      `<ellipse cx="50" cy="176" rx="15" ry="31" transform="rotate(20 50 176)"/><ellipse cx="150" cy="176" rx="15" ry="31" transform="rotate(-20 150 176)"/></g>` +
      `<g fill="#fff" opacity=".22"><ellipse cx="60" cy="224" rx="12" ry="5" transform="rotate(-10 60 224)"/><ellipse cx="140" cy="224" rx="12" ry="5" transform="rotate(10 140 224)"/></g>` +
      `<g transform="${headT}">${p.art}</g>`
  );
}

function redPandaHeadParts() {
  const RUST = '#e2702f';
  const DARK = '#9a3f1a';
  const cheekL = '<ellipse cx="46" cy="140" rx="28" ry="22" transform="rotate(-18 46 140)"/>';
  const cheekR = '<ellipse cx="154" cy="140" rx="28" ry="22" transform="rotate(18 154 140)"/>';
  const fluffL = [[24, 128, 11], [28, 146, 11], [42, 158, 11], [60, 162, 10]];
  const fluffR = fluffL.map(([x, y, r]) => [200 - x, y, r]);
  const circles = (arr, fill) => arr.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
  const cutShapes =
    '<ellipse cx="44" cy="62" rx="29" ry="31"/><ellipse cx="156" cy="62" rx="29" ry="31"/><ellipse cx="100" cy="118" rx="80" ry="64"/>' +
    [...fluffL, ...fluffR].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const art =
    `<ellipse cx="44" cy="62" rx="29" ry="31" fill="${RUST}"/><ellipse cx="156" cy="62" rx="29" ry="31" fill="${RUST}"/>` +
    `<ellipse cx="44" cy="68" rx="17" ry="19" fill="#fff4e8"/><ellipse cx="156" cy="68" rx="17" ry="19" fill="#fff4e8"/>` +
    `<ellipse cx="44" cy="46" rx="14" ry="6" fill="#fff4e8" transform="rotate(-24 44 46)"/><ellipse cx="156" cy="46" rx="14" ry="6" fill="#fff4e8" transform="rotate(24 156 46)"/>` +
    `<ellipse cx="100" cy="118" rx="80" ry="64" fill="${RUST}"/>` +
    `<ellipse cx="100" cy="76" rx="26" ry="14" fill="#f08a45" opacity=".8"/>` +
    circles(fluffL, '#fff7ee') +
    circles(fluffR, '#fff7ee') +
    `<g fill="#fff7ee">${cheekL}${cheekR}</g>` +
    `<ellipse cx="100" cy="144" rx="33" ry="23" fill="#fffaf3"/>` +
    `<g fill="none" stroke="${DARK}" stroke-width="7" stroke-linecap="round" opacity=".9"><path d="M70 118 Q62 132 58 144"/><path d="M130 118 Q138 132 142 144"/></g>` +
    `<ellipse cx="70" cy="92" rx="12" ry="6" fill="#fff7ee" transform="rotate(-14 70 92)"/><ellipse cx="130" cy="92" rx="12" ry="6" fill="#fff7ee" transform="rotate(14 130 92)"/>` +
    eyeDot(70, 108, 7.5) +
    eyeDot(130, 108, 7.5) +
    `<ellipse cx="100" cy="130" rx="11" ry="7.5" fill="${INK}"/><ellipse cx="96" cy="127.5" rx="3.8" ry="2" fill="#fff" opacity=".55"/>` +
    mouthW(100, 136, 0.92);
  return { cutShapes, art };
}

function redPandaFace() {
  const p = redPandaHeadParts();
  return wrap(200, 200, cut(p.cutShapes, 16) + p.art);
}

function redPandaSit() {
  const p = redPandaHeadParts();
  const sc = 0.74;
  const headT = `translate(100 96) scale(${sc}) translate(-100 -114)`;
  const bodyCut =
    '<ellipse cx="100" cy="184" rx="56" ry="50"/><ellipse cx="62" cy="222" rx="26" ry="16" transform="rotate(-10 62 222)"/><ellipse cx="138" cy="222" rx="26" ry="16" transform="rotate(10 138 222)"/>' +
    '<ellipse cx="50" cy="176" rx="14" ry="30" transform="rotate(20 50 176)"/><ellipse cx="150" cy="176" rx="14" ry="30" transform="rotate(-20 150 176)"/>';
  return wrap(
    200,
    252,
    cut(bodyCut, 14) +
      `<g transform="${headT}">${cut(p.cutShapes, 14 / sc)}</g>` +
      `<ellipse cx="100" cy="184" rx="56" ry="50" fill="#b9501f"/>` +
      `<ellipse cx="100" cy="190" rx="36" ry="34" fill="#e2702f" opacity=".55"/>` +
      `<g fill="#5a2d1c"><ellipse cx="62" cy="222" rx="26" ry="16" transform="rotate(-10 62 222)"/><ellipse cx="138" cy="222" rx="26" ry="16" transform="rotate(10 138 222)"/>` +
      `<ellipse cx="50" cy="176" rx="14" ry="30" transform="rotate(20 50 176)"/><ellipse cx="150" cy="176" rx="14" ry="30" transform="rotate(-20 150 176)"/></g>` +
      `<g transform="${headT}">${p.art}</g>`
  );
}

function redPandaTail() {
  // Ekor tebal yang menyempit di pangkal, dengan cincin gelap khas red panda.
  const d =
    'M30 174 C8 144 22 108 58 92 C92 78 98 52 122 32 C146 12 184 24 186 56 C188 90 154 100 130 122 C106 144 90 180 56 190 C42 194 34 188 30 174 Z';
  let bars = '';
  for (let i = -3; i <= 9; i++) bars += `<rect x="${i * 30 - 20}" y="-120" width="13" height="440"/>`;
  return wrap(
    200,
    200,
    cut(`<path d="${d}"/>`, 14) +
      `<clipPath id="tail"><path d="${d}"/></clipPath>` +
      `<path d="${d}" fill="#e2702f"/>` +
      `<g clip-path="url(#tail)">` +
      `<g transform="rotate(-50 100 100)" fill="#b4531f">${bars}</g>` +
      `<circle cx="176" cy="38" r="34" fill="#5a2d1c"/>` +
      `<path d="M40 150 C24 128 40 106 66 98" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".3"/>` +
      `</g>` +
      `<path d="${d}" fill="none" stroke="#b4531f" stroke-width="3" stroke-linejoin="round" opacity=".6"/>`
  );
}

function bamboo() {
  const stalk = (x, y1, y2, w, c) => `<rect x="${x}" y="${y1}" width="${w}" height="${y2 - y1}" rx="${w / 2}" fill="${c}"/>`;
  const node = (x, y, w) => `<rect x="${x - 2}" y="${y}" width="${w + 4}" height="8" rx="4" fill="#4f9d52"/>`;
  const leaf = (x, y, rot, s = 1, c = '#5fb35d') =>
    `<path d="M0 0 Q22 -34 66 -26 Q46 8 0 0 Z" fill="${c}" transform="${tf(x, y, s, rot)}"/><path d="M4 -2 Q30 -12 56 -22" fill="none" stroke="#fff" stroke-width="2" opacity=".35" transform="${tf(x, y, s, rot)}"/>`;
  const leafCut = (x, y, rot, s = 1) => `<path d="M0 0 Q22 -34 66 -26 Q46 8 0 0 Z" transform="${tf(x, y, s, rot)}"/>`;
  return wrap(
    200,
    200,
    cut(
      '<rect x="60" y="12" width="28" height="178" rx="14"/><rect x="108" y="34" width="26" height="156" rx="13"/>' +
        leafCut(88, 70, -28, 1) +
        leafCut(134, 92, 200, 0.9) +
        leafCut(88, 124, -8, 0.8),
      14
    ) +
    stalk(108, 34, 190, 26, '#7cc36e') +
    stalk(60, 12, 190, 28, '#8ed07c') +
    node(60, 56, 28) + node(60, 108, 28) + node(60, 156, 28) +
    node(108, 80, 26) + node(108, 134, 26) +
    `<rect x="66" y="20" width="6" height="160" rx="3" fill="#fff" opacity=".3"/>` +
    leaf(88, 70, -28, 1) +
    leaf(134, 92, 200, 0.9, '#4f9d52') +
    leaf(88, 124, -8, 0.8, '#6cbc66')
  );
}

// ---------------------------------------------------------------------------
// LANGIT
// ---------------------------------------------------------------------------
function cloudShape() {
  return (
    '<circle cx="64" cy="120" r="30"/><circle cx="102" cy="96" r="40"/><circle cx="142" cy="114" r="32"/>' +
    '<rect x="36" y="114" width="138" height="36" rx="18"/>'
  );
}

function cloud(face = true) {
  const shape = cloudShape();
  return wrap(
    200,
    200,
    `<g fill="#bfdcf2" stroke="#bfdcf2" stroke-width="12" stroke-linejoin="round" transform="translate(0 4)">${shape}</g>` +
      `<g fill="#fff" stroke="#fff" stroke-width="2">${shape}</g>` +
      `<path d="M52 148 H160" stroke="#e3f1fb" stroke-width="10" stroke-linecap="round"/>` +
      (face
        ? eyeDot(84, 118, 5.6) + eyeDot(120, 118, 5.6) + smile(102, 128, 7, 3.2) + blush(70, 129, 8, 5) + blush(134, 129, 8, 5)
        : '')
  );
}

function sun() {
  let rays = '';
  let rayCut = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    const x1 = 100 + Math.cos(a) * 56;
    const y1 = 100 + Math.sin(a) * 56;
    const x2 = 100 + Math.cos(a) * 80;
    const y2 = 100 + Math.sin(a) * 80;
    rays += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    rayCut += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }
  return wrap(
    200,
    200,
    cut(`<circle cx="100" cy="100" r="44"/>${rayCut}`, 20) +
      `<g stroke="#ffb42e" stroke-width="12" stroke-linecap="round" fill="none">${rays}</g>` +
      `<circle cx="100" cy="100" r="44" fill="#ffd23f"/>` +
      `<circle cx="100" cy="100" r="44" fill="none" stroke="#ffc01f" stroke-width="3"/>` +
      eyeDot(84, 96, 6) +
      eyeDot(116, 96, 6) +
      smile(100, 108, 8, 3.4) +
      blush(72, 110, 8.5, 5.5) +
      blush(128, 110, 8.5, 5.5)
  );
}

function moon() {
  const d = 'M102.18 32.03 A72 72 0 1 0 162.26 140.17 A62 62 0 0 1 102.18 32.03 Z';
  return wrap(
    200,
    200,
    cut(`<path d="${d}"/>`, 14) +
      `<path d="${d}" fill="#ffe27a"/>` +
      `<path d="${d}" fill="none" stroke="#ffd24d" stroke-width="3" stroke-linejoin="round"/>` +
      eyeSleep(56, 104, 9) +
      smile(62, 126, 6, 3.2) +
      blush(44, 120, 8, 5) +
      `<circle cx="60" cy="72" r="5" fill="#ffd24d" opacity=".7"/><circle cx="82" cy="150" r="4" fill="#ffd24d" opacity=".7"/>`
  );
}

function star(face = true) {
  const d = starN(100, 106, 84, 40, 5);
  return wrap(
    200,
    200,
    cut(`<path d="${d}"/>`, 14) +
      `<path d="${d}" fill="#ffd23f" stroke="#ffd23f" stroke-width="14" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="#ffe27a" stroke="#ffe27a" stroke-width="6" stroke-linejoin="round"/>` +
      (face ? eyeDot(86, 108, 5.6) + eyeDot(114, 108, 5.6) + smile(100, 118, 6, 3.2) + blush(77, 119, 7, 4.5) + blush(123, 119, 7, 4.5) : '')
  );
}

function rainbow() {
  const colors = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
  let arcs = '';
  let arcCut = '';
  colors.forEach((c, i) => {
    const r = 100 - i * 11;
    const d = `M${120 - r} 138 A${r} ${r} 0 0 1 ${120 + r} 138`;
    arcs += `<path d="${d}" fill="none" stroke="${c}" stroke-width="11"/>`;
    if (i === 0) arcCut = `<path d="${d}" fill="none" stroke-width="30"/>`;
  });
  const puff = (cx) =>
    `<circle cx="${cx - 14}" cy="140" r="16"/><circle cx="${cx + 2}" cy="128" r="21"/><circle cx="${cx + 18}" cy="140" r="16"/><rect x="${cx - 30}" y="138" width="64" height="18" rx="9"/>`;
  return wrap(
    240,
    170,
    cut(arcCut + puff(32) + puff(208), 12) +
      arcs +
      `<g fill="#fff" stroke="#fff" stroke-width="1">${puff(32)}${puff(208)}</g>` +
      `<g fill="none" stroke="#dcecf8" stroke-width="4" stroke-linecap="round"><path d="M10 156 H56"/><path d="M186 156 H232"/></g>`
  );
}

function balloon(color, shade) {
  const body = '<ellipse cx="100" cy="86" rx="46" ry="56"/>';
  return wrap(
    200,
    200,
    cut(`${body}<path d="M100 144 Q86 166 100 190" fill="none" stroke-width="10"/><path d="M90 150 L110 150 L100 138 Z"/>`, 14) +
      `<path d="M100 146 Q86 168 100 190" fill="none" stroke="#9a8a99" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M89 152 L111 152 L100 138 Z" fill="${shade}" stroke="${shade}" stroke-width="3" stroke-linejoin="round"/>` +
      `<ellipse cx="100" cy="86" rx="46" ry="56" fill="${color}"/>` +
      `<ellipse cx="100" cy="100" rx="38" ry="44" fill="${shade}" opacity=".25"/>` +
      `<ellipse cx="80" cy="62" rx="10" ry="18" fill="#fff" opacity=".5" transform="rotate(24 80 62)"/>`
  );
}

function sparkles() {
  return wrap(
    200,
    200,
    cut(`<path d="${star4(98, 96, 62)}"/><path d="${star4(156, 44, 28)}"/><path d="${star4(48, 150, 30)}"/>`, 12) +
      `<path d="${star4(98, 96, 62)}" fill="#ffd23f"/>` +
      `<path d="${star4(156, 44, 28)}" fill="#ffe27a"/>` +
      `<path d="${star4(48, 150, 30)}" fill="#ffe27a"/>` +
      `<path d="${star4(98, 96, 24, 0.3)}" fill="#fff" opacity=".7"/>` +
      `<circle cx="160" cy="146" r="7" fill="#ffd23f"/><circle cx="34" cy="64" r="6" fill="#ffd23f"/>`
  );
}

// ---------------------------------------------------------------------------
// LUCU
// ---------------------------------------------------------------------------
function heart(color, shade) {
  return wrap(
    200,
    200,
    cut(`<path d="${HEART}"/>`, 14) +
      `<path d="${HEART}" fill="${color}"/>` +
      `<path d="M100 178 C28 122 12 82 42 52 C68 28 100 46 100 70" fill="none" stroke="${shade}" stroke-width="0"/>` +
      `<ellipse cx="62" cy="68" rx="13" ry="20" fill="#fff" opacity=".45" transform="rotate(38 62 68)"/>`
  );
}

function heartPair() {
  const big = tf(6, 22, 0.76);
  const small = tf(86, 6, 0.54, 12);
  return wrap(
    200,
    200,
    `<g transform="${big}">${cut(`<path d="${HEART}"/>`, 16)}</g><g transform="${small}">${cut(`<path d="${HEART}"/>`, 22)}</g>` +
      `<g transform="${big}"><path d="${HEART}" fill="#ff5d8f"/><ellipse cx="62" cy="68" rx="13" ry="20" fill="#fff" opacity=".45" transform="rotate(38 62 68)"/></g>` +
      `<g transform="${small}"><path d="${HEART}" fill="#ffa3c1"/><ellipse cx="62" cy="68" rx="13" ry="20" fill="#fff" opacity=".5" transform="rotate(38 62 68)"/></g>`
  );
}

function flower() {
  let petals = '';
  let petalCut = '';
  for (let i = 0; i < 8; i++) {
    const r = i * 45;
    petals += `<ellipse cx="100" cy="52" rx="19" ry="34" transform="rotate(${r} 100 100)"/>`;
    petalCut += `<ellipse cx="100" cy="52" rx="19" ry="34" transform="rotate(${r} 100 100)"/>`;
  }
  return wrap(
    200,
    200,
    cut(petalCut, 12) +
      `<g fill="#ffa3c1">${petals}</g>` +
      `<g fill="#ffc9dc" opacity=".9">${petals.replace(/ry="34"/g, 'ry="22"')}</g>` +
      `<circle cx="100" cy="100" r="26" fill="#ffd23f"/><circle cx="100" cy="100" r="26" fill="none" stroke="#ffb42e" stroke-width="3"/>` +
      eyeDot(91, 96, 3.6) +
      eyeDot(109, 96, 3.6) +
      smile(100, 105, 5, 2.6)
  );
}

function bow() {
  const loopL = 'M98 100 C74 58 18 58 20 100 C20 142 74 142 98 100 Z';
  const loopR = 'M102 100 C126 58 182 58 180 100 C180 142 126 142 102 100 Z';
  const tailL = 'M94 108 Q82 140 66 172 L92 160 Q100 138 104 112 Z';
  const tailR = 'M106 108 Q118 140 134 172 L108 160 Q100 138 96 112 Z';
  return wrap(
    200,
    200,
    cut(`<path d="${loopL}"/><path d="${loopR}"/><path d="${tailL}"/><path d="${tailR}"/><circle cx="100" cy="100" r="17"/>`, 14) +
      `<g fill="#f0608d" stroke="#f0608d" stroke-width="3" stroke-linejoin="round"><path d="${tailL}"/><path d="${tailR}"/></g>` +
      `<g fill="#ff7aa2" stroke="#ff7aa2" stroke-width="3" stroke-linejoin="round"><path d="${loopL}"/><path d="${loopR}"/></g>` +
      `<g fill="none" stroke="#f0608d" stroke-width="4" stroke-linecap="round" opacity=".8"><path d="M82 100 C66 80 40 80 34 100"/><path d="M118 100 C134 80 160 80 166 100"/></g>` +
      `<circle cx="100" cy="100" r="17" fill="#ff5d8f"/><ellipse cx="95" cy="94" rx="6" ry="4" fill="#fff" opacity=".5"/>`
  );
}

function crown() {
  const body = 'M38 150 L26 70 L68 106 L100 52 L132 106 L174 70 L162 150 Z';
  return wrap(
    200,
    200,
    cut(`<path d="${body}"/><circle cx="26" cy="64" r="10"/><circle cx="100" cy="46" r="10"/><circle cx="174" cy="64" r="10"/>`, 14) +
      `<path d="${body}" fill="#ffd23f" stroke="#ffd23f" stroke-width="8" stroke-linejoin="round"/>` +
      `<rect x="36" y="140" width="128" height="26" rx="8" fill="#ffb42e"/>` +
      `<circle cx="26" cy="64" r="9" fill="#fff3b0"/><circle cx="100" cy="46" r="9" fill="#fff3b0"/><circle cx="174" cy="64" r="9" fill="#fff3b0"/>` +
      `<circle cx="100" cy="124" r="11" fill="#ff5d8f"/><circle cx="64" cy="126" r="8" fill="#74c0fc"/><circle cx="136" cy="126" r="8" fill="#74c0fc"/>` +
      `<circle cx="97" cy="121" r="3.4" fill="#fff" opacity=".7"/>` +
      `<path d="M52 150 H148" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".4"/>`
  );
}

function bubbleHeart() {
  const d = 'M44 40 H156 Q180 40 180 64 V108 Q180 132 156 132 H100 L66 164 L72 132 H44 Q20 132 20 108 V64 Q20 40 44 40 Z';
  return wrap(
    200,
    200,
    cut(`<path d="${d}"/>`, 14) +
      `<path d="${d}" fill="#fff" stroke="#ffb3c8" stroke-width="5" stroke-linejoin="round"/>` +
      `<g transform="translate(100 86) scale(0.34) translate(-100 -112)"><path d="${HEART}" fill="#ff5d8f"/></g>`
  );
}

// ---------------------------------------------------------------------------
// Registri
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  { id: 'cat', name: 'Kucing', icon: 'cat-orange' },
  { id: 'dog', name: 'Anjing', icon: 'dog-shiba' },
  { id: 'sky', name: 'Langit', icon: 'cloud' },
  { id: 'panda', name: 'Panda', icon: 'panda-face' },
  { id: 'redpanda', name: 'Red Panda', icon: 'redpanda-face' },
  { id: 'cute', name: 'Lucu', icon: 'heart-red' },
];

// [id, nama, builder, [kategori], lebar viewBox, tinggi viewBox]
const DEFS = [
  ['cat-orange', 'Kucing Oren', () => cat({ fur: '#f6a45a', dark: '#dc7d2e' }), ['cat'], 200, 200],
  ['cat-gray', 'Kucing Abu', () => cat({ fur: '#aab5c4', dark: '#7f8c9e', muzzle: '#f4f7fa', eyes: 'happy' }), ['cat'], 200, 200],
  ['cat-black', 'Kucing Hitam', () => cat({ fur: '#4d4856', dark: '#37323f', eyes: 'yellow', inner: '#ff9bb0', stripes: false }), ['cat'], 200, 200],
  ['paw-pink', 'Cakar Pink', () => paw('#ff9fba', '#ff7fa3'), ['cat', 'cute'], 200, 200],
  ['fish', 'Ikan', fish, ['cat'], 200, 200],
  ['yarn', 'Bola Wol', yarn, ['cat'], 200, 200],

  ['dog-beagle', 'Anjing Beagle', () => dogFloppy(), ['dog'], 200, 200],
  ['dog-shiba', 'Anjing Shiba', () => dogPointy({ fur: '#eaa35e', mask: '#fff3e0', inner: '#ffe3c2' }), ['dog'], 200, 200],
  ['dog-husky', 'Anjing Husky', () => dogPointy({ fur: '#8b97a8', mask: '#f6f8fb', inner: '#e7ecf3', eye: 'blue', eyeColor: '#67b7ff', spot: '#6f7c8f' }), ['dog'], 200, 200],
  ['bone', 'Tulang', bone, ['dog'], 200, 200],
  ['ball', 'Bola Tenis', ball, ['dog'], 200, 200],
  ['paw-brown', 'Cakar Cokelat', () => paw('#b9835a', '#9d6b45'), ['dog'], 200, 200],

  ['cloud', 'Awan Lucu', () => cloud(true), ['sky'], 200, 200],
  ['cloud-plain', 'Awan', () => cloud(false), ['sky'], 200, 200],
  ['sun', 'Matahari', sun, ['sky'], 200, 200],
  ['moon', 'Bulan', moon, ['sky'], 200, 200],
  ['star', 'Bintang', () => star(true), ['sky', 'cute'], 200, 200],
  ['rainbow', 'Pelangi', rainbow, ['sky'], 240, 170],
  ['balloon-red', 'Balon Merah', () => balloon('#ff6b81', '#e04860'), ['sky', 'cute'], 200, 200],
  ['balloon-blue', 'Balon Biru', () => balloon('#5bb8f5', '#3a98d8'), ['sky'], 200, 200],
  ['sparkles', 'Kilau', sparkles, ['sky', 'cute'], 200, 200],

  ['panda-face', 'Panda', pandaFace, ['panda'], 200, 200],
  ['panda-sit', 'Panda Duduk', pandaSit, ['panda'], 200, 252],
  ['bamboo', 'Bambu', bamboo, ['panda', 'redpanda'], 200, 200],
  ['paw-black', 'Cakar Panda', () => paw('#4a3f4d', '#3a3040'), ['panda'], 200, 200],

  ['redpanda-face', 'Red Panda', redPandaFace, ['redpanda'], 200, 200],
  ['redpanda-sit', 'Red Panda Duduk', redPandaSit, ['redpanda'], 200, 252],
  ['redpanda-tail', 'Ekor Red Panda', redPandaTail, ['redpanda'], 200, 200],

  ['heart-red', 'Hati Merah', () => heart('#ff4d6d', '#d93656'), ['cute'], 200, 200],
  ['heart-pink', 'Hati Pink', () => heart('#ff9ec0', '#f27aa5'), ['cute'], 200, 200],
  ['heart-pair', 'Dua Hati', heartPair, ['cute'], 200, 200],
  ['flower', 'Bunga', flower, ['cute'], 200, 200],
  ['bow', 'Pita', bow, ['cute'], 200, 200],
  ['crown', 'Mahkota', crown, ['cute'], 200, 200],
  ['bubble-heart', 'Chat Cinta', bubbleHeart, ['cute'], 200, 200],
];

export const STICKERS = {};
for (const [id, name, build, cats, w, h] of DEFS) {
  STICKERS[id] = { id, name, cats, w, h, aspect: h / w, build };
}
export const STICKER_IDS = DEFS.map((d) => d[0]);

export function stickersInCategory(catId) {
  return STICKER_IDS.filter((id) => STICKERS[id].cats.includes(catId));
}

const svgCache = new Map();
export function stickerSvg(id) {
  if (!STICKERS[id]) return null;
  if (!svgCache.has(id)) svgCache.set(id, STICKERS[id].build());
  return svgCache.get(id);
}

const urlCache = new Map();
export function stickerUrl(id) {
  if (!urlCache.has(id)) {
    const svg = stickerSvg(id);
    if (!svg) return '';
    urlCache.set(id, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  return urlCache.get(id);
}

const imgCache = new Map(); // id -> HTMLImageElement (sudah dimuat)
const imgPromises = new Map();

export function loadSticker(id) {
  if (imgCache.has(id)) return Promise.resolve(imgCache.get(id));
  if (!STICKERS[id]) return Promise.reject(new Error(`Stiker tidak dikenal: ${id}`));
  if (!imgPromises.has(id)) {
    imgPromises.set(
      id,
      loadImage(stickerUrl(id)).then((img) => {
        imgCache.set(id, img);
        return img;
      })
    );
  }
  return imgPromises.get(id);
}

/** Ambil gambar stiker yang sudah dimuat (sinkron). null bila belum siap. */
export function stickerImage(id) {
  return imgCache.get(id) || null;
}

export function preloadStickers(ids) {
  return Promise.all(ids.map((id) => loadSticker(id).catch(() => null)));
}
