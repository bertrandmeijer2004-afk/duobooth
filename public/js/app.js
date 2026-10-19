// Pengendali utama: menyatukan signaling, kamera, WebRTC, state bersama, dan sesi foto.

import { Signaling } from './net.js';
import { SharedState, buildView, isImageDataUrl } from './state.js';
import { PeerLink } from './rtc.js';
import { openCamera, makeVideo, describeCameraError, captureFrame } from './camera.js';
import { Session } from './session.js';
import { rid, formatDateID, sleep, throttle } from './lib/util.js';
import { getSticker, getUploaded, uploadedLuma, whenReady } from './lib/assets.js';
import { makeCutout } from './lib/segment.js';
import { renderStrip, stickerIdsUsed } from './lib/render.js';
import { computeLayout } from './lib/layout.js';

const CID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const DEFAULT_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export function normalizeCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export function describeSignalError(err) {
  const code = (err && err.message) || String(err);
  switch (code) {
    case 'ROOM_NOT_FOUND':
      return 'Room tidak ditemukan. Periksa lagi kodenya, atau minta pasanganmu membuat room baru.';
    case 'ROOM_FULL':
      return 'Room ini sudah penuh (sudah ada dua orang di dalamnya).';
    case 'RATE_LIMIT':
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    case 'SERVER_BUSY':
      return 'Server sedang penuh. Coba lagi beberapa saat lagi.';
    case 'BAD_REQUEST':
      return 'Permintaan tidak valid. Muat ulang halaman lalu coba lagi.';
    default:
      return 'Tidak bisa terhubung ke server. Periksa koneksi internetmu lalu coba lagi.';
  }
}

function store(kind) {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

export class App extends EventTarget {
  constructor() {
    super();
    const ss = store('sessionStorage');
    let cid = ss && ss.getItem('duo-cid');
    if (!cid || !CID_RE.test(cid)) {
      cid = rid(20);
      try {
        ss && ss.setItem('duo-cid', cid);
      } catch {
        /* abaikan */
      }
    }
    this.clientId = cid;
    this.boot = rid(10);
    const ls = store('localStorage');
    this.name = (ls && ls.getItem('duo-name')) || '';

    this.phase = 'lobby'; // lobby | booth | edit
    this.role = null;
    this.code = null;
    this.peer = { online: false, boot: null, camOk: true };
    this.conn = 'idle';
    this.rtc = 'idle';
    this.micOn = true;
    this.needsPlayTap = false;
    this.pv = null; // gambar pratinjau cadangan dari pasangan {src, at}
    this.cutouts = { running: false, done: 0, total: 0, error: null };
    this.localVideo = makeVideo({ muted: true });
    this.remoteVideo = makeVideo({ muted: false });
    this.stream = null;
    this.link = null;
    this.iceServers = null;

    this.shared = new SharedState(cid);
    this.sig = new Signaling(cid);
    this.session = new Session(this);
    this.env = {
      sticker: getSticker,
      image: (id) => {
        const src = this.shared.get('img:' + id);
        return isImageDataUrl(src) ? getUploaded(id, src) : null;
      },
      imageLuma: (id) => uploadedLuma(id),
    };
    this._wire();

    const m = location.pathname.match(/^\/r\/([A-Za-z0-9-]+)\/?$/);
    this.inviteCode = m ? normalizeCode(m[1]) : null;
    this.savedRoom = null;
    try {
      const s = JSON.parse((ss && ss.getItem('duo-room')) || 'null');
      if (s && typeof s.code === 'string') this.savedRoom = s;
    } catch {
      /* abaikan */
    }
    // membuka tautan undangan ke room LAIN di tab yang sama -> abaikan room tersimpan
    if (this.inviteCode && this.savedRoom && this.savedRoom.code !== this.inviteCode) this.savedRoom = null;
  }

  // --- pengamat -------------------------------------------------------------------------
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  on(type, fn) {
    const h = (e) => fn(e.detail);
    this.addEventListener(type, h);
    return () => this.removeEventListener(type, h);
  }
  toast(msg, kind = 'info') {
    this.emit('toast', { msg, kind });
  }

  _wire() {
    // Perubahan beruntun (mis. menyeret stiker) digabung per kunci dan dikirim paling cepat tiap 60 ms.
    this._pendingOps = new Map();
    this._flushOps = throttle(() => {
      const ops = [...this._pendingOps.values()];
      this._pendingOps.clear();
      if (ops.length) this.send({ t: 'ops', ops });
    }, 60);
    this.shared.onLocalOps = (ops) => {
      for (const op of ops) this._pendingOps.set(op.k, op);
      this._flushOps();
    };
    this.shared.addEventListener('change', (e) => {
      this.emit('state', e.detail);
      if (e.detail.keys.includes('photoBg') || e.detail.keys.includes('*')) this.scheduleCutouts();
    });
    this.session.addEventListener('change', () => this.emit('session'));
    this.session.addEventListener('tick', () => this.emit('session'));
    this.session.addEventListener('flash', () => this.emit('flash'));

    const sig = this.sig;
    sig.addEventListener('status', (e) => {
      this.conn = e.detail === 'reconnecting' ? 'reconnecting' : e.detail === 'open' ? 'ok' : this.conn;
      this.emit('conn');
    });
    sig.addEventListener('relay', (e) => this.onRelay(e.detail));
    sig.addEventListener('rejoined', (e) => this.onJoined(e.detail));
    sig.addEventListener('peer-online', () => this.onPeerOnline());
    sig.addEventListener('peer-offline', () => this.onPeerOffline(false));
    sig.addEventListener('peer-left', () => this.onPeerOffline(true));
    sig.addEventListener('disconnected', () => {
      this.conn = 'reconnecting';
      this.emit('conn');
    });
    sig.addEventListener('replaced', () => {
      this.toast('Room ini dibuka di tab atau jendela lain, jadi tab ini ditutup.', 'warn');
      this.leave();
    });
    sig.addEventListener('room-lost', () => {
      this.toast('Room sudah berakhir. Silakan buat room baru.', 'warn');
      this.leave();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.code) {
        this.requestWakeLock();
        this.localVideo.play().catch(() => {});
        this.remoteVideo.play().catch(() => {});
      }
    });
  }

  // --- tampilan & ekspor ------------------------------------------------------------------
  view() {
    const v = buildView(this.shared, { frames: this.session.frames });
    // Setelah sesi dimulai, jumlah pose ditentukan oleh foto yang benar-benar diambil,
    // bukan oleh pengaturan "Jumlah foto" yang masih bisa berubah.
    if (this.session.frames.length) v.shots = this.session.frames.length;
    return v;
  }

  todayLabel() {
    return formatDateID(new Date());
  }

  setPhase(p) {
    if (this.phase === p) return;
    this.phase = p;
    this.emit('phase', p);
  }

  async exportCanvas(scale = 2) {
    const v = this.view();
    if (this._cutoutLoop) await this._cutoutLoop.catch(() => {});
    const uploadIds = [v.bg, v.photoBg].filter((s) => s && s.type === 'image').map((s) => s.id);
    await whenReady(stickerIdsUsed(v), uploadIds, (id) => this.shared.get('img:' + id));
    const L = computeLayout(v.shots);
    const c = document.createElement('canvas');
    c.width = Math.round(L.W * scale);
    c.height = Math.round(L.H * scale);
    renderStrip(c.getContext('2d'), v, { scale, env: this.env });
    return c;
  }

  // --- nama --------------------------------------------------------------------------------
  setName(name) {
    this.name = String(name || '').trim().slice(0, 24);
    const ls = store('localStorage');
    try {
      ls && ls.setItem('duo-name', this.name);
    } catch {
      /* abaikan */
    }
    if (this.role) this.shared.set('name:' + this.role, this.name);
  }

  // --- kamera ------------------------------------------------------------------------------
  cameraReady() {
    return !!this.stream && this.localVideo.readyState >= 2 && this.localVideo.videoWidth > 0;
  }
  get hasMic() {
    return !!this.stream && this.stream.getAudioTracks().length > 0;
  }

  async startCamera(deviceId = null) {
    if (this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live') && !deviceId) return this.stream;
    let stream;
    try {
      stream = await openCamera({ deviceId });
    } catch (e) {
      const err = new Error(describeCameraError(e));
      err.name = 'CameraError';
      throw err;
    }
    const old = this.stream;
    this.stream = stream;
    this.localVideo.srcObject = stream;
    await this.localVideo.play().catch(() => {});
    stream.getAudioTracks().forEach((t) => (t.enabled = this.micOn));
    stream.getVideoTracks().forEach((t) =>
      t.addEventListener('ended', () => {
        if (this.stream === stream) {
          this.toast('Kamera terputus. Tekan "Coba lagi" untuk menyalakan ulang.', 'warn');
          this.emit('camera');
        }
      })
    );
    if (this.link) {
      this.link.setLocalStream(stream);
      const vt = stream.getVideoTracks()[0];
      const at = stream.getAudioTracks()[0];
      if (vt) this.link.replaceTrack('video', vt);
      if (at) this.link.replaceTrack('audio', at);
    }
    if (old) old.getTracks().forEach((t) => t.stop());
    this.emit('camera');
    return stream;
  }

  stopCamera() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.localVideo.srcObject = null;
    this.emit('camera');
  }

  setMic(on) {
    this.micOn = !!on;
    if (this.stream) this.stream.getAudioTracks().forEach((t) => (t.enabled = this.micOn));
    this.emit('camera');
  }

  // --- masuk / keluar room ------------------------------------------------------------------
  async ensureConfig() {
    if (this.iceServers) return;
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      const cfg = await r.json();
      this.iceServers = Array.isArray(cfg.iceServers) && cfg.iceServers.length ? cfg.iceServers : DEFAULT_ICE;
    } catch {
      this.iceServers = DEFAULT_ICE;
    }
  }

  /** mode: 'create' | 'join' */
  async enter(mode, code, name) {
    if (name !== undefined) this.name = String(name || '').trim().slice(0, 24);
    this.setName(this.name);
    await this.ensureConfig();
    try {
      await this.startCamera();
      await this.sig.connect();
      const res = mode === 'create' ? await this.sig.create() : await this.sig.join(normalizeCode(code));
      this.onJoined(res);
      this.setPhase('booth');
      this.requestWakeLock();
    } catch (e) {
      this.stopCamera();
      this.sig.leave();
      if (e && e.name === 'CameraError') throw e;
      const err = new Error(describeSignalError(e));
      err.code = e && e.message;
      throw err;
    }
  }

  /** Setelah refresh: kembali ke room yang sama (clientId sama -> slot yang sama). */
  async autoRejoin() {
    const s = this.savedRoom;
    if (!s || !s.code) return false;
    await this.enter('join', s.code);
    return true;
  }

  onJoined(res) {
    this.code = res.code;
    this.role = res.role;
    const ss = store('sessionStorage');
    try {
      ss && ss.setItem('duo-room', JSON.stringify({ code: res.code, role: res.role }));
    } catch {
      /* abaikan */
    }
    try {
      history.replaceState(null, '', `/r/${res.code}`);
    } catch {
      /* abaikan */
    }
    if (!this.link) this._makeLink();
    this.shared.set('name:' + this.role, this.name);
    this.peer.online = !!res.peerOnline;
    this.conn = 'ok';
    if (res.peerOnline) this.sendHello();
    this.emit('room');
    this.emit('peer');
  }

  _makeLink() {
    const link = new PeerLink({
      iceServers: this.iceServers || DEFAULT_ICE,
      offerer: this.role === 'host',
      signal: (m) => this.send({ t: 'rtc', ...m }),
    });
    link.setLocalStream(this.stream);
    link.addEventListener('remote-stream', (e) => this._attachRemote(e.detail));
    link.addEventListener('state', (e) => {
      this.rtc = e.detail;
      this._rtcSince = Date.now();
      this.emit('rtc');
    });
    this.link = link;
    this._rtcSince = Date.now();
    this._startPreviewLoop();
  }

  // --- mode cadangan: pratinjau pasangan lewat server bila video langsung (WebRTC) gagal -----------------
  _needFallback() {
    if (this.rtc === 'connected') return false;
    if (this.rtc === 'failed') return true;
    return Date.now() - (this._rtcSince || Date.now()) > 6000; // beri waktu WebRTC dulu
  }

  _startPreviewLoop() {
    clearInterval(this._pvTimer);
    this._pvTimer = setInterval(() => {
      if (!this.peer.online || this.phase !== 'booth' || document.visibilityState !== 'visible') return;
      if (!this._needFallback()) return;
      const grab = captureFrame(this.localVideo, { maxSide: 320, quality: 0.55 });
      if (grab) this.send({ t: 'pv', d: grab.src });
    }, 250);
  }

  /** Apakah gambar cadangan dari pasangan sedang mengalir? */
  get fallbackLive() {
    return !!this.pv && this.rtc !== 'connected' && Date.now() - this.pv.at < 2500;
  }

  _attachRemote(stream) {
    this.remoteVideo.srcObject = stream;
    this.remoteVideo.muted = false;
    this.needsPlayTap = false;
    this.remoteVideo.play().catch(() => {
      // Safari/iOS bisa memblokir suara otomatis: tetap tampilkan video tanpa suara, minta ketukan.
      this.remoteVideo.muted = true;
      this.remoteVideo.play().catch(() => {});
      this.needsPlayTap = true;
      this.emit('rtc');
    });
    this.emit('rtc');
  }

  /** Dipanggil dari tombol agar suara pasangan menyala (butuh gestur pengguna). */
  enableRemoteAudio() {
    this.remoteVideo.muted = false;
    this.remoteVideo.play().catch(() => {});
    this.needsPlayTap = false;
    this.emit('rtc');
  }

  leave() {
    clearInterval(this._pvTimer);
    this.pv = null;
    this.sig.leave();
    if (this.link) this.link.close();
    this.link = null;
    this.stopCamera();
    this.remoteVideo.srcObject = null;
    this.session.reset();
    this.shared.clear();
    this.peer = { online: false, boot: null, camOk: true };
    this.role = null;
    this.code = null;
    this.rtc = 'idle';
    this.conn = 'idle';
    this.cutouts = { running: false, done: 0, total: 0, error: null };
    this.savedRoom = null;
    this.inviteCode = null;
    const ss = store('sessionStorage');
    try {
      ss && ss.removeItem('duo-room');
    } catch {
      /* abaikan */
    }
    try {
      history.replaceState(null, '', '/');
    } catch {
      /* abaikan */
    }
    if (this._wl) {
      this._wl.release().catch(() => {});
      this._wl = null;
    }
    this.setPhase('lobby');
    this.emit('room');
    this.emit('peer');
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && (!this._wl || this._wl.released)) {
        this._wl = await navigator.wakeLock.request('screen');
      }
    } catch {
      /* tidak didukung / ditolak: abaikan */
    }
  }

  // --- pesan antar pasangan ----------------------------------------------------------------------
  send(msg) {
    return this.sig.relay(msg);
  }

  sendHello() {
    this.send({
      t: 'hello',
      boot: this.boot,
      name: this.name,
      role: this.role,
      cam: this.cameraReady(),
      session: this.session.info(),
    });
  }

  onPeerOnline() {
    this.peer.online = true;
    this.emit('peer');
    this.sendHello();
  }

  onPeerOffline(left) {
    this.peer.online = false;
    if (left) this.peer.boot = null;
    this.emit('peer');
    if (this.session.status === 'shooting' || this.session.status === 'recovering') {
      this.session.abort('Pasanganmu terputus, sesi foto dibatalkan.', false);
    }
  }

  onRelay(m) {
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        this.onHello(m);
        break;
      case 'ops':
        this.applyOps(m.ops);
        break;
      case 'rtc':
        if (this.link) this.link.onSignal(m);
        break;
      case 'pv':
        if (isImageDataUrl(m.d) && m.d.length < 150_000) {
          this.pv = { src: m.d, at: Date.now() };
          this.emit('pv');
        }
        break;
      default:
        this.session.onMessage(m);
    }
  }

  onHello(m) {
    if (typeof m.boot !== 'string') return;
    const bootChanged = m.boot !== this.peer.boot;
    this.peer.online = true;
    this.peer.boot = m.boot;
    this.peer.camOk = m.cam !== false;
    this.emit('peer');

    // samakan state bersama (dua arah; yang lebih baru menang per kunci)
    this.send({ t: 'ops', ops: this.shared.snapshot() });

    if (bootChanged) {
      // pasangan baru / refresh: bangun ulang koneksi video
      if (this.role === 'host' && this.link) this.link.begin();
    } else if (this.role === 'host' && this.link && this.link.state !== 'connected' && this.link.state !== 'connecting') {
      this.link.begin();
    }
    this.session.onPeerSession(m.session);
  }

  applyOps(ops) {
    if (!Array.isArray(ops)) return;
    const safe = ops.filter((op) => op && typeof op.k === 'string' && (!op.k.startsWith('img:') || isImageDataUrl(op.v)));
    this.shared.apply(safe);
  }

  // --- ganti latar di belakang orang ---------------------------------------------------------------
  scheduleCutouts() {
    if (!this.view().photoBg) return;
    if (this._cutoutLoop) {
      this._cutoutDirty = true;
      return;
    }
    this._cutoutLoop = (async () => {
      try {
        do {
          this._cutoutDirty = false;
          const items = [];
          for (const f of this.session.frames) {
            for (const who of ['host', 'guest']) {
              const it = f[who];
              if (it && !it.cutout && !it.cutoutFailed) items.push(it);
            }
          }
          this.cutouts = { running: items.length > 0, done: 0, total: items.length, error: this.cutouts.error };
          this.emit('cutouts');
          for (const it of items) {
            if (!this.view().photoBg) break;
            try {
              it.cutout = await makeCutout(it.img);
              this.cutouts.error = null;
            } catch (e) {
              console.warn('[segment]', e);
              it.cutoutFailed = true;
              this.cutouts.error = e;
              break; // kemungkinan model gagal dimuat: jangan ulangi untuk setiap foto
            }
            this.cutouts.done++;
            this.emit('cutouts');
            await sleep(0);
          }
        } while (this._cutoutDirty);
      } finally {
        this._cutoutLoop = null;
        this.cutouts.running = false;
        this.emit('cutouts');
      }
    })();
  }

  retryCutouts() {
    for (const f of this.session.frames) {
      for (const who of ['host', 'guest']) if (f[who]) f[who].cutoutFailed = false;
    }
    this.cutouts.error = null;
    this.scheduleCutouts();
  }
}
