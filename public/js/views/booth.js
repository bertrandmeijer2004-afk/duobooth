// Layar booth: video berdua, undangan room, pengaturan, hitung mundur, dan pratinjau strip.

import { el } from '../lib/util.js';
import { stickerUrl } from '../lib/stickers.js';
import { ico } from '../lib/icons.js';
import { buildHeader } from './header.js';
import { StripView } from './stripview.js';
import { createPanel, segmented } from './panels.js';
import { copyText, inviteLink, canNativeShare, shareInvite } from '../lib/share.js';

export function mountBooth(root, app) {
  const header = buildHeader(app);
  const me = app.role === 'guest' ? 'guest' : 'host';
  const other = me === 'host' ? 'guest' : 'host';

  // --- kartu undangan (hanya saat pasangan belum ada) ---------------------------------------
  const codeBig = el('div', { class: 'code-big', 'aria-label': 'Kode room' });
  const copyCode = el('button', { type: 'button', class: 'btn small' }, [ico('copy', 16), 'Salin kode']);
  const copyLink = el('button', { type: 'button', class: 'btn small' }, [ico('link', 16), 'Salin tautan']);
  const shareBtn = canNativeShare() ? el('button', { type: 'button', class: 'btn small primary' }, [ico('share', 16), 'Bagikan']) : null;
  copyCode.addEventListener('click', async () => app.toast((await copyText(app.code)) ? 'Kode disalin' : 'Gagal menyalin', 'ok'));
  copyLink.addEventListener('click', async () => app.toast((await copyText(inviteLink(app.code))) ? 'Tautan undangan disalin' : 'Gagal menyalin', 'ok'));
  if (shareBtn) shareBtn.addEventListener('click', () => shareInvite(app.code, app.name));

  const invite = el('section', { class: 'invite-card card' }, [
    el('img', { class: 'invite-art', src: stickerUrl('heart-pair'), alt: '', width: 56, height: 56 }),
    el('div', { class: 'invite-main' }, [
      el('strong', { text: 'Ajak pasanganmu masuk' }),
      el('span', { class: 'muted', text: 'Bagikan kode ini, atau kirim tautannya.' }),
      codeBig,
      el('div', { class: 'row wrap' }, [copyCode, copyLink, shareBtn]),
    ]),
  ]);

  // --- video ----------------------------------------------------------------------------------
  function makeTile(who) {
    const media = el('div', { class: 'tile-media' });
    const name = el('div', { class: 'tile-name' });
    const state = el('div', { class: 'tile-state', hidden: true });
    const node = el('div', { class: `tile tile-${who}`, 'data-who': who, 'data-me': String(who === me) }, [media, name, state]);
    return { node, media, name, state };
  }
  const tiles = { host: makeTile('host'), guest: makeTile('guest') };
  tiles[me].media.append(app.localVideo);
  tiles[other].media.append(app.remoteVideo);
  // mode cadangan: gambar kecil dari pasangan lewat server saat video langsung gagal
  const fallbackImg = el('img', { class: 'tile-fallback', alt: 'Pratinjau pasangan', hidden: true });
  const fallbackBadge = el('button', { type: 'button', class: 'tile-badge', hidden: true, title: 'Coba video langsung lagi' }, [
    el('span', { text: 'Mode hemat · ketuk untuk coba video langsung' }),
  ]);
  fallbackBadge.addEventListener('click', () => app.link && app.link.retry());
  tiles[other].media.append(fallbackImg);
  tiles[other].node.append(fallbackBadge);
  tiles[other].media.append(el('div', { class: 'tile-empty' }, [el('img', { src: stickerUrl('cloud'), alt: '', width: 64, height: 64 }), el('span', { text: 'Menunggu pasangan…' })]));

  // lapisan hitung mundur
  const shootPill = el('span', { class: 'pill' });
  const shootCount = el('div', { class: 'shoot-count', 'aria-live': 'assertive' });
  const shootPrompt = el('div', { class: 'shoot-prompt' });
  const cancelBtn = el('button', { type: 'button', class: 'btn small shoot-cancel', text: 'Batalkan' });
  cancelBtn.addEventListener('click', () => app.session.abort('Sesi foto dibatalkan.'));
  const shoot = el('div', { class: 'shoot', hidden: true }, [el('div', { class: 'shoot-top' }, [shootPill]), shootCount, shootPrompt, cancelBtn]);
  const flash = el('div', { class: 'flash', 'aria-hidden': 'true' });
  const tilesWrap = el('div', { class: 'tiles' }, [tiles.host.node, tiles.guest.node, shoot, flash]);

  // jejak foto yang sudah diambil
  const shotsRow = el('div', { class: 'shots-row', hidden: true, 'aria-label': 'Foto yang sudah diambil' });

  // --- kontrol -------------------------------------------------------------------------------
  const startBtn = el('button', { type: 'button', class: 'btn primary big start-btn', id: 'btn-start' });
  startBtn.addEventListener('click', () => app.session.start());

  const shotsSeg = segmented(
    [2, 3, 4].map((n) => ({ value: n, label: `${n}` })),
    (v) => app.shared.set('shots', v),
    { label: 'Jumlah foto' }
  );
  const timerSeg = segmented(
    [3, 5, 10].map((n) => ({ value: n, label: `${n}s` })),
    (v) => app.shared.set('timer', v),
    { label: 'Hitung mundur' }
  );
  const micBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-pressed': 'true', title: 'Mikrofon', 'aria-label': 'Mikrofon' });
  micBtn.addEventListener('click', () => app.setMic(!app.micOn));
  const camRetry = el('button', { type: 'button', class: 'btn small', text: 'Nyalakan kamera lagi' });
  camRetry.addEventListener('click', async () => {
    try {
      await app.startCamera();
    } catch (e) {
      app.toast(e.message, 'error');
    }
  });

  const controls = el('div', { class: 'controls' }, [
    startBtn,
    el('div', { class: 'settings' }, [
      el('div', { class: 'setting' }, [el('span', { class: 'setting-label', text: 'Jumlah foto' }), shotsSeg.el]),
      el('div', { class: 'setting' }, [el('span', { class: 'setting-label', text: 'Hitung mundur' }), timerSeg.el]),
      el('div', { class: 'setting' }, [el('span', { class: 'setting-label', text: 'Suara' }), micBtn]),
    ]),
  ]);

  const stage = el('section', { class: 'stage card' }, [invite, tilesWrap, shotsRow, controls]);

  // --- pratinjau + panel ------------------------------------------------------------------------
  const previewHolder = el('div', { class: 'side-preview' });
  const preview = new StripView(app, {
    interactive: false,
    sizing: () => ({
      maxW: Math.min(previewHolder.clientWidth || 200, window.innerWidth < 960 ? 170 : 230),
      maxH: Math.min(560, Math.max(260, window.innerHeight * 0.68)),
    }),
  });
  previewHolder.append(preview.el);
  const panel = createPanel(app, { tabs: ['template', 'bg', 'text'] });
  const side = el('aside', { class: 'side card' }, [
    el('div', { class: 'side-preview-wrap' }, [el('div', { class: 'side-cap', text: 'Pratinjau strip' }), previewHolder]),
    el('div', { class: 'side-panel' }, [panel.el]),
  ]);

  const page = el('div', { class: 'booth' }, [header.el, el('main', { class: 'booth-body' }, [stage, side])]);
  root.replaceChildren(page);
  preview.mount();

  // --- pembaruan tampilan ------------------------------------------------------------------------
  let wasOnline = app.peer.online;
  let lastCount = null;

  function setState(tile, node) {
    tile.state.replaceChildren();
    tile.state.hidden = !node;
    if (node) tile.state.append(node);
  }

  function refresh() {
    const v = app.view();
    const s = app.session;
    const shooting = s.status === 'shooting';
    page.classList.toggle('is-shooting', shooting);

    // nama
    for (const who of ['host', 'guest']) {
      const t = tiles[who];
      const nm = v.names[who];
      const mine = who === me;
      t.name.replaceChildren(...[el('span', { text: nm || (mine ? 'Kamu' : 'Pasangan') }), mine ? el('small', { text: 'kamu' }) : null].filter(Boolean));
      t.node.classList.toggle('mirror', v.mirror);
    }

    // kartu undangan
    invite.hidden = app.peer.online;
    codeBig.textContent = (app.code || '').split('').join(' ');

    // status video pasangan
    const remote = tiles[other];
    const hasRemote = !!app.remoteVideo.srcObject;
    const fb = app.peer.online && app.fallbackLive;
    remote.node.classList.toggle('has-video', hasRemote && app.peer.online);
    remote.node.classList.toggle('has-fallback', fb);
    remote.node.classList.toggle('offline', !app.peer.online);
    fallbackImg.hidden = !fb;
    fallbackBadge.hidden = !fb;
    if (fb && app.pv) fallbackImg.src = app.pv.src;
    if (!app.peer.online) {
      setState(remote, null);
    } else if (fb) {
      setState(remote, null); // gambar cadangan sudah tampil
    } else if (app.needsPlayTap) {
      const b = el('button', { type: 'button', class: 'btn small primary', text: '🔊 Ketuk untuk menyalakan video & suara' });
      b.addEventListener('click', () => app.enableRemoteAudio());
      setState(remote, b);
    } else if (app.rtc === 'failed') {
      const b = el('button', { type: 'button', class: 'btn small', text: 'Coba sambungkan lagi' });
      b.addEventListener('click', () => app.link && app.link.retry());
      setState(remote, el('div', { class: 'state-box' }, [
        el('strong', { text: 'Video belum tersambung' }),
        el('span', { text: 'Jaringan mungkin memblokir koneksi langsung. Foto tetap bisa diambil bersama.' }),
        b,
      ]));
    } else if (!hasRemote || app.rtc !== 'connected') {
      setState(remote, el('div', { class: 'state-box' }, [el('span', { class: 'spinner' }), el('span', { text: 'Menyambungkan video…' })]));
    } else {
      setState(remote, null);
    }

    // kamera sendiri
    const mineTile = tiles[me];
    const live = app.stream && app.stream.getVideoTracks().some((t) => t.readyState === 'live');
    setState(mineTile, live ? null : el('div', { class: 'state-box' }, [el('strong', { text: 'Kamera mati' }), camRetry]));

    // pengaturan
    shotsSeg.set(v.shots);
    timerSeg.set(v.timer);
    const micLive = app.micOn && app.hasMic;
    if (micBtn.dataset.on !== String(micLive)) {
      micBtn.dataset.on = String(micLive);
      micBtn.replaceChildren(ico(micLive ? 'mic' : 'micOff', 22));
    }
    micBtn.setAttribute('aria-pressed', String(micLive));
    micBtn.disabled = !app.hasMic;
    micBtn.title = !app.hasMic ? 'Mikrofon tidak tersedia' : app.micOn ? 'Matikan mikrofon' : 'Nyalakan mikrofon';

    // tombol mulai
    const ready = app.cameraReady();
    let label = 'Mulai Foto';
    let withIcon = true;
    let disabled = false;
    if (shooting) {
      label = 'Sedang memotret…';
      withIcon = false;
      disabled = true;
    } else if (!app.peer.online) {
      label = 'Menunggu pasangan…';
      withIcon = false;
      disabled = true;
    } else if (!ready) {
      label = 'Menyiapkan kamera…';
      withIcon = false;
      disabled = true;
    }
    if (startBtn.dataset.label !== label) {
      startBtn.dataset.label = label;
      startBtn.replaceChildren(...[withIcon ? ico('camera', 24) : null, label].filter(Boolean));
    }
    startBtn.disabled = disabled;

    // hitung mundur
    shoot.hidden = !shooting;
    if (shooting) {
      shootPill.textContent = s.current >= 0 ? `Foto ${s.current + 1} dari ${s.n}` : `${s.n} foto`;
      shootCount.textContent = s.countdown === null ? '' : s.countdown === 0 ? '📸' : String(s.countdown);
      shootPrompt.textContent = s.prompt || '';
      if (s.countdown !== lastCount) {
        lastCount = s.countdown;
        shootCount.classList.remove('pop');
        void shootCount.offsetWidth; // mulai ulang animasi setiap angka berganti
        if (s.countdown !== null) shootCount.classList.add('pop');
      }
    } else {
      lastCount = null;
    }

    // jejak foto
    const showRow = s.frames.length > 0 && (shooting || s.frames.some((f) => f.host || f.guest));
    shotsRow.hidden = !showRow;
    if (showRow) {
      if (shotsRow.children.length !== s.frames.length) {
        shotsRow.replaceChildren(...s.frames.map(() => el('div', { class: 'mini' })));
      }
      s.frames.forEach((f, i) => {
        const slot = shotsRow.children[i];
        const key = `${f.host ? f.host.src.length : 0}-${f.guest ? f.guest.src.length : 0}`;
        if (slot.dataset.key === key) return;
        slot.dataset.key = key;
        slot.replaceChildren(
          el('div', { class: 'mini-half' }, f.host ? [el('img', { src: f.host.src, alt: '' })] : []),
          el('div', { class: 'mini-half' }, f.guest ? [el('img', { src: f.guest.src, alt: '' })] : [])
        );
        slot.classList.toggle('filled', !!(f.host && f.guest));
      });
    }

    if (app.peer.online !== wasOnline) {
      app.toast(app.peer.online ? 'Pasanganmu bergabung 🎉' : 'Pasanganmu terputus', app.peer.online ? 'ok' : 'warn');
      wasOnline = app.peer.online;
    }
  }

  const unsubs = [
    app.on('peer', refresh),
    app.on('rtc', refresh),
    app.on('camera', refresh),
    app.on('state', refresh),
    app.on('session', refresh),
    app.on('room', refresh),
    app.on('pv', () => {
      if (app.pv && app.fallbackLive) {
        fallbackImg.src = app.pv.src;
        if (fallbackImg.hidden) refresh();
      }
    }),
    app.on('flash', () => {
      flash.classList.remove('go');
      void flash.offsetWidth; // mulai ulang animasi
      flash.classList.add('go');
    }),
  ];

  // video bisa berhenti saat dilepas dari DOM; nyalakan lagi
  app.localVideo.play().catch(() => {});
  if (app.remoteVideo.srcObject) app.remoteVideo.play().catch(() => {});
  const poll = setInterval(refresh, 1500); // memperbarui status "kamera siap" tanpa event khusus
  refresh();

  return {
    destroy() {
      clearInterval(poll);
      unsubs.forEach((u) => u());
      preview.destroy();
      panel.destroy();
      header.destroy();
    },
  };
}
