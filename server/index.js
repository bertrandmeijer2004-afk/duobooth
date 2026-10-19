// DuoBooth - server statis + signaling WebSocket.
//
// Server ini hanya mempertemukan dua orang lewat room code dan meneruskan
// pesan di antara mereka (SDP/ICE untuk WebRTC, sinkronisasi pengaturan, foto).
// Video sendiri mengalir langsung antar device (peer-to-peer) lewat WebRTC.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  RoomManager,
  TokenBucket,
  WindowLimiter,
  isValidClientId,
  normalizeCode,
  CODE_LENGTH,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Baca berkas .env bila ada (Node 20.12+). Variabel yang sudah diset dari luar tidak ditimpa.
try {
  process.loadEnvFile(path.resolve(__dirname, '../.env'));
} catch {
  /* tidak ada .env atau Node versi lama: pakai environment biasa */
}

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_PAYLOAD = 8 * 1024 * 1024; // foto JPEG ber-base64 ~ratusan KB

// ---------------------------------------------------------------------------
// Konfigurasi ICE (STUN/TURN)
// ---------------------------------------------------------------------------
const DEFAULT_STUN = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
    ],
  },
];

let iceCache = { at: 0, servers: null };

async function loadIceServers() {
  // 1) JSON langsung dari env
  if (process.env.ICE_SERVERS) {
    try {
      const parsed = JSON.parse(process.env.ICE_SERVERS);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {
      console.warn('[ice] ICE_SERVERS bukan JSON yang valid:', e.message);
    }
  }
  // 2) URL penyedia TURN yang mengembalikan array iceServers (mis. Metered)
  if (process.env.ICE_SERVERS_URL) {
    const fresh = Date.now() - iceCache.at < 30 * 60_000;
    if (iceCache.servers && fresh) return iceCache.servers;
    try {
      const res = await fetch(process.env.ICE_SERVERS_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      if (Array.isArray(list) && list.length) {
        iceCache = { at: Date.now(), servers: list };
        return list;
      }
    } catch (e) {
      console.warn('[ice] gagal mengambil ICE_SERVERS_URL:', e.message);
      if (iceCache.servers) return iceCache.servers;
    }
  }
  // 3) TURN statis + STUN bawaan
  const servers = [...DEFAULT_STUN];
  if (process.env.TURN_URL) {
    const urls = process.env.TURN_URL.split(',').map((s) => s.trim()).filter(Boolean);
    if (urls.length) {
      servers.push({
        urls,
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_CREDENTIAL || '',
      });
    }
  }
  return servers;
}

// ---------------------------------------------------------------------------
// File statis
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};
const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);
const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const gzipCache = new Map(); // path -> { key, buf }

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(body);
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Tidak ditemukan', { 'Content-Type': MIME['.txt'] });

    const ext = path.extname(filePath).toLowerCase();
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      ...BASE_HEADERS,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ETag: etag,
      'Cache-Control': TEXT_EXT.has(ext) ? 'no-cache' : 'public, max-age=86400',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }

    const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (TEXT_EXT.has(ext)) headers.Vary = 'Accept-Encoding';

    if (TEXT_EXT.has(ext) && wantsGzip && st.size > 1024) {
      const cached = gzipCache.get(filePath);
      const respond = (buf) => {
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': buf.length });
        res.end(req.method === 'HEAD' ? undefined : buf);
      };
      if (cached && cached.key === etag) return respond(cached.buf);
      return fs.readFile(filePath, (e, data) => {
        if (e) return send(res, 500, 'Gagal membaca file', { 'Content-Type': MIME['.txt'] });
        const buf = zlib.gzipSync(data, { level: 6 });
        gzipCache.set(filePath, { key: etag, buf });
        respond(buf);
      });
    }

    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath)
      .on('error', () => res.destroy())
      .pipe(res);
  });
}

async function handleHttp(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Metode tidak diizinkan', { Allow: 'GET, HEAD', 'Content-Type': MIME['.txt'] });
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, 'Permintaan tidak valid', { 'Content-Type': MIME['.txt'] });
    }
    if (pathname.includes('\0')) return send(res, 400, 'Permintaan tidak valid', { 'Content-Type': MIME['.txt'] });

    if (pathname === '/healthz') {
      return send(res, 200, 'ok', { 'Content-Type': MIME['.txt'], 'Cache-Control': 'no-store' });
    }
    if (pathname === '/api/config') {
      const iceServers = await loadIceServers();
      return send(res, 200, JSON.stringify({ iceServers, codeLength: CODE_LENGTH }), {
        'Content-Type': MIME['.json'],
        'Cache-Control': 'no-store',
      });
    }

    // Tautan undangan: /r/ABC123 -> aplikasi satu halaman
    if (/^\/r\/[A-Za-z0-9-]*\/?$/.test(pathname)) pathname = '/index.html';
    if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';

    const filePath = path.join(PUBLIC_DIR, pathname);
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
      return send(res, 403, 'Dilarang', { 'Content-Type': MIME['.txt'] });
    }
    serveFile(req, res, filePath);
  } catch (e) {
    console.error('[http]', e);
    if (!res.headersSent) send(res, 500, 'Kesalahan server', { 'Content-Type': MIME['.txt'] });
    else res.destroy();
  }
}

// ---------------------------------------------------------------------------
// Signaling WebSocket
// ---------------------------------------------------------------------------
const rooms = new RoomManager();
const createLimiter = new WindowLimiter(30, 10 * 60_000);
const joinFailLimiter = new WindowLimiter(30, 10 * 60_000);
const conns = new Map(); // ws -> conn

const server = http.createServer(handleHttp);
server.keepAliveTimeout = 65_000;
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

server.on('upgrade', (req, socket, head) => {
  let pathname = '';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    /* abaikan */
  }
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function sendJson(ws, obj) {
  if (!ws || ws.readyState !== 1) return false;
  if (ws.bufferedAmount > 16 * 1024 * 1024) return false; // penerima terlalu lambat
  ws.send(JSON.stringify(obj));
  return true;
}

wss.on('connection', (ws, req) => {
  const conn = {
    ws,
    ip: clientIp(req),
    room: null,
    member: null,
    alive: true,
    strikes: 0,
    msgBucket: new TokenBucket(80, 200),
    byteBucket: new TokenBucket(4_000_000, 16_000_000),
  };
  conns.set(ws, conn);
  ws.on('pong', () => {
    conn.alive = true;
  });
  ws.on('message', (data, isBinary) => onMessage(conn, data, isBinary));
  ws.on('close', () => onClose(conn));
  ws.on('error', () => {});
});

function onMessage(conn, data, isBinary) {
  conn.alive = true;
  if (isBinary) return;
  if (!conn.msgBucket.take(1) || !conn.byteBucket.take(data.length)) {
    if (++conn.strikes > 20) conn.ws.close(1008, 'rate limit');
    sendJson(conn.ws, { type: 'error', code: 'RATE_LIMIT' });
    return;
  }
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    return;
  }
  if (!msg || typeof msg.type !== 'string') return;

  switch (msg.type) {
    case 'ping':
      sendJson(conn.ws, { type: 'pong', t: msg.t });
      break;
    case 'create':
      handleCreate(conn, msg);
      break;
    case 'join':
      handleJoin(conn, msg);
      break;
    case 'relay':
      handleRelay(conn, msg);
      break;
    case 'leave':
      detachFromRoom(conn, { explicit: true });
      break;
    default:
      break;
  }
}

/** Lepaskan koneksi dari room-nya (keluar sengaja atau pindah room). */
function detachFromRoom(conn, { explicit }) {
  const { room, member } = conn;
  if (!room || !member) return;
  conn.room = null;
  conn.member = null;
  if (explicit) {
    const peer = rooms.peerOf(room, member);
    rooms.remove(room, member);
    if (peer && peer.ws) sendJson(peer.ws, { type: 'peer-left' });
  } else if (rooms.markOffline(room, member, conn.ws)) {
    const peer = rooms.peerOf(room, member);
    if (peer && peer.ws) sendJson(peer.ws, { type: 'peer-offline' });
  }
}

function handleCreate(conn, msg) {
  if (!isValidClientId(msg.clientId)) return sendJson(conn.ws, { type: 'error', code: 'BAD_REQUEST' });
  if (!createLimiter.hit(conn.ip)) return sendJson(conn.ws, { type: 'error', code: 'RATE_LIMIT' });
  detachFromRoom(conn, { explicit: true });

  const res = rooms.create(msg.clientId, conn.ws);
  if (res.error) return sendJson(conn.ws, { type: 'error', code: res.error });
  conn.room = res.room;
  conn.member = res.member;
  console.log(`[room ${res.room.code}] dibuat (${rooms.size} room aktif)`);
  sendJson(conn.ws, { type: 'joined', code: res.room.code, role: 'host', peerOnline: false, rejoined: false });
}

function handleJoin(conn, msg) {
  if (!isValidClientId(msg.clientId)) return sendJson(conn.ws, { type: 'error', code: 'BAD_REQUEST' });
  if (!joinFailLimiter.allowed(conn.ip)) return sendJson(conn.ws, { type: 'error', code: 'RATE_LIMIT' });

  const code = normalizeCode(msg.code);
  if (code.length !== CODE_LENGTH) {
    joinFailLimiter.hit(conn.ip);
    return sendJson(conn.ws, { type: 'error', code: 'ROOM_NOT_FOUND' });
  }

  // Pindah dari room lain (bukan sambung ulang ke room yang sama)
  if (conn.room && conn.room.code !== code) detachFromRoom(conn, { explicit: true });

  const res = rooms.join(code, msg.clientId, conn.ws);
  if (res.error) {
    joinFailLimiter.hit(conn.ip);
    return sendJson(conn.ws, { type: 'error', code: res.error });
  }
  if (res.replacedWs) {
    const old = conns.get(res.replacedWs);
    if (old) {
      old.room = null;
      old.member = null;
    }
    res.replacedWs.close(4001, 'replaced');
  }
  conn.room = res.room;
  conn.member = res.member;

  const peer = rooms.peerOf(res.room, res.member);
  const peerOnline = !!(peer && peer.ws);
  console.log(`[room ${code}] ${res.member.role} ${res.rejoined ? 'tersambung ulang' : 'bergabung'}`);
  sendJson(conn.ws, { type: 'joined', code, role: res.member.role, peerOnline, rejoined: res.rejoined });
  if (peerOnline) sendJson(peer.ws, { type: 'peer-online' });
}

function handleRelay(conn, msg) {
  if (!conn.room || !conn.member) return;
  if (typeof msg.data !== 'object' || msg.data === null) return;
  const peer = rooms.peerOf(conn.room, conn.member);
  conn.room.lastActiveAt = Date.now();
  if (peer && peer.ws) sendJson(peer.ws, { type: 'relay', data: msg.data });
}

function onClose(conn) {
  conns.delete(conn.ws);
  detachFromRoom(conn, { explicit: false });
}

// Heartbeat: putuskan koneksi yang sudah mati (mis. HP kehilangan sinyal)
const heartbeat = setInterval(() => {
  for (const conn of conns.values()) {
    if (!conn.alive) {
      conn.ws.terminate();
      continue;
    }
    conn.alive = false;
    try {
      conn.ws.ping();
    } catch {
      /* abaikan */
    }
  }
}, 25_000);

const sweeper = setInterval(() => {
  for (const n of rooms.sweep()) sendJson(n.ws, { type: n.type });
  createLimiter.sweep();
  joinFailLimiter.sweep();
}, 30_000);
heartbeat.unref();
sweeper.unref();

// ---------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log(`DuoBooth berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

function shutdown() {
  console.log('Menutup server...');
  for (const conn of conns.values()) conn.ws.close(1001, 'server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
