// Layar edit: strip hasil foto yang bisa dihias bersama (stiker, latar, template, teks) lalu diunduh.

import { el, canvasToBlob, downloadBlob } from '../lib/util.js';
import { buildHeader } from './header.js';
import { StripView } from './stripview.js';
import { createPanel } from './panels.js';
import { readSticker, patchSticker, removeSticker, duplicateSticker, bringToFront, sendToBack } from '../lib/stickerops.js';
import { shareImage } from '../lib/share.js';
import { ico } from '../lib/icons.js';

const TOOLS = [
  ['smaller', 'minus', 'Perkecil'],
  ['bigger', 'plus', 'Perbesar'],
  ['rotl', 'rotateCcw', 'Putar ke kiri'],
  ['rotr', 'rotateCw', 'Putar ke kanan'],
  ['flip', 'flip', 'Balik kiri-kanan'],
  ['front', 'up', 'Ke depan'],
  ['back', 'down', 'Ke belakang'],
  ['dup', 'copy', 'Gandakan'],
  ['del', 'trash', 'Hapus'],
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function mountStudio(root, app) {
  const header = buildHeader(app);
  const desktop = window.matchMedia('(min-width: 960px)');

  // --- tindakan atas -------------------------------------------------------------------------------
  const retakeBtn = el('button', { type: 'button', class: 'btn' }, [ico('undo', 18), 'Foto lagi']);
  retakeBtn.addEventListener('click', () => {
    if (confirm('Ambil foto ulang? Hasil foto saat ini akan dihapus (stiker, template, dan latar pilihanmu tetap ada).')) {
      app.session.retake();
    }
  });

  const dlContent = () => [ico('download', 18), 'Unduh PNG'];
  const dlBtn = el('button', { type: 'button', class: 'btn primary', id: 'btn-download' }, dlContent());
  const shareBtn = el('button', { type: 'button', class: 'btn', id: 'btn-share' }, [ico('share', 18), 'Bagikan']);
  shareBtn.hidden = !(navigator.canShare && navigator.share);

  async function makeBlob() {
    const canvas = await app.exportCanvas(2);
    return canvasToBlob(canvas, 'image/png');
  }
  const fileName = () => `duobooth-${app.code || 'foto'}-${stamp()}.png`;

  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    dlBtn.replaceChildren('Menyiapkan…');
    try {
      downloadBlob(await makeBlob(), fileName());
      app.toast('Foto tersimpan di perangkatmu 🎉', 'ok');
    } catch (e) {
      console.error(e);
      app.toast('Gagal membuat gambar. Coba lagi.', 'error');
    } finally {
      dlBtn.disabled = false;
      dlBtn.replaceChildren(...dlContent());
    }
  });
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    try {
      const blob = await makeBlob();
      const res = await shareImage(blob, fileName());
      if (res === 'unsupported' || res === 'failed') {
        downloadBlob(blob, fileName());
        app.toast('Foto tersimpan di perangkatmu 🎉', 'ok');
      }
    } catch {
      app.toast('Gagal membuat gambar. Coba lagi.', 'error');
    } finally {
      shareBtn.disabled = false;
    }
  });

  // Perbesar: di desktop strip bisa ditampilkan lebih besar (area digulir) agar penempatan stiker lebih presisi
  let large = false;
  const zoomBtn = el('button', { type: 'button', class: 'btn zoom-btn', 'aria-pressed': 'false' });
  const paintZoom = () => {
    zoomBtn.replaceChildren(ico(large ? 'zoomOut' : 'zoom', 18), large ? 'Pas layar' : 'Perbesar');
    zoomBtn.setAttribute('aria-pressed', String(large));
    holder.classList.toggle('large', large);
  };
  zoomBtn.addEventListener('click', () => {
    large = !large;
    paintZoom();
    strip.layout();
  });

  const note = el('div', { class: 'alert info slim', hidden: true });
  const requestBtn = el('button', { type: 'button', class: 'btn small', text: 'Minta kirim ulang' });
  requestBtn.addEventListener('click', () => {
    const n = app.session.requestMissing();
    app.toast(n ? 'Meminta foto yang belum sampai…' : 'Semua foto sudah lengkap', 'info');
  });

  // --- kanvas ---------------------------------------------------------------------------------------
  const holder = el('div', { class: 'studio-canvas' });
  // mengetuk area kosong di sekitar strip membatalkan pilihan stiker
  holder.addEventListener('pointerdown', (e) => {
    if (e.target === holder) strip.select(null);
  });
  const strip = new StripView(app, {
    interactive: true,
    sizing: () =>
      desktop.matches && !large
        ? { maxW: Math.max(120, holder.clientWidth - 16), maxH: Math.max(240, holder.clientHeight - 16) }
        : { maxW: Math.min(holder.clientWidth - 16 || 360, desktop.matches ? 460 : 440), maxH: Infinity },
  });
  holder.append(strip.el);
  paintZoom();

  // --- alat stiker ------------------------------------------------------------------------------------
  const bar = el('div', { class: 'sticker-bar', role: 'toolbar', 'aria-label': 'Alat stiker', hidden: true });
  const shared = app.shared;
  const actions = {
    smaller: (s) => patchSticker(shared, s.id, { size: s.size / 1.12 }),
    bigger: (s) => patchSticker(shared, s.id, { size: s.size * 1.12 }),
    rotl: (s) => patchSticker(shared, s.id, { rot: s.rot - 15 }),
    rotr: (s) => patchSticker(shared, s.id, { rot: s.rot + 15 }),
    flip: (s) => patchSticker(shared, s.id, { flip: !s.flip }),
    front: (s) => bringToFront(shared, s.id),
    back: (s) => sendToBack(shared, s.id),
    dup: (s) => {
      const d = duplicateSticker(shared, s.id);
      if (d) strip.select(d.id);
      else app.toast('Stikernya sudah terlalu banyak.', 'warn');
    },
    del: (s) => {
      removeSticker(shared, s.id);
      strip.select(null);
    },
  };
  for (const [key, icon, label] of TOOLS) {
    const b = el('button', { type: 'button', class: 'tool', 'data-act': key, title: label, 'aria-label': label }, [ico(icon, 20)]);
    b.addEventListener('click', () => {
      const s = strip.selected && readSticker(shared, strip.selected);
      if (s) actions[key](s);
    });
    bar.append(b);
  }
  strip.onSelect = (id) => {
    bar.hidden = !id;
  };

  const onKey = (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const id = strip.selected;
    if (!id) return;
    const s = readSticker(shared, id);
    if (!s) return;
    const step = e.shiftKey ? 0.03 : 0.008;
    const handled = {
      Delete: () => actions.del(s),
      Backspace: () => actions.del(s),
      Escape: () => strip.select(null),
      ArrowLeft: () => patchSticker(shared, id, { fx: s.fx - step }),
      ArrowRight: () => patchSticker(shared, id, { fx: s.fx + step }),
      ArrowUp: () => patchSticker(shared, id, { fy: s.fy - step }),
      ArrowDown: () => patchSticker(shared, id, { fy: s.fy + step }),
      '+': () => actions.bigger(s),
      '=': () => actions.bigger(s),
      '-': () => actions.smaller(s),
    }[e.key];
    if (handled) {
      e.preventDefault();
      handled();
    }
  };
  document.addEventListener('keydown', onKey);

  // --- panel (lembar bawah di HP, kolom samping di desktop) ----------------------------------------------
  const panel = createPanel(app, { tabs: ['sticker', 'template', 'bg', 'text'], stripView: strip, initial: 'sticker' });
  const grab = el('button', { type: 'button', class: 'sheet-grab', 'aria-label': 'Buka/tutup panel', 'aria-expanded': 'true' }, [el('span')]);
  const side = el('aside', { class: 'studio-panel' }, [grab, bar, panel.el]);
  grab.addEventListener('click', () => {
    const collapsed = side.classList.toggle('collapsed');
    grab.setAttribute('aria-expanded', String(!collapsed));
  });
  // ketuk tab saat lembar tertutup -> buka kembali
  panel.el.querySelector('.tabbar').addEventListener('click', () => {
    if (side.classList.contains('collapsed')) {
      side.classList.remove('collapsed');
      grab.setAttribute('aria-expanded', 'true');
    }
  });

  const main = el('section', { class: 'studio-main' }, [
    el('div', { class: 'studio-actions' }, [retakeBtn, zoomBtn, el('span', { class: 'spacer' }), shareBtn, dlBtn]),
    note,
    holder,
  ]);
  const page = el('div', { class: 'studio' }, [header.el, el('main', { class: 'studio-body' }, [main, side])]);
  root.replaceChildren(page);
  strip.mount();

  const sheetRO = new ResizeObserver(() => {
    page.style.setProperty('--sheet-h', `${side.offsetHeight}px`);
  });
  sheetRO.observe(side);

  function refresh() {
    const s = app.session;
    const missing = s.status === 'done' ? s._missing().length : 0;
    note.replaceChildren();
    note.hidden = true;
    if (missing) {
      note.hidden = false;
      note.append(el('span', { text: `${missing} foto belum diterima dari pasanganmu. ` }), requestBtn);
    } else if (!app.peer.online) {
      note.hidden = false;
      note.append(el('span', { text: 'Pasanganmu sedang offline. Kamu tetap bisa mengedit dan mengunduh; perubahan tersinkron saat dia kembali.' }));
    }
  }
  const unsubs = [app.on('session', refresh), app.on('peer', refresh)];
  refresh();

  return {
    destroy() {
      unsubs.forEach((u) => u());
      document.removeEventListener('keydown', onKey);
      sheetRO.disconnect();
      strip.destroy();
      panel.destroy();
      header.destroy();
    },
  };
}
