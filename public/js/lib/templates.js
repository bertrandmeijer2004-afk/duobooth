// Template photobooth. Setiap template punya latar bawaan, warna bingkai, judul bawaan,
// dan dekorasi stiker yang "menempel" ke frame (jadi tetap rapi untuk 2-4 foto).
//
// Dekorasi:
//   a: 'frame'  -> relatif ke frame k  (k: angka | 'first' | 'last' | 'each'), ax/ay = pecahan 0..1 dari frame
//   a: 'top'    -> area judul           (ax = pecahan lebar, dy = piksel dari atas)
//   a: 'footer' -> area bawah           (ax = pecahan lebar, dy = piksel dari atas area footer)
//   layer: 'back' (di belakang frame, mis. hewan mengintip) atau 'front' (menimpa frame)
//   alt: true   -> untuk frame ganjil cermin kiri-kanan (ax -> 1-ax, rot -> -rot)

// Hewan mengintip dari balik tepi atas frame pertama (hanya bagian atas wajah yang terlihat)
const peek = (s, ax, rot, size = 122) => ({ s, a: 'frame', k: 'first', ax, ay: 0, dy: -30, size, rot, layer: 'back' });

export const TEMPLATES = [
  {
    id: 'color',
    name: 'Warna Polos',
    hint: 'Simpel, hanya warna',
    title: 'Photobooth',
    bg: { type: 'solid', color: '#ffc8dd' },
    frame: '#ffffff',
    ink: '#6b2f4f',
    decor: [],
  },
  {
    id: 'cat',
    name: 'Kucing',
    hint: 'Meong-meong lucu',
    title: 'Meow Moments',
    bg: { type: 'pattern', kind: 'paws', base: '#ffe9d6', accent: '#ffd3b0' },
    frame: '#ffffff',
    ink: '#8a4b1f',
    decor: [
      peek('cat-orange', 0.2, -8),
      peek('cat-gray', 0.8, 7, 114),
      { s: 'paw-pink', a: 'frame', k: 'each', ax: 0.985, ay: 1, dy: 11, size: 58, rot: 18, alt: true, layer: 'front' },
      { s: 'heart-pink', a: 'frame', k: 'each', ax: -0.035, ay: 0.5, size: 42, rot: -14, alt: true, layer: 'back' },
      { s: 'yarn', a: 'footer', ax: 0.1, dy: 70, size: 96, rot: -10, layer: 'front' },
      { s: 'fish', a: 'footer', ax: 0.9, dy: 74, size: 102, rot: 14, layer: 'front' },
    ],
  },
  {
    id: 'dog',
    name: 'Anjing',
    hint: 'Guk guk gemas',
    title: 'Woof Woof!',
    bg: { type: 'pattern', kind: 'bones', base: '#e3f2fd', accent: '#c4e1f7' },
    frame: '#ffffff',
    ink: '#2f5d8a',
    decor: [
      peek('dog-beagle', 0.2, -7),
      peek('dog-shiba', 0.8, 7, 118),
      { s: 'paw-brown', a: 'frame', k: 'each', ax: 0.985, ay: 1, dy: 11, size: 56, rot: 18, alt: true, layer: 'front' },
      { s: 'heart-red', a: 'frame', k: 'each', ax: -0.035, ay: 0.5, size: 40, rot: -14, alt: true, layer: 'back' },
      { s: 'bone', a: 'footer', ax: 0.1, dy: 72, size: 100, rot: 6, layer: 'front' },
      { s: 'ball', a: 'footer', ax: 0.9, dy: 74, size: 88, rot: 0, layer: 'front' },
    ],
  },
  {
    id: 'sky',
    name: 'Langit',
    hint: 'Awan, matahari, bintang',
    title: 'Di Bawah Langit yang Sama',
    bg: { type: 'scene', kind: 'sky' },
    frame: '#ffffff',
    ink: '#164a82',
    decor: [
      { s: 'cloud', a: 'frame', k: 'first', ax: 0.2, ay: 0, dy: -18, size: 150, rot: 0, layer: 'back' },
      { s: 'cloud-plain', a: 'frame', k: 'first', ax: 0.78, ay: 0, dy: -12, size: 138, rot: 0, layer: 'back' },
      { s: 'sun', a: 'top', ax: 0.91, dy: 66, size: 104, rot: 0, layer: 'back' },
      { s: 'star', a: 'top', ax: 0.09, dy: 70, size: 74, rot: -12, layer: 'back' },
      { s: 'cloud-plain', a: 'frame', k: 'each', ax: 0.03, ay: 1, dy: 11, size: 96, rot: 0, alt: true, layer: 'front' },
      { s: 'sparkles', a: 'frame', k: 'each', ax: 1.035, ay: 0.5, size: 58, rot: 0, alt: true, layer: 'back' },
      { s: 'balloon-blue', a: 'footer', ax: 0.09, dy: 74, size: 116, rot: -10, layer: 'front' },
      { s: 'balloon-red', a: 'footer', ax: 0.91, dy: 74, size: 116, rot: 10, layer: 'front' },
    ],
  },
  {
    id: 'panda',
    name: 'Panda',
    hint: 'Panda & hutan bambu',
    title: 'Panda Duo',
    bg: { type: 'scene', kind: 'bamboo' },
    frame: '#ffffff',
    ink: '#245c33',
    decor: [
      peek('panda-face', 0.2, -7, 120),
      peek('panda-face', 0.8, 7, 120),
      { s: 'paw-black', a: 'frame', k: 'each', ax: 0.985, ay: 1, dy: 11, size: 56, rot: 18, alt: true, layer: 'front' },
      { s: 'heart-pink', a: 'frame', k: 'each', ax: -0.035, ay: 0.5, size: 40, rot: -14, alt: true, layer: 'back' },
      { s: 'bamboo', a: 'footer', ax: 0.09, dy: 74, size: 116, rot: -6, layer: 'front' },
      { s: 'panda-sit', a: 'footer', ax: 0.89, dy: 82, size: 118, rot: 0, layer: 'front' },
    ],
  },
  {
    id: 'redpanda',
    name: 'Red Panda',
    hint: 'Si rubah api yang imut',
    title: 'Red Panda Duo',
    bg: { type: 'gradient', from: '#fff1de', to: '#ffc9a0', angle: 165 },
    frame: '#fffaf3',
    ink: '#8a3513',
    decor: [
      peek('redpanda-face', 0.2, -7, 124),
      peek('redpanda-face', 0.8, 7, 124),
      { s: 'heart-red', a: 'frame', k: 'each', ax: 0.985, ay: 1, dy: 11, size: 50, rot: 14, alt: true, layer: 'front' },
      { s: 'bamboo', a: 'frame', k: 'each', ax: -0.045, ay: 0.5, size: 70, rot: -8, alt: true, layer: 'back' },
      { s: 'redpanda-tail', a: 'footer', ax: 0.1, dy: 74, size: 108, rot: -4, layer: 'front' },
      { s: 'redpanda-sit', a: 'footer', ax: 0.89, dy: 82, size: 118, rot: 0, layer: 'front' },
    ],
  },
];

export const DEFAULT_TEMPLATE = 'sky';

const BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
export function getTemplate(id) {
  return BY_ID[id] || BY_ID[DEFAULT_TEMPLATE];
}

/** Ubah daftar dekorasi template menjadi posisi absolut pada strip (satuan logis). */
export function resolveDecor(template, L) {
  const out = [];
  for (const d of template.decor || []) {
    const ks =
      d.a !== 'frame'
        ? [null]
        : d.k === 'each'
        ? L.frames.map((_, i) => i)
        : d.k === 'last'
        ? [L.frames.length - 1]
        : [typeof d.k === 'number' ? Math.min(d.k, L.frames.length - 1) : 0];
    for (const k of ks) {
      const odd = d.alt && k != null && k % 2 === 1;
      const ax = odd ? 1 - d.ax : d.ax;
      const rot = odd ? -(d.rot || 0) : d.rot || 0;
      let x;
      let y;
      if (d.a === 'frame') {
        const f = L.frames[k];
        x = f.x + ax * f.w + (d.dx || 0);
        y = f.y + (d.ay ?? 0) * f.h + (d.dy || 0);
      } else if (d.a === 'top') {
        x = ax * L.W + (d.dx || 0);
        y = d.dy || 0;
      } else {
        x = ax * L.W + (d.dx || 0);
        y = L.H - L.footer + (d.dy || 0);
      }
      out.push({ s: d.s, x, y, size: d.size, rot, layer: d.layer || 'front' });
    }
  }
  return out;
}
