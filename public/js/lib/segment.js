// Ganti latar di belakang orang ("virtual background") dengan MediaPipe Selfie Segmenter.
//
// Library dan model dimuat dari CDN hanya saat fitur ini dipakai pertama kali (+/- 10 MB),
// jadi tidak membebani pemakaian biasa. Pemrosesan berjalan 100% di browser: foto tidak dikirim
// ke server mana pun.

// Versi yang sudah dikenal baik lebih dulu; bila gagal dimuat, coba versi terbaru.
const MP_BASES = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision',
];
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

let segmenterPromise = null;
/** Hook untuk pengujian: (canvas) => Promise<{ w, h, masks: Float32Array[] }> */
let override = null;
export function setSegmenterOverride(fn) {
  override = fn;
}

async function loadSegmenter() {
  let lastErr = null;
  for (const base of MP_BASES) {
    try {
      const mod = await import(/* webpackIgnore: true */ `${base}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
      return await mod.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      });
    } catch (e) {
      lastErr = e;
      console.warn('[segment] gagal memuat dari', base, e);
    }
  }
  throw lastErr || new Error('Tidak bisa memuat model segmentasi');
}

function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = loadSegmenter().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}

/** Mulai memuat model lebih awal (mis. saat panel "Latar Foto" dibuka). */
export function warmUp() {
  if (override) return Promise.resolve();
  return getSegmenter().then(() => {});
}

function safeClose(x) {
  try {
    if (x && typeof x.close === 'function') x.close();
  } catch {
    /* abaikan */
  }
}

/** Jalankan model pada kanvas kecil. Mengembalikan salinan mask (Float32, 0..1) untuk tiap kandidat. */
async function runModel(canvas) {
  if (override) return override(canvas);
  const segmenter = await getSegmenter();
  const result = segmenter.segment(canvas);
  const masks = [];
  let w = canvas.width;
  let h = canvas.height;
  try {
    const conf = result.confidenceMasks || [];
    if (conf.length) {
      for (const m of conf) {
        w = m.width;
        h = m.height;
        masks.push(new Float32Array(m.getAsFloat32Array()));
      }
    } else if (result.categoryMask) {
      const m = result.categoryMask;
      w = m.width;
      h = m.height;
      let raw;
      try {
        raw = m.getAsUint8Array();
      } catch {
        raw = m.getAsFloat32Array();
      }
      const f = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) f[i] = raw[i] > 0 ? 1 : 0;
      masks.push(f);
    }
  } finally {
    (result.confidenceMasks || []).forEach(safeClose);
    safeClose(result.categoryMask);
    safeClose(result);
  }
  if (!masks.length) throw new Error('Model tidak menghasilkan mask');
  return { w, h, masks };
}

/**
 * Pilih mask yang berisi "orang". Urutan label model tidak diandalkan: orang pada foto selfie
 * hampir selalu ada di tengah, sedangkan tepi foto adalah latar. Mask dengan selisih
 * (rata-rata tengah - rata-rata tepi) terbesar dianggap mask orang. Bila selisihnya negatif, dibalik.
 */
export function pickPersonMask(w, h, masks) {
  const mean = (data, x0, x1, y0, y1) => {
    let s = 0;
    let n = 0;
    for (let y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++) {
      for (let x = Math.floor(x0 * w); x < Math.ceil(x1 * w); x++) {
        s += data[y * w + x];
        n++;
      }
    }
    return n ? s / n : 0;
  };
  let best = null;
  for (const data of masks) {
    const center = mean(data, 0.35, 0.65, 0.3, 0.9);
    const edgeL = mean(data, 0, 0.08, 0.1, 0.9);
    const edgeR = mean(data, 0.92, 1, 0.1, 0.9);
    const edgeT = mean(data, 0.1, 0.9, 0, 0.06);
    const edge = (edgeL + edgeR + edgeT) / 3;
    const score = center - edge;
    if (!best || Math.abs(score) > Math.abs(best.score)) best = { data, score };
  }
  if (best.score >= 0) return best.data;
  const inv = new Float32Array(best.data.length);
  for (let i = 0; i < inv.length; i++) inv[i] = 1 - best.data[i];
  return inv;
}

/** Haluskan tepi: kontras (smoothstep) lalu blur kotak ringan. */
export function refineAlpha(prob, w, h, radius = 2) {
  const a = new Float32Array(prob.length);
  for (let i = 0; i < a.length; i++) {
    const t = Math.min(1, Math.max(0, (prob[i] - 0.3) / 0.4));
    a[i] = t * t * (3 - 2 * t);
  }
  if (radius <= 0) return a;
  const tmp = new Float32Array(a.length);
  const k = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -radius; d <= radius; d++) s += a[y * w + Math.min(w - 1, Math.max(0, x + d))];
      tmp[y * w + x] = s / k;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -radius; d <= radius; d++) s += tmp[Math.min(h - 1, Math.max(0, y + d)) * w + x];
      a[y * w + x] = s / k;
    }
  }
  return a;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Potong orang dari foto. Mengembalikan kanvas transparan (latar dihapus).
 * @param {CanvasImageSource & {naturalWidth?: number}} img
 */
export async function makeCutout(img, { inferSide = 640, outSide = 1000 } = {}) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) throw new Error('Gambar kosong');

  const si = Math.min(1, inferSide / Math.max(sw, sh));
  const small = makeCanvas(sw * si, sh * si);
  small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);

  const { w, h, masks } = await runModel(small);
  const person = pickPersonMask(w, h, masks);
  const alpha = refineAlpha(person, w, h, 2);

  const maskCanvas = makeCanvas(w, h);
  const mctx = maskCanvas.getContext('2d');
  const data = mctx.createImageData(w, h);
  for (let i = 0; i < alpha.length; i++) data.data[i * 4 + 3] = Math.round(alpha[i] * 255);
  mctx.putImageData(data, 0, 0);

  const so = Math.min(1, outSide / Math.max(sw, sh));
  const out = makeCanvas(sw * so, sh * so);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'source-over';
  return out;
}
