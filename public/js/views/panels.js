// Panel pengaturan: Template, Latar, Stiker, Teks. Dipakai di layar foto (booth) dan layar edit (studio).

import { el, debounce, rid } from '../lib/util.js';
import { TEMPLATES, getTemplate } from '../lib/templates.js';
import { renderStrip } from '../lib/render.js';
import { computeLayout } from '../lib/layout.js';
import { SOLID_COLORS, GRADIENTS, PATTERNS, SCENES, drawBackdrop, sameSpec } from '../lib/backgrounds.js';
import { CATEGORIES, stickersInCategory, stickerUrl, STICKERS } from '../lib/stickers.js';
import { onAssetLoad, fileToDataUrl } from '../lib/assets.js';
import { addSticker, clearStickers } from '../lib/stickerops.js';
import { warmUp } from '../lib/segment.js';
import { ico } from '../lib/icons.js';

// ---------------------------------------------------------------------------
// Komponen kecil
// ---------------------------------------------------------------------------
export function switchControl(label, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.addEventListener('change', () => onChange(input.checked));
  const node = el('label', { class: 'switch' }, [input, el('span', { class: 'slider', 'aria-hidden': 'true' }), el('span', { class: 'switch-text', text: label })]);
  return { el: node, set: (v) => (input.checked = !!v) };
}

export function segmented(options, onPick, { label } = {}) {
  const wrap = el('div', { class: 'seg', role: 'group', 'aria-label': label || null });
  const btns = options.map((o) => {
    const b = el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': 'false', text: o.label });
    b.addEventListener('click', () => onPick(o.value));
    wrap.append(b);
    return [o.value, b];
  });
  return {
    el: wrap,
    set(v) {
      for (const [val, b] of btns) {
        const on = val === v;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      }
    },
  };
}

function section(title, ...children) {
  return el('div', { class: 'p-section' }, [el('h4', { class: 'p-title', text: title }), ...children]);
}

// ---------------------------------------------------------------------------
// Tab Template
// ---------------------------------------------------------------------------
function templateTab(app) {
  const cards = new Map();
  const grid = el('div', { class: 'tpl-grid' });
  const L2 = computeLayout(2);
  const THUMB_W = 192;

  function drawThumb(canvas, id) {
    const view = {
      shots: 2, template: id, bg: null, photoBg: null, title: null, caption: '', showDate: false, date: '',
      names: { host: '', guest: '' }, mirror: true, decor: true, stickers: [], frames: [],
    };
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderStrip(ctx, view, { scale: canvas.width / L2.W, env: app.env });
  }

  for (const t of TEMPLATES) {
    const canvas = el('canvas', { class: 'tpl-thumb', width: THUMB_W, height: Math.round((THUMB_W * L2.H) / L2.W) });
    const btn = el('button', { type: 'button', class: 'tpl-card', 'aria-pressed': 'false', title: t.hint }, [
      canvas,
      el('span', { class: 'tpl-name', text: t.name }),
    ]);
    btn.addEventListener('click', () => app.shared.setMany({ template: t.id, bg: null }));
    grid.append(btn);
    cards.set(t.id, { btn, canvas });
  }

  let raf = 0;
  const redrawAll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const [id, c] of cards) drawThumb(c.canvas, id);
    });
  };
  redrawAll();
  const unAsset = onAssetLoad(redrawAll);
  const onFonts = () => redrawAll();
  document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', onFonts);

  const decor = switchControl('Tampilkan dekorasi template', (v) => app.shared.set('decor', v));
  const mirror = switchControl('Mirror foto (seperti di cermin)', (v) => app.shared.set('mirror', v));

  const root = el('div', { class: 'tab-body' }, [
    el('p', { class: 'p-hint', text: 'Pilih tema strip fotomu. Latar bisa diganti kapan saja di tab Latar.' }),
    grid,
    section('Tampilan', decor.el, mirror.el),
  ]);

  return {
    el: root,
    update() {
      const v = app.view();
      for (const [id, c] of cards) {
        const on = id === v.template;
        c.btn.classList.toggle('active', on);
        c.btn.setAttribute('aria-pressed', String(on));
      }
      decor.set(v.decor);
      mirror.set(v.mirror);
    },
    destroy() {
      unAsset();
      document.fonts && document.fonts.removeEventListener && document.fonts.removeEventListener('loadingdone', onFonts);
      cancelAnimationFrame(raf);
    },
  };
}

// ---------------------------------------------------------------------------
// Tab Latar
// ---------------------------------------------------------------------------
function gcImages(shared) {
  const used = new Set();
  for (const k of ['bg', 'photoBg']) {
    const s = shared.get(k, null);
    if (s && s.type === 'image') used.add(s.id);
  }
  const drop = {};
  for (const [k, e] of shared.map) {
    if (k.startsWith('img:') && e.v && !used.has(k.slice(4))) drop[k] = null;
  }
  if (Object.keys(drop).length) shared.setMany(drop);
}

function backgroundTab(app) {
  let target = 'bg'; // 'bg' = latar strip, 'photoBg' = latar di belakang orang
  const swatches = []; // { btn, spec }

  const seg = segmented(
    [
      { value: 'bg', label: 'Latar Strip' },
      { value: 'photoBg', label: 'Latar Foto' },
    ],
    (v) => {
      target = v;
      update();
    },
    { label: 'Target latar' }
  );

  const hint = el('p', { class: 'p-hint' });
  const resetBtn = el('button', { type: 'button', class: 'btn soft block' });
  resetBtn.addEventListener('click', () => {
    app.shared.set(target, null);
    gcImages(app.shared);
  });

  const status = el('div', { class: 'p-status', role: 'status' });
  const retryBtn = el('button', { type: 'button', class: 'btn small', text: 'Coba lagi' });
  retryBtn.addEventListener('click', () => app.retryCutouts());

  function apply(spec) {
    app.shared.set(target, spec);
    gcImages(app.shared);
    if (target === 'photoBg') {
      warmUp().catch(() => {});
      app.scheduleCutouts();
    }
  }

  function addSwatch(parent, spec, label, draw) {
    const btn = el('button', { type: 'button', class: 'swatch', title: label || '', 'aria-label': label || 'Pilihan latar', 'aria-pressed': 'false' });
    if (draw) {
      const c = el('canvas', { width: 96, height: 96 });
      draw(c.getContext('2d'));
      btn.append(c);
    } else if (spec.type === 'solid') {
      btn.style.background = spec.color;
    }
    btn.addEventListener('click', () => apply(spec));
    parent.append(btn);
    swatches.push({ btn, spec });
    return btn;
  }

  const solids = el('div', { class: 'swatch-grid' });
  for (const color of SOLID_COLORS) addSwatch(solids, { type: 'solid', color }, color);

  const colorInput = el('input', { type: 'color', class: 'color-input', 'aria-label': 'Pilih warna sendiri', value: '#ffc8dd' });
  const applyColor = debounce(() => apply({ type: 'solid', color: colorInput.value }), 90);
  colorInput.addEventListener('input', applyColor);
  const customRow = el('label', { class: 'custom-color' }, [colorInput, el('span', { text: 'Pilih warna sendiri' })]);

  const grads = el('div', { class: 'swatch-grid' });
  for (const g of GRADIENTS) {
    addSwatch(grads, { type: 'gradient', from: g.from, to: g.to, angle: g.angle }, 'Gradasi', (ctx) =>
      drawBackdrop(ctx, g, 0, 0, 96, 96)
    );
  }
  const pats = el('div', { class: 'swatch-grid' });
  for (const p of PATTERNS) {
    addSwatch(pats, { type: 'pattern', kind: p.kind, base: p.base, accent: p.accent }, `Pola ${p.kind}`, (ctx) => {
      ctx.save();
      ctx.scale(0.8, 0.8);
      drawBackdrop(ctx, p, 0, 0, 120, 120);
      ctx.restore();
    });
  }
  const scenes = el('div', { class: 'swatch-grid' });
  for (const s of SCENES) {
    addSwatch(scenes, { type: 'scene', kind: s.kind }, s.name, (ctx) => {
      ctx.save();
      ctx.scale(0.4, 0.4);
      drawBackdrop(ctx, s, 0, 0, 240, 240);
      ctx.restore();
    });
  }

  const file = el('input', { type: 'file', accept: 'image/*', class: 'sr-only', 'aria-label': 'Unggah gambar latar' });
  const uploadBtn = el('button', { type: 'button', class: 'btn soft block' }, [ico('upload', 18), 'Unggah gambar sendiri']);
  uploadBtn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return app.toast('File harus berupa gambar.', 'warn');
    try {
      uploadBtn.disabled = true;
      const dataUrl = await fileToDataUrl(f, 1200, 0.85);
      const id = rid(8);
      app.shared.setMany({ ['img:' + id]: dataUrl, [target]: { type: 'image', id } });
      gcImages(app.shared);
      if (target === 'photoBg') {
        warmUp().catch(() => {});
        app.scheduleCutouts();
      }
    } catch {
      app.toast('Gambar tidak bisa dibaca. Coba file lain.', 'error');
    } finally {
      uploadBtn.disabled = false;
    }
  });

  const root = el('div', { class: 'tab-body' }, [
    seg.el,
    hint,
    resetBtn,
    status,
    section('Warna', solids, customRow),
    section('Gradasi', grads),
    section('Pola', pats),
    section('Pemandangan', scenes),
    section('Gambar sendiri', uploadBtn, file),
  ]);

  function update() {
    const v = app.view();
    seg.set(target);
    const cur = target === 'bg' ? v.bg : v.photoBg;
    if (target === 'bg') {
      hint.textContent = 'Ganti latar di belakang bingkai foto (warna, gradasi, pola, pemandangan, atau gambarmu sendiri).';
      resetBtn.replaceChildren(ico('undo', 18), 'Pakai latar bawaan template');
      resetBtn.classList.toggle('active', !cur);
    } else {
      hint.textContent = 'Ganti latar di belakang kalian berdua. Siluet kalian dipotong otomatis dari foto, lalu ditaruh di depan latar pilihanmu.';
      resetBtn.replaceChildren(ico('camera', 18), 'Pakai latar asli (tanpa ganti)');
      resetBtn.classList.toggle('active', !cur);
    }
    for (const { btn, spec } of swatches) {
      const on = sameSpec(cur, spec);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    }
    if (cur && cur.type === 'solid') colorInput.value = cur.color;

    // status pemrosesan latar foto
    status.replaceChildren();
    status.hidden = true;
    if (target === 'photoBg' && cur) {
      const c = app.cutouts;
      const hasPhotos = app.session.frames.some((f) => f.host || f.guest);
      status.hidden = false;
      if (c.error) {
        status.className = 'p-status error';
        status.append(
          el('span', { text: 'Gagal memproses foto. Pastikan internet aktif (model dimuat sekali dari internet), lalu coba lagi. ' }),
          retryBtn
        );
      } else if (c.running) {
        status.className = 'p-status busy';
        status.append(el('span', { class: 'spinner' }), el('span', { text: ` Memotong siluet… ${c.done}/${c.total}` }));
      } else if (!hasPhotos) {
        status.className = 'p-status';
        status.textContent = 'Latar akan diterapkan setelah kalian mengambil foto. Pratinjau di samping memakai siluet contoh.';
      } else {
        status.className = 'p-status ok';
        status.textContent = '✓ Latar foto diterapkan';
      }
    }
  }

  return { el: root, update, destroy() {} };
}

// ---------------------------------------------------------------------------
// Tab Stiker
// ---------------------------------------------------------------------------
function stickerTab(app, stripView) {
  let cat = 'cat';
  const chips = el('div', { class: 'chips', role: 'tablist', 'aria-label': 'Kategori stiker' });
  const grid = el('div', { class: 'stk-grid' });
  const chipBtns = new Map();

  function renderGrid() {
    grid.replaceChildren();
    for (const id of stickersInCategory(cat)) {
      const def = STICKERS[id];
      const b = el('button', { type: 'button', class: 'stk', title: def.name, 'aria-label': `Tambah stiker ${def.name}` }, [
        el('img', { src: stickerUrl(id), alt: '', loading: 'lazy', draggable: 'false' }),
      ]);
      b.addEventListener('click', () => {
        const pos = stripView.visibleCenter();
        const jitter = () => (Math.random() - 0.5) * 0.12;
        const st = addSticker(app.shared, id, {
          fx: pos.fx + jitter(),
          fy: pos.fy + jitter() * 0.6,
          size: def.aspect < 0.8 ? 190 : 130,
        });
        if (!st) return app.toast('Stikernya sudah terlalu banyak (maks. 60).', 'warn');
        stripView.select(st.id);
      });
      grid.append(b);
    }
  }

  for (const c of CATEGORIES) {
    const b = el('button', { type: 'button', class: 'chip', role: 'tab', 'aria-selected': 'false' }, [
      el('img', { src: stickerUrl(c.icon), alt: '', width: 22, height: 22 }),
      el('span', { text: c.name }),
    ]);
    b.addEventListener('click', () => {
      cat = c.id;
      renderGrid();
      mark();
    });
    chips.append(b);
    chipBtns.set(c.id, b);
  }
  const mark = () => {
    for (const [id, b] of chipBtns) {
      b.classList.toggle('active', id === cat);
      b.setAttribute('aria-selected', String(id === cat));
    }
  };

  const clearBtn = el('button', { type: 'button', class: 'btn soft block danger-soft' }, [ico('trash', 18), 'Hapus semua stiker']);
  clearBtn.addEventListener('click', () => {
    if (!app.view().stickers.length) return;
    if (confirm('Hapus semua stiker yang kamu tambahkan?')) {
      clearStickers(app.shared);
      stripView.select(null);
    }
  });

  const count = el('p', { class: 'p-hint' });
  const root = el('div', { class: 'tab-body' }, [
    el('p', { class: 'p-hint', text: 'Ketuk stiker untuk menambahkannya, lalu geser, besarkan, dan putar di strip. Kalian berdua bisa mengedit bersamaan.' }),
    chips,
    grid,
    count,
    clearBtn,
  ]);
  renderGrid();
  mark();

  return {
    el: root,
    update() {
      const n = app.view().stickers.length;
      count.textContent = n ? `${n} stiker di strip` : 'Belum ada stiker tambahan.';
    },
    destroy() {},
  };
}

// ---------------------------------------------------------------------------
// Tab Teks
// ---------------------------------------------------------------------------
function textTab(app) {
  const title = el('input', { type: 'text', maxlength: 60, class: 'input', id: 'in-title', autocomplete: 'off' });
  const caption = el('input', { type: 'text', maxlength: 60, class: 'input', id: 'in-caption', autocomplete: 'off' });
  const push = debounce(() => {
    app.shared.setMany({ title: title.value.trim() ? title.value : null, caption: caption.value.trim() ? caption.value : null });
  }, 250);
  title.addEventListener('input', push);
  caption.addEventListener('input', push);

  const showDate = switchControl('Tampilkan tanggal', (v) => app.shared.set('showDate', v));
  const resetBtn = el('button', { type: 'button', class: 'btn soft block' }, [ico('undo', 18), 'Kembalikan teks otomatis']);
  resetBtn.addEventListener('click', () => app.shared.setMany({ title: null, caption: null }));

  const root = el('div', { class: 'tab-body' }, [
    el('label', { class: 'field', for: 'in-title' }, [el('span', { text: 'Judul di atas strip' }), title]),
    el('label', { class: 'field', for: 'in-caption' }, [el('span', { text: 'Nama / keterangan di bawah' }), caption]),
    showDate.el,
    resetBtn,
  ]);

  return {
    el: root,
    update() {
      const v = app.view();
      const tpl = getTemplate(v.template);
      title.placeholder = tpl.title;
      const names = v.names;
      caption.placeholder = names.host && names.guest ? `${names.host} & ${names.guest}` : names.host || names.guest || 'DuoBooth';
      if (document.activeElement !== title) title.value = v.title || '';
      if (document.activeElement !== caption) caption.value = v.caption || '';
      showDate.set(v.showDate);
    },
    destroy() {
      push.cancel();
    },
  };
}

// ---------------------------------------------------------------------------
// Panel bertab
// ---------------------------------------------------------------------------
const TAB_DEFS = {
  template: { label: 'Template', icon: 'palette', build: templateTab },
  bg: { label: 'Latar', icon: 'image', build: backgroundTab },
  sticker: { label: 'Stiker', icon: 'star', build: stickerTab },
  text: { label: 'Teks', icon: 'type', build: textTab },
};

export function createPanel(app, { tabs, stripView = null, initial = null, onTab = null }) {
  const bar = el('div', { class: 'tabbar', role: 'tablist' });
  const body = el('div', { class: 'tab-panels' });
  const parts = new Map();
  let active = initial && tabs.includes(initial) ? initial : tabs[0];

  for (const id of tabs) {
    const def = TAB_DEFS[id];
    const tab = def.build(app, stripView);
    const panel = el('div', { class: 'tab-panel', role: 'tabpanel', hidden: id !== active }, [tab.el]);
    const btn = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(id === active), 'data-tab': id }, [
      el('span', { class: 'tab-ico' }, [ico(def.icon, 20)]),
      el('span', { class: 'tab-label', text: def.label }),
    ]);
    btn.addEventListener('click', () => setTab(id));
    bar.append(btn);
    body.append(panel);
    parts.set(id, { tab, panel, btn });
  }

  function setTab(id) {
    active = id;
    for (const [tid, p] of parts) {
      const on = tid === id;
      p.panel.hidden = !on;
      p.btn.classList.toggle('active', on);
      p.btn.setAttribute('aria-selected', String(on));
    }
    if (onTab) onTab(id);
    parts.get(active).tab.update();
  }

  // Hanya tab yang sedang terlihat yang diperbarui, digabung per frame (menyeret stiker memicu ratusan event).
  let queued = false;
  function scheduleUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const p = parts.get(active);
      if (p) p.tab.update();
    });
  }
  const onState = (d) => {
    const onlyStickers = d && d.keys && d.keys.length && d.keys.every((k) => k.startsWith('stk:'));
    if (onlyStickers && active !== 'sticker') return;
    scheduleUpdate();
  };

  const unsubs = [app.on('state', onState), app.on('cutouts', scheduleUpdate), app.on('session', scheduleUpdate)];
  const root = el('div', { class: 'panel' }, [bar, body]);
  setTab(active);

  return {
    el: root,
    setTab,
    get active() {
      return active;
    },
    destroy() {
      unsubs.forEach((u) => u());
      parts.forEach((p) => p.tab.destroy());
    },
  };
}
