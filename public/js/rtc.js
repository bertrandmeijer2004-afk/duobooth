// Koneksi video peer-to-peer (WebRTC). Host selalu menjadi pihak yang menawarkan (offer),
// guest yang menjawab. Tidak ada glare/renegosiasi bersamaan, jadi logikanya sederhana dan stabil.

import { rid } from './lib/util.js';

const plainDesc = (d) => ({ type: d.type, sdp: d.sdp });
const plainCand = (c) =>
  typeof c.toJSON === 'function'
    ? c.toJSON()
    : { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment };

export class PeerLink extends EventTarget {
  /**
   * @param {object} o
   * @param {RTCIceServer[]} o.iceServers
   * @param {boolean} o.offerer  true untuk host
   * @param {(msg: object) => void} o.signal  kirim pesan signaling ke pasangan
   */
  constructor({ iceServers, offerer, signal }) {
    super();
    this.iceServers = iceServers;
    this.offerer = offerer;
    this.signal = signal;
    this.localStream = null;
    this.pc = null;
    this.psid = null;
    this.pendingCandidates = [];
    this.state = 'idle'; // idle | connecting | connected | failed | closed
    this.remoteStream = null;
    this._restarts = 0;
    this._lastRestart = 0;
    this._tracksAdded = false;
  }

  _setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.dispatchEvent(new CustomEvent('state', { detail: s }));
  }

  setLocalStream(stream) {
    this.localStream = stream;
  }

  /** Ganti track kamera/mikrofon tanpa negosiasi ulang. */
  replaceTrack(kind, track) {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === kind);
    if (sender) sender.replaceTrack(track).catch(() => {});
  }

  _teardown() {
    clearTimeout(this._timeout);
    clearTimeout(this._disc);
    if (this.pc) {
      const pc = this.pc;
      this.pc = null;
      pc.onicecandidate = pc.ontrack = pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        /* abaikan */
      }
    }
    this.pendingCandidates = [];
    this._tracksAdded = false;
    this._restarts = 0;
  }

  _createPc() {
    this._teardown();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, iceCandidatePoolSize: 2 });
    this.pc = pc;
    pc.onicecandidate = (e) => {
      if (pc !== this.pc) return;
      if (e.candidate) this.signal({ psid: this.psid, candidate: plainCand(e.candidate) });
    };
    pc.ontrack = (e) => {
      if (pc !== this.pc) return;
      const stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
      if (this.remoteStream !== stream) {
        this.remoteStream = stream;
        this.dispatchEvent(new CustomEvent('remote-stream', { detail: stream }));
      }
    };
    pc.oniceconnectionstatechange = () => this._onIce(pc);
    this._setState('connecting');
    this._timeout = setTimeout(() => {
      if (pc === this.pc && this.state !== 'connected') this._setState('failed');
    }, 20_000);
    return pc;
  }

  _addLocalTracks() {
    if (this._tracksAdded || !this.localStream || !this.pc) return;
    for (const t of this.localStream.getTracks()) this.pc.addTrack(t, this.localStream);
    this._tracksAdded = true;
  }

  /** Host: mulai koneksi baru dan kirim offer. */
  async begin() {
    if (!this.offerer) return;
    try {
      this.psid = rid(8);
      const pc = this._createPc();
      this._addLocalTracks();
      const offer = await pc.createOffer();
      if (pc !== this.pc) return;
      await pc.setLocalDescription(offer);
      this.signal({ psid: this.psid, description: plainDesc(pc.localDescription) });
    } catch (e) {
      console.warn('[rtc] gagal memulai koneksi:', e);
      this._setState('failed');
    }
  }

  async onSignal(m) {
    try {
      if (m.needOffer) {
        if (this.offerer) await this.begin();
        return;
      }
      if (m.restart) {
        if (this.offerer && m.psid === this.psid) await this._iceRestart();
        return;
      }
      if (m.description) {
        const d = m.description;
        if (d.type === 'offer') {
          if (this.offerer) return; // host tidak pernah menjawab
          if (m.psid !== this.psid || !this.pc) {
            this.psid = m.psid;
            this._createPc();
          }
          const pc = this.pc;
          await pc.setRemoteDescription(d);
          this._addLocalTracks(); // memakai ulang transceiver dari offer
          const answer = await pc.createAnswer();
          if (pc !== this.pc) return;
          await pc.setLocalDescription(answer);
          this.signal({ psid: this.psid, description: plainDesc(pc.localDescription) });
          await this._flushCandidates();
        } else if (d.type === 'answer') {
          if (!this.offerer || m.psid !== this.psid || !this.pc) return;
          await this.pc.setRemoteDescription(d);
          await this._flushCandidates();
        }
      } else if (m.candidate) {
        if (m.psid !== this.psid || !this.pc) return; // basi
        if (this.pc.remoteDescription) {
          await this.pc.addIceCandidate(m.candidate).catch(() => {});
        } else {
          this.pendingCandidates.push(m.candidate);
        }
      }
    } catch (e) {
      console.warn('[rtc] gagal memproses sinyal:', e);
      if (this.state !== 'connected') this._setState('failed');
    }
  }

  async _flushCandidates() {
    const list = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of list) await this.pc.addIceCandidate(c).catch(() => {});
  }

  _onIce(pc) {
    if (pc !== this.pc) return;
    const s = pc.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      clearTimeout(this._disc);
      clearTimeout(this._timeout);
      this._setState('connected');
    } else if (s === 'disconnected') {
      this._setState('connecting');
      clearTimeout(this._disc);
      this._disc = setTimeout(() => this._recover(), 4000);
      clearTimeout(this._timeout);
      this._timeout = setTimeout(() => {
        if (pc === this.pc && this.state !== 'connected') this._setState('failed');
      }, 20_000);
    } else if (s === 'failed') {
      this._setState('failed');
      this._recover();
    }
  }

  _recover() {
    const now = Date.now();
    if (now - this._lastRestart < 5000 || this._restarts >= 6) return;
    this._lastRestart = now;
    this._restarts++;
    if (this.offerer) this._iceRestart();
    else this.signal({ psid: this.psid, restart: true });
  }

  async _iceRestart() {
    const pc = this.pc;
    if (!pc) return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      if (pc !== this.pc) return;
      await pc.setLocalDescription(offer);
      this.signal({ psid: this.psid, description: plainDesc(pc.localDescription) });
    } catch (e) {
      console.warn('[rtc] ICE restart gagal:', e);
    }
  }

  /** Coba lagi secara manual (tombol "Sambungkan ulang"). */
  retry() {
    this._restarts = 0;
    this._lastRestart = 0;
    if (this.offerer) this.begin();
    else if (!this.psid || !this.pc) this.signal({ needOffer: true });
    else this.signal({ psid: this.psid, restart: true });
  }

  close() {
    this._teardown();
    this.remoteStream = null;
    this._setState('closed');
  }
}
