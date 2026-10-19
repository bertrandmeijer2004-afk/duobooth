// Sesi pemotretan: hitung mundur bersama, tiap device memotret kameranya sendiri pada resolusi penuh,
// lalu foto dipertukarkan lewat server. Setiap device akhirnya memegang kedua sisi (host & guest)
// untuk setiap pose, sehingga hasil akhirnya identik di kedua layar.

import { sleep, loadImage, rid } from './lib/util.js';
import { captureFrame } from './camera.js';
import { isImageDataUrl } from './state.js';
import { MIN_SHOTS, MAX_SHOTS } from './lib/layout.js';

export const PROMPTS = [
  'Senyum manis! 😊',
  'Pose lucu! 🤪',
  'Pura-pura kaget! 😮',
  'Bikin hati pakai tangan! 🫶',
  'Saling tatap! 😍',
  'Peluk virtual! 🤗',
];

const READY_DELAY_MS = 1800;
const BETWEEN_SHOTS_MS = 1500;
const WAIT_FRAMES_MS = 8000;
const FINAL_WAIT_MS = 10000;

export class Session extends EventTarget {
  constructor(app) {
    super();
    this.app = app;
    this._token = 0;
    this.reset();
  }

  reset() {
    this._token++;
    clearTimeout(this._ft);
    this.sid = null;
    this.n = 0;
    this.timer = 3;
    this.status = 'idle'; // idle | shooting | recovering | done
    this.conductor = false;
    this.frames = [];
    this.current = -1;
    this.countdown = null;
    this.prompt = '';
    this.finishedLocal = false;
    this.peerDone = false;
    this._queue = Promise.resolve();
  }

  _emit(type = 'change') {
    this.dispatchEvent(new Event(type));
  }

  get shooting() {
    return this.status === 'shooting';
  }

  get hasPhotos() {
    return this.status === 'done' && this.frames.some((f) => f.host || f.guest);
  }

  /** Jumlah foto yang sudah kita pegang (untuk indikator). */
  get captured() {
    let c = 0;
    for (const f of this.frames) if (f.host && f.guest) c++;
    return c;
  }

  info() {
    return this.status === 'done' ? { sid: this.sid, n: this.n, timer: this.timer } : null;
  }

  // --- memulai --------------------------------------------------------------------
  start() {
    const app = this.app;
    if (this.status === 'shooting' || this.status === 'recovering' || !app.peer.online) return false;
    if (!app.cameraReady()) {
      app.toast('Kamera belum siap. Tunggu sebentar.', 'warn');
      return false;
    }
    const v = app.view();
    const sid = `${Date.now().toString(36)}-${rid(4)}`;
    app.shared.set('date', app.todayLabel());
    this._begin(sid, v.shots, v.timer, true);
    app.send({ t: 'start', sid, n: v.shots, timer: v.timer });
    this._runConductor(sid);
    return true;
  }

  _begin(sid, n, timer, conductor) {
    this.reset();
    this.sid = sid;
    this.n = Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, Math.round(n) || 4));
    this.timer = [3, 5, 10].includes(timer) ? timer : 3;
    this.conductor = conductor;
    this.frames = Array.from({ length: this.n }, () => ({ host: null, guest: null }));
    this.status = 'shooting';
    this.prompt = 'Siap-siap…';
    this._emit();
  }

  _alive(sid, token) {
    return token === this._token && this.sid === sid && this.status === 'shooting';
  }

  async _runConductor(sid) {
    const token = this._token;
    await sleep(READY_DELAY_MS);
    for (let i = 0; i < this.n; i++) {
      if (!this._alive(sid, token)) return;
      this.app.send({ t: 'shot', sid, i, timer: this.timer });
      await this._shot(i, sid, token);
      if (!this._alive(sid, token)) return;
      await sleep(BETWEEN_SHOTS_MS);
    }
    if (!this._alive(sid, token)) return;
    this.app.send({ t: 'done', sid });
    this._localDone();
  }

  async _shot(i, sid, token) {
    this.current = i;
    this.prompt = PROMPTS[i % PROMPTS.length];
    for (let c = this.timer; c >= 1; c--) {
      if (!this._alive(sid, token)) return;
      this.countdown = c;
      this._emit('tick');
      await sleep(1000);
    }
    if (!this._alive(sid, token)) return;
    this.countdown = 0;
    this._emit('tick');
    await this._capture(i, sid, token);
    if (this._alive(sid, token)) {
      this.countdown = null;
      this._emit('tick');
    }
  }

  async _capture(i, sid, token) {
    const app = this.app;
    const grab = captureFrame(app.localVideo);
    this._emit('flash');
    if (!grab) {
      app.toast(`Kamera belum siap untuk foto ${i + 1}`, 'warn');
      return;
    }
    let img;
    try {
      img = await loadImage(grab.src);
    } catch {
      return;
    }
    if (!this._alive(sid, token)) return;
    const role = app.role;
    this.frames[i][role] = { src: grab.src, img, w: grab.w, h: grab.h };
    app.send({ t: 'frame', sid, i, who: role, src: grab.src, w: grab.w, h: grab.h });
    this._emit();
    this._maybeFinish();
  }

  // --- selesai ------------------------------------------------------------------------
  _localDone() {
    this.finishedLocal = true;
    this._armFinishTimer();
    this._maybeFinish();
  }

  _missing() {
    const out = [];
    for (let i = 0; i < this.n; i++) {
      for (const who of ['host', 'guest']) if (!this.frames[i][who]) out.push(`${i}:${who}`);
    }
    return out;
  }

  _maybeFinish() {
    if (this.status === 'shooting') {
      if (!(this.finishedLocal || this.peerDone)) return;
      if (this._missing().length === 0) this.finish();
    } else if (this.status === 'recovering') {
      if (this._missing().length === 0) this.finish();
    }
  }

  _armFinishTimer() {
    clearTimeout(this._ft);
    const sid = this.sid;
    this._ft = setTimeout(() => {
      if (this.sid !== sid || (this.status !== 'shooting' && this.status !== 'recovering')) return;
      this.requestMissing();
      this._ft = setTimeout(() => {
        if (this.sid === sid && (this.status === 'shooting' || this.status === 'recovering')) this.finish();
      }, FINAL_WAIT_MS);
    }, WAIT_FRAMES_MS);
  }

  /** Minta pasangan mengirim ulang foto yang belum sampai. */
  requestMissing() {
    const keys = this._missing();
    if (keys.length && this.sid) this.app.send({ t: 'need', sid: this.sid, keys });
    return keys.length;
  }

  finish() {
    clearTimeout(this._ft);
    this._token++; // hentikan loop yang masih berjalan
    this.status = 'done';
    this.countdown = null;
    this.current = -1;
    this.prompt = '';
    this.app.setPhase('edit');
    this._emit();
    this.app.scheduleCutouts();
  }

  // --- pembatalan / ulang ------------------------------------------------------------
  abort(reason, notifyPeer = true) {
    if (this.status !== 'shooting' && this.status !== 'recovering') return;
    const sid = this.sid;
    this.reset();
    this._emit();
    if (notifyPeer) this.app.send({ t: 'abort', sid });
    if (reason) this.app.toast(reason, 'warn');
  }

  retake(notifyPeer = true) {
    this.reset();
    this.app.setPhase('booth');
    this._emit();
    if (notifyPeer) this.app.send({ t: 'retake' });
  }

  // --- pesan dari pasangan -----------------------------------------------------------
  onMessage(m) {
    switch (m.t) {
      case 'start':
        return this._onStart(m);
      case 'shot':
        return this._onShot(m);
      case 'frame':
        return this._onFrame(m);
      case 'done':
        if (m.sid === this.sid && this.status === 'shooting') {
          this.peerDone = true;
          this._armFinishTimer();
          this._maybeFinish();
        }
        return undefined;
      case 'abort':
        if (m.sid === this.sid) this.abort('Sesi foto dibatalkan oleh pasanganmu.', false);
        return undefined;
      case 'retake':
        this.retake(false);
        return undefined;
      case 'need':
        return this._onNeed(m);
      case 'need-session':
        return this._onNeedSession(m);
      case 'session-info':
        return this._onSessionInfo(m);
      default:
        return undefined;
    }
  }

  _onStart(m) {
    if (typeof m.sid !== 'string' || m.sid.length > 40) return;
    if (this.status === 'shooting') {
      // Dua orang menekan "Mulai" bersamaan: sid yang lebih kecil menang di kedua sisi.
      if (this.sid <= m.sid) return;
      this._token++;
    }
    this._begin(m.sid, m.n, m.timer, false);
  }

  _onShot(m) {
    if (m.sid !== this.sid || this.status !== 'shooting') return;
    const i = Math.round(m.i);
    if (!(i >= 0 && i < this.n)) return;
    const sid = this.sid;
    const token = this._token;
    this._queue = this._queue.then(() => this._shot(i, sid, token)).catch(() => {});
  }

  async _onFrame(m) {
    if (m.sid !== this.sid) return;
    if (this.status !== 'shooting' && this.status !== 'recovering' && this.status !== 'done') return;
    const i = Math.round(m.i);
    if (!(i >= 0 && i < this.n) || (m.who !== 'host' && m.who !== 'guest')) return;
    if (this.frames[i][m.who]) return; // jangan menimpa
    if (!isImageDataUrl(m.src)) return;
    const sid = this.sid;
    let img;
    try {
      img = await loadImage(m.src);
    } catch {
      return;
    }
    if (sid !== this.sid || this.frames[i][m.who]) return; // sesi berganti selama gambar dimuat
    this.frames[i][m.who] = { src: m.src, img, w: m.w | 0, h: m.h | 0 };
    this._emit();
    if (this.status === 'done') this.app.scheduleCutouts();
    this._maybeFinish();
  }

  async _onNeed(m) {
    if (m.sid !== this.sid || !Array.isArray(m.keys)) return;
    for (const key of m.keys.slice(0, 16)) {
      const [iStr, who] = String(key).split(':');
      const i = Number(iStr);
      const f = this.frames[i] && this.frames[i][who];
      if (f) {
        this.app.send({ t: 'frame', sid: this.sid, i, who, src: f.src, w: f.w, h: f.h });
        await sleep(40);
      }
    }
  }

  /** Pasangan yang baru tersambung/refresh meminta seluruh sesi yang sudah selesai. */
  async _onNeedSession(m) {
    if (this.status !== 'done' || m.sid !== this.sid) return;
    const sid = this.sid;
    this.app.send({ t: 'session-info', sid, n: this.n, timer: this.timer });
    for (let i = 0; i < this.n; i++) {
      for (const who of ['host', 'guest']) {
        if (this.sid !== sid) return;
        const f = this.frames[i][who];
        if (f) {
          this.app.send({ t: 'frame', sid, i, who, src: f.src, w: f.w, h: f.h });
          await sleep(40);
        }
      }
    }
  }

  _onSessionInfo(m) {
    if (typeof m.sid !== 'string' || m.sid.length > 40) return;
    if (this.status === 'shooting' || this.sid === m.sid) return;
    this.reset();
    this.sid = m.sid;
    this.n = Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, Math.round(m.n) || 4));
    this.timer = [3, 5, 10].includes(m.timer) ? m.timer : 3;
    this.frames = Array.from({ length: this.n }, () => ({ host: null, guest: null }));
    this.status = 'recovering';
    this._armFinishTimer();
    this._emit();
  }

  /** Dipanggil saat menerima hello: apakah pasangan punya sesi yang lebih baru dari kita? */
  onPeerSession(info) {
    if (!info || typeof info.sid !== 'string') return;
    if (this.status === 'shooting') return;
    if (this.sid && this.sid >= info.sid) return; // sudah punya sesi yang sama atau lebih baru
    this.app.send({ t: 'need-session', sid: info.sid });
  }
}
