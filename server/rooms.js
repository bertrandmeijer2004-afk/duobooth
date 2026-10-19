// Logika room untuk dua orang. Murni (tanpa I/O), jadi mudah diuji.
//
// Setiap room punya dua slot: "host" (pembuat room) dan "guest".
// Slot dipegang oleh sebuah clientId (disimpan di sessionStorage browser),
// sehingga refresh halaman atau koneksi yang putus sebentar bisa tersambung
// kembali ke slot yang sama tanpa kehilangan tempat.

import { randomInt } from 'node:crypto';

// Tanpa huruf/angka yang mirip: I, L, O, 0, 1
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const ROLES = ['host', 'guest'];

export function normalizeCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}

export function generateCode(exists) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    if (!exists(code)) return code;
  }
  return null;
}

export function isValidClientId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

export class RoomManager {
  /**
   * @param {object} [opts]
   * @param {number} [opts.memberTtlMs]  anggota yang offline selama ini dianggap sudah pergi
   * @param {number} [opts.roomTtlMs]    room tanpa anggota online selama ini dihapus
   * @param {number} [opts.maxRooms]
   * @param {() => number} [opts.now]
   */
  constructor({
    memberTtlMs = 10 * 60_000,
    roomTtlMs = 30 * 60_000,
    maxRooms = 5000,
    now = () => Date.now(),
  } = {}) {
    this.rooms = new Map();
    this.memberTtlMs = memberTtlMs;
    this.roomTtlMs = roomTtlMs;
    this.maxRooms = maxRooms;
    this.now = now;
  }

  get size() {
    return this.rooms.size;
  }

  get(code) {
    return this.rooms.get(normalizeCode(code)) || null;
  }

  create(clientId, ws) {
    if (this.rooms.size >= this.maxRooms) return { error: 'SERVER_BUSY' };
    const code = generateCode((c) => this.rooms.has(c));
    if (!code) return { error: 'SERVER_BUSY' };
    const t = this.now();
    const room = { code, createdAt: t, lastActiveAt: t, slots: { host: null, guest: null } };
    const member = { clientId, role: 'host', ws, offlineSince: null };
    room.slots.host = member;
    this.rooms.set(code, room);
    return { room, member, replacedWs: null, rejoined: false };
  }

  /**
   * Urutan: (1) clientId yang sama -> sambung ulang, (2) slot kosong,
   * (3) ambil alih slot yang sedang offline, (4) penuh.
   */
  join(rawCode, clientId, ws) {
    const room = this.get(rawCode);
    if (!room) return { error: 'ROOM_NOT_FOUND' };

    for (const role of ROLES) {
      const m = room.slots[role];
      if (m && m.clientId === clientId) {
        const replacedWs = m.ws && m.ws !== ws ? m.ws : null;
        m.ws = ws;
        m.offlineSince = null;
        room.lastActiveAt = this.now();
        return { room, member: m, replacedWs, rejoined: true };
      }
    }

    let role = !room.slots.host ? 'host' : !room.slots.guest ? 'guest' : null;
    if (!role) {
      // ambil alih anggota yang offline paling lama
      const offline = ROLES.map((r) => room.slots[r])
        .filter((m) => m && m.ws === null)
        .sort((a, b) => a.offlineSince - b.offlineSince)[0];
      if (!offline) return { error: 'ROOM_FULL' };
      role = offline.role;
    }
    const member = { clientId, role, ws, offlineSince: null };
    room.slots[role] = member;
    room.lastActiveAt = this.now();
    return { room, member, replacedWs: null, rejoined: false };
  }

  peerOf(room, member) {
    const other = member.role === 'host' ? 'guest' : 'host';
    return room.slots[other];
  }

  /** Koneksi terputus: slot ditahan supaya bisa tersambung kembali. */
  markOffline(room, member, ws) {
    if (member.ws !== ws) return false; // sudah digantikan koneksi baru
    member.ws = null;
    member.offlineSince = this.now();
    room.lastActiveAt = this.now();
    return true;
  }

  /** Keluar dengan sengaja: slot langsung dilepas. */
  remove(room, member) {
    if (room.slots[member.role] === member) room.slots[member.role] = null;
    if (!room.slots.host && !room.slots.guest) this.rooms.delete(room.code);
  }

  /** Bersihkan anggota/room kedaluwarsa. Mengembalikan daftar peer yang perlu diberi tahu. */
  sweep() {
    const t = this.now();
    const notify = []; // { ws, type }
    for (const room of [...this.rooms.values()]) {
      for (const role of ROLES) {
        const m = room.slots[role];
        if (m && m.ws === null && t - m.offlineSince > this.memberTtlMs) {
          room.slots[role] = null;
          const peer = this.peerOf(room, { role });
          if (peer && peer.ws) notify.push({ ws: peer.ws, type: 'peer-left' });
        }
      }
      const anyOnline = ROLES.some((r) => room.slots[r] && room.slots[r].ws);
      const empty = !room.slots.host && !room.slots.guest;
      if (empty || (!anyOnline && t - room.lastActiveAt > this.roomTtlMs)) {
        this.rooms.delete(room.code);
      }
    }
    return notify;
  }
}

/** Token bucket sederhana untuk membatasi laju pesan. */
export class TokenBucket {
  constructor(ratePerSec, burst, now = () => Date.now()) {
    this.rate = ratePerSec;
    this.burst = burst;
    this.tokens = burst;
    this.now = now;
    this.last = now();
  }
  take(cost = 1) {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.rate);
    this.last = t;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** Pembatas jendela geser per kunci (mis. IP). */
export class WindowLimiter {
  constructor(max, windowMs, now = () => Date.now()) {
    this.max = max;
    this.windowMs = windowMs;
    this.now = now;
    this.hits = new Map();
  }
  /** Apakah kunci ini masih boleh melakukan aksi? (tidak mencatat) */
  allowed(key) {
    const t = this.now();
    const arr = (this.hits.get(key) || []).filter((x) => t - x < this.windowMs);
    this.hits.set(key, arr);
    return arr.length < this.max;
  }
  /** Catat satu aksi. Mengembalikan false (dan tidak mencatat) bila sudah melewati batas. */
  hit(key) {
    if (!this.allowed(key)) return false;
    this.hits.get(key).push(this.now());
    return true;
  }
  sweep() {
    const t = this.now();
    for (const [k, arr] of this.hits) {
      const kept = arr.filter((x) => t - x < this.windowMs);
      if (kept.length) this.hits.set(k, kept);
      else this.hits.delete(k);
    }
  }
}
