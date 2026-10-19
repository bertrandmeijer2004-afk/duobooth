// Klien signaling WebSocket: buat/gabung room, relay pesan, dan sambung ulang otomatis
// (HP sering memutus koneksi saat aplikasi pindah ke latar belakang).

const HEARTBEAT_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;

export class Signaling extends EventTarget {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.ws = null;
    this.code = null; // room yang sedang diikuti (untuk sambung ulang)
    this.role = null;
    this.status = 'idle'; // idle | connecting | open | reconnecting | closed
    this.closedByUser = false;
    this.pending = null;
    this.backoff = 500;
    this.reconnectTimer = null;
    this.hbTimer = null;
    this.pongTimer = null;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._wake();
    });
    window.addEventListener('online', () => this._wake());
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this._emit('status', s);
  }

  _url() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  /** Buka koneksi. Resolve saat terbuka, reject bila gagal/timeout. */
  connect() {
    this.closedByUser = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this._opening) return this._opening;
    this._setStatus(this.code ? 'reconnecting' : 'connecting');
    this._opening = new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(this._url());
      } catch (e) {
        this._opening = null;
        reject(e);
        return;
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          /* abaikan */
        }
        reject(new Error('Waktu tunggu koneksi habis'));
      }, 10_000);
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._setStatus('open');
        this._startHeartbeat();
        resolve();
      };
      ws.onmessage = (ev) => this._onMessage(ws, ev);
      ws.onclose = (ev) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(new Error('Koneksi ditutup'));
        }
        this._onClose(ws, ev && ev.code);
      };
      ws.onerror = () => {};
    }).finally(() => {
      this._opening = null;
    });
    return this._opening;
  }

  _onMessage(ws, ev) {
    if (ws !== this.ws) return;
    clearTimeout(this.pongTimer);
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'joined':
        this.code = msg.code;
        this.role = msg.role;
        this._resolvePending(msg);
        break;
      case 'error':
        if (!this._rejectPending(msg.code)) this._emit('server-error', msg.code);
        break;
      case 'peer-online':
        this._emit('peer-online');
        break;
      case 'peer-offline':
        this._emit('peer-offline');
        break;
      case 'peer-left':
        this._emit('peer-left');
        break;
      case 'relay':
        this._emit('relay', msg.data);
        break;
      default:
        break;
    }
  }

  _onClose(ws, code) {
    if (ws !== this.ws) return;
    this._stopHeartbeat();
    this._rejectPending('CONNECTION_LOST');
    if (code === 4001) {
      // server menutup koneksi ini karena room yang sama dibuka di tab/jendela lain
      this.closedByUser = true;
      this.code = null;
      this._setStatus('closed');
      this._emit('replaced');
      return;
    }
    if (this.closedByUser) {
      this._setStatus('closed');
      return;
    }
    if (this.code) {
      this._setStatus('reconnecting');
      this._emit('disconnected');
      this._scheduleReconnect();
    } else {
      this._setStatus('closed');
    }
  }

  _scheduleReconnect(immediate = false) {
    if (this.closedByUser || !this.code) return;
    if (this.reconnectTimer) {
      if (!immediate) return;
      clearTimeout(this.reconnectTimer);
    }
    const wait = immediate ? 0 : this.backoff;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.closedByUser || !this.code) return;
      try {
        await this.connect();
        await this._rejoin();
        this.backoff = 500;
      } catch (e) {
        if (e && e.message === 'ROOM_NOT_FOUND') return;
        this.backoff = Math.min(Math.round(this.backoff * 1.8), 8000);
        this._scheduleReconnect();
      }
    }, wait);
  }

  /** Dipanggil saat tab kembali aktif / jaringan kembali: sambung ulang tanpa menunggu. */
  _wake() {
    if (this.closedByUser || !this.code) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.backoff = 500;
      this._scheduleReconnect(true);
    } else {
      this._sendRaw({ type: 'ping', t: Date.now() });
      this._armPongTimer();
    }
  }

  async _rejoin() {
    try {
      const res = await this._request({ type: 'join', clientId: this.clientId, code: this.code });
      this._emit('rejoined', { code: res.code, role: res.role, peerOnline: !!res.peerOnline });
    } catch (e) {
      if (e && e.message === 'ROOM_NOT_FOUND') {
        const code = this.code;
        this.code = null;
        this._emit('room-lost', code);
      }
      throw e;
    }
  }

  // --- permintaan/respons sederhana (satu per satu) ---------------------------
  _request(msg, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error('CONNECTION_LOST'));
      this._rejectPending('SUPERSEDED');
      const timer = setTimeout(() => this._rejectPending('TIMEOUT'), timeoutMs);
      this.pending = { resolve, reject, timer };
      this._sendRaw(msg);
    });
  }
  _resolvePending(msg) {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    clearTimeout(p.timer);
    p.resolve(msg);
  }
  _rejectPending(code) {
    if (!this.pending) return false;
    const p = this.pending;
    this.pending = null;
    clearTimeout(p.timer);
    p.reject(new Error(code));
    return true;
  }

  _sendRaw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  // --- API ----------------------------------------------------------------------
  create() {
    return this._request({ type: 'create', clientId: this.clientId });
  }
  join(code) {
    return this._request({ type: 'join', clientId: this.clientId, code });
  }
  /** Kirim pesan ke pasangan. Mengembalikan false bila koneksi sedang terputus. */
  relay(data) {
    return this._sendRaw({ type: 'relay', data });
  }
  get connected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  leave() {
    this.closedByUser = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this._sendRaw({ type: 'leave' });
    this.code = null;
    this.role = null;
    this._stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    try {
      ws && ws.close();
    } catch {
      /* abaikan */
    }
    this._setStatus('closed');
  }

  // --- keep-alive ---------------------------------------------------------------
  _startHeartbeat() {
    this._stopHeartbeat();
    this.hbTimer = setInterval(() => {
      if (!this._sendRaw({ type: 'ping', t: Date.now() })) return;
      this._armPongTimer();
    }, HEARTBEAT_MS);
  }
  _armPongTimer() {
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      // tidak ada balasan: anggap koneksi mati dan paksa sambung ulang
      try {
        this.ws && this.ws.close();
      } catch {
        /* abaikan */
      }
    }, PONG_TIMEOUT_MS);
  }
  _stopHeartbeat() {
    clearInterval(this.hbTimer);
    clearTimeout(this.pongTimer);
    this.hbTimer = null;
    this.pongTimer = null;
  }
}
