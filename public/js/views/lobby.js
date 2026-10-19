// Layar awal: buat room baru atau gabung dengan kode.

import { el } from '../lib/util.js';
import { stickerUrl } from '../lib/stickers.js';
import { ico } from '../lib/icons.js';
import { cameraSupported, describeCameraError } from '../camera.js';
import { normalizeCode } from '../app.js';

/** Terima kode polos ("abc 123") maupun tautan lengkap ("https://situs/r/ABC123"). */
function extractCode(text) {
  const m = String(text || '').match(/\/r\/([A-Za-z0-9-]+)/);
  return normalizeCode(m ? m[1] : text);
}

export function mountLobby(root, app) {
  const floaters = [
    ['cat-orange', 'f1'], ['dog-shiba', 'f2'], ['panda-face', 'f3'], ['redpanda-face', 'f4'],
    ['cloud', 'f5'], ['heart-red', 'f6'], ['sparkles', 'f7'], ['star', 'f8'],
  ].map(([id, cls]) => el('img', { class: `floater ${cls}`, src: stickerUrl(id), alt: '', 'aria-hidden': 'true', draggable: 'false' }));

  const nameInput = el('input', {
    id: 'name', class: 'input', type: 'text', maxlength: 24, autocomplete: 'nickname',
    placeholder: 'mis. Rani', value: app.name || '',
  });
  const errorBox = el('div', { class: 'alert error', role: 'alert', hidden: true });
  const infoBox = el('div', { class: 'alert info', hidden: true });

  const createBtn = el('button', { type: 'button', class: 'btn primary big', id: 'btn-create' }, [ico('sparkle', 22), el('span', { text: 'Buat Room Baru' })]);
  const codeInput = el('input', {
    id: 'code', class: 'input code-input', type: 'text', inputmode: 'text', autocapitalize: 'characters',
    autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', maxlength: 80, placeholder: 'KODE ROOM',
    'aria-label': 'Kode room',
  });
  const joinBtn = el('button', { type: 'submit', class: 'btn', id: 'btn-join', text: 'Gabung' });
  const joinForm = el('form', { class: 'join-form', autocomplete: 'off' }, [codeInput, joinBtn]);

  const invite = app.inviteCode
    ? el('div', { class: 'invite' }, [
        el('span', { class: 'invite-emoji', text: '💌' }),
        el('div', {}, [el('strong', { text: 'Kamu diundang!' }), el('div', { text: `Room ${app.inviteCode}. Isi namamu lalu tekan Gabung.` })]),
      ])
    : null;
  if (app.inviteCode) codeInput.value = app.inviteCode;

  const unsupported = !cameraSupported() ? describeCameraError(null) : null;

  const card = el('section', { class: 'card hero' }, [
    el('div', { class: 'hero-logo' }, [el('img', { src: stickerUrl('cat-orange'), alt: '', width: 52, height: 52 }), el('span', { text: 'DuoBooth' })]),
    el('h1', { class: 'hero-title', text: 'Photobooth online buat berdua' }),
    el('p', { class: 'hero-sub', text: 'Foto bareng pasanganmu dari device yang berbeda, di mana pun kalian berada. Cukup bagikan kode room — video langsung tersambung.' }),
    invite,
    unsupported ? el('div', { class: 'alert error', role: 'alert', text: unsupported }) : null,
    el('label', { class: 'field', for: 'name' }, [el('span', { text: 'Nama panggilanmu' }), nameInput]),
    el('div', { class: 'actions' }, [
      app.inviteCode ? null : createBtn,
      app.inviteCode ? null : el('div', { class: 'or', text: 'atau gabung dengan kode' }),
      el('div', { class: 'join-wrap' }, [joinForm]),
      app.inviteCode ? el('button', { type: 'button', class: 'btn link', id: 'btn-new', text: 'Atau buat room baru' }) : null,
    ]),
    errorBox,
    infoBox,
    el('p', { class: 'privacy' }, ['Foto tidak disimpan di server. Video mengalir langsung antar device, dan foto hanya diteruskan ke pasanganmu.']),
  ]);

  const steps = el('section', { class: 'steps', 'aria-label': 'Cara pakai' }, [
    ['1', 'Buat room', 'Bagikan kode atau tautan ke pasanganmu.'],
    ['2', 'Pilih template', 'Warna, kucing, anjing, langit, panda, atau red panda.'],
    ['3', 'Foto & hias', 'Hitung mundur bersama, tambah stiker, ganti latar, lalu unduh.'],
  ].map(([n, t, d]) => el('div', { class: 'step card' }, [el('span', { class: 'step-n', text: n }), el('strong', { text: t }), el('span', { text: d })])));

  const overlay = el('div', { class: 'busy-overlay', hidden: true, role: 'status' }, [el('div', { class: 'spinner big' }), el('p', { class: 'busy-text' })]);

  const page = el('main', { class: 'lobby' }, [...floaters, card, steps, overlay]);
  root.replaceChildren(page);

  // --- perilaku --------------------------------------------------------------------------
  const setBusy = (text) => {
    overlay.hidden = !text;
    overlay.querySelector('.busy-text').textContent = text || '';
    for (const b of [createBtn, joinBtn]) b.disabled = !!text;
  };
  const showError = (msg) => {
    errorBox.textContent = msg || '';
    errorBox.hidden = !msg;
    if (msg) infoBox.hidden = true;
  };

  async function go(mode) {
    showError('');
    const name = nameInput.value.trim();
    const code = extractCode(codeInput.value);
    if (mode === 'join' && code.length !== 6) return showError('Kode room terdiri dari 6 huruf/angka. Periksa lagi ya.');
    try {
      setBusy(mode === 'create' ? 'Membuka kamera & membuat room…' : 'Membuka kamera & bergabung…');
      await app.enter(mode, code, name);
    } catch (e) {
      showError(e.message);
      if (e.code === 'ROOM_NOT_FOUND' || e.code === 'ROOM_FULL') codeInput.focus();
    } finally {
      setBusy('');
    }
  }

  createBtn.addEventListener('click', () => go('create'));
  joinForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    go('join');
  });
  codeInput.addEventListener('input', () => {
    const raw = codeInput.value;
    codeInput.value = raw.includes('/') ? raw : raw.toUpperCase();
  });
  const newBtn = page.querySelector('#btn-new');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      app.inviteCode = null;
      try {
        history.replaceState(null, '', '/');
      } catch {
        /* abaikan */
      }
      mountLobby(root, app);
    });
  }

  // Refresh di tengah sesi -> masuk lagi ke room yang sama.
  if (app.savedRoom && app.savedRoom.code) {
    infoBox.hidden = false;
    infoBox.textContent = `Menyambungkan kembali ke room ${app.savedRoom.code}…`;
    setBusy(`Menyambungkan kembali ke room ${app.savedRoom.code}…`);
    app
      .autoRejoin()
      .catch((e) => {
        app.savedRoom = null;
        try {
          sessionStorage.removeItem('duo-room');
        } catch {
          /* abaikan */
        }
        infoBox.hidden = true;
        showError(`Tidak bisa kembali ke room sebelumnya. ${e.message}`);
      })
      .finally(() => setBusy(''));
  } else if (app.inviteCode) {
    (nameInput.value ? joinBtn : nameInput).focus();
  }

  return { destroy() {} };
}
