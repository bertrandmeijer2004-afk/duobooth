// Kamera & mikrofon: izin, penanganan error yang ramah, dan pengambilan frame.

export function cameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Pesan error bahasa Indonesia yang bisa ditindaklanjuti pengguna. */
export function describeCameraError(err) {
  if (!cameraSupported()) {
    if (!window.isSecureContext) {
      return 'Kamera hanya bisa dipakai lewat HTTPS (atau localhost). Buka situs ini dengan alamat https://.';
    }
    return 'Browser ini tidak mendukung akses kamera. Coba Chrome, Safari, atau Firefox versi terbaru.';
  }
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Izin kamera ditolak. Klik ikon gembok/kamera di address bar, izinkan kamera, lalu coba lagi.';
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return 'Kamera tidak ditemukan di device ini.';
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.';
    default:
      return `Tidak bisa membuka kamera${err && err.message ? ` (${err.message})` : ''}.`;
  }
}

/**
 * Buka kamera (+ mikrofon bila memungkinkan). Bila mikrofon gagal, lanjut tanpa suara.
 * @returns {Promise<MediaStream>}
 */
export async function openCamera({ deviceId = null } = {}) {
  if (!cameraSupported()) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
  const video = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

  const attempts = [
    { video, audio },
    { video, audio: false },
    { video: true, audio: false },
  ];
  let lastErr;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastErr = e;
      // Izin ditolak untuk kamera: percobaan berikutnya tidak akan membantu.
      if (!constraints.audio && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break;
    }
  }
  throw lastErr;
}

export async function listCameras() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}

/** Ambil satu frame dari elemen <video> sebagai JPEG data URL. */
export function captureFrame(video, { maxSide = 1280, quality = 0.88 } = {}) {
  const vw = video && video.videoWidth;
  const vh = video && video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;
  const s = Math.min(1, maxSide / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * s));
  const h = Math.max(1, Math.round(vh * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(video, 0, 0, w, h);
  return { src: c.toDataURL('image/jpeg', quality), w, h };
}

/** Elemen <video> yang aman untuk iOS/Android (inline, tanpa kontrol). */
export function makeVideo({ muted }) {
  const v = document.createElement('video');
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  v.muted = !!muted;
  v.disablePictureInPicture = true;
  return v;
}
