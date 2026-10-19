// Titik masuk: memasang layar sesuai fase (lobi / booth / edit) dan menampilkan notifikasi.

import { App } from './app.js';
import { mountLobby } from './views/lobby.js';
import { mountBooth } from './views/booth.js';
import { mountStudio } from './views/studio.js';
import { preloadStickers, STICKER_IDS } from './lib/stickers.js';

const app = new App();
window.__duo = app; // memudahkan debugging

const root = document.getElementById('app');
const toasts = document.getElementById('toasts');
let current = null;

function show(phase) {
  if (current) current.destroy();
  window.scrollTo(0, 0);
  document.body.dataset.phase = phase;
  root.replaceChildren();
  current = phase === 'booth' ? mountBooth(root, app) : phase === 'edit' ? mountStudio(root, app) : mountLobby(root, app);
}

app.on('phase', show);

app.on('toast', ({ msg, kind }) => {
  const node = document.createElement('div');
  node.className = `toast ${kind || 'info'}`;
  node.textContent = msg;
  node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toasts.append(node);
  while (toasts.children.length > 3) toasts.firstChild.remove();
  setTimeout(() => node.classList.add('out'), 3200);
  setTimeout(() => node.remove(), 3700);
});

// Gambar ulang pratinjau setelah font web selesai dimuat (kanvas tidak ikut berubah otomatis)
if (document.fonts && document.fonts.addEventListener) {
  document.fonts.addEventListener('loadingdone', () => app.emit('state', { keys: ['font'], local: false }));
}

show('lobby');
// Pramuat stiker di latar belakang supaya panel & template langsung tampil
setTimeout(() => preloadStickers(STICKER_IDS), 300);
