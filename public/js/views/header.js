// Bilah atas: logo, kode room (bisa disalin), status koneksi, dan tombol keluar.

import { el } from '../lib/util.js';
import { stickerUrl } from '../lib/stickers.js';
import { copyText } from '../lib/share.js';
import { ico } from '../lib/icons.js';

export function buildHeader(app, { room = true } = {}) {
  const brand = el('a', { class: 'brand', href: '/', 'aria-label': 'DuoBooth' }, [
    el('img', { src: stickerUrl('cat-orange'), alt: '', width: 30, height: 30 }),
    el('span', { class: 'brand-name', text: 'DuoBooth' }),
  ]);

  const codeEl = el('strong', { class: 'chip-code' });
  const roomChip = el('button', { type: 'button', class: 'room-chip', title: 'Salin kode room', 'aria-label': 'Salin kode room' }, [
    el('span', { class: 'chip-label', text: 'Room' }),
    codeEl,
    el('span', { class: 'chip-copy' }, [ico('copy', 15)]),
  ]);
  roomChip.addEventListener('click', async () => {
    if (!app.code) return;
    app.toast((await copyText(app.code)) ? `Kode ${app.code} disalin` : 'Tidak bisa menyalin. Salin manual ya.', 'ok');
  });

  const dot = el('span', { class: 'dot' });
  const statusText = el('span', { class: 'status-text' });
  const status = el('div', { class: 'status-chip', role: 'status', 'aria-live': 'polite' }, [dot, statusText]);

  const leave = el('button', { type: 'button', class: 'btn ghost small', title: 'Keluar dari room', text: 'Keluar' });
  leave.addEventListener('click', () => {
    if (confirm('Keluar dari room ini? Foto yang belum diunduh akan hilang dari layarmu.')) app.leave();
  });

  const right = el('div', { class: 'topbar-right' }, room ? [status, roomChip, leave] : []);
  const root = el('header', { class: 'topbar' }, [brand, right]);

  function update() {
    codeEl.textContent = app.code || '------';
    let cls = 'idle';
    let text = 'Menunggu pasangan';
    if (app.conn === 'reconnecting') {
      cls = 'warn';
      text = 'Menyambung ulang…';
    } else if (app.peer.online) {
      cls = 'ok';
      text = 'Berdua online';
    }
    status.className = `status-chip ${cls}`;
    statusText.textContent = text;
  }
  const unsubs = [app.on('peer', update), app.on('conn', update), app.on('room', update)];
  update();

  return { el: root, destroy: () => unsubs.forEach((u) => u()) };
}
