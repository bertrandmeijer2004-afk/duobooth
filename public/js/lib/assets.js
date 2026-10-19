// Pemuat aset dengan notifikasi: saat sebuah stiker/gambar selesai dimuat, pratinjau digambar ulang.

import { loadImage } from './util.js';
import { stickerImage, loadSticker, STICKERS } from './stickers.js';

const listeners = new Set();
export function onAssetLoad(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  for (const cb of listeners) cb();
}

// --- Stiker ---------------------------------------------------------------
const stickerPending = new Set();

/** Ambil stiker (sinkron). Bila belum dimuat, mulai memuat dan kembalikan null. */
export function getSticker(id) {
  const img = stickerImage(id);
  if (img) return img;
  if (STICKERS[id] && !stickerPending.has(id)) {
    stickerPending.add(id);
    loadSticker(id)
      .then(notify)
      .catch(() => {})
      .finally(() => stickerPending.delete(id));
  }
  return null;
}

// --- Gambar unggahan (data URL dari state bersama) -----------------------------
const uploads = new Map(); // id -> { src, img, luma, loading }

function computeLuma(img) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / (64 * 255);
  } catch {
    return 0.6;
  }
}

/** Ambil gambar unggahan; `src` = data URL terbaru dari state bersama. */
export function getUploaded(id, src) {
  if (!src) return null;
  let rec = uploads.get(id);
  if (!rec || rec.src !== src) {
    rec = { src, img: null, luma: 0.6, loading: true };
    uploads.set(id, rec);
    loadImage(src)
      .then((img) => {
        rec.img = img;
        rec.luma = computeLuma(img);
        rec.loading = false;
        notify();
      })
      .catch(() => {
        rec.loading = false;
      });
  }
  return rec.img;
}

export function uploadedLuma(id) {
  return uploads.get(id)?.luma ?? 0.6;
}

/** Tunggu sampai semua stiker yang dibutuhkan dan gambar unggahan siap (untuk ekspor). */
export async function whenReady(stickerIds, uploadIds = [], getSrc = () => null) {
  await Promise.all([...new Set(stickerIds)].map((id) => loadSticker(id).catch(() => null)));
  for (const id of uploadIds) {
    const src = getSrc(id);
    if (!src) continue;
    getUploaded(id, src);
    for (let i = 0; i < 100 && !uploads.get(id)?.img && uploads.get(id)?.loading; i++) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}

// --- Kecilkan gambar sebelum diunggah / dikirim -------------------------------
export async function fileToDataUrl(file, maxSide = 1200, quality = 0.86) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
