// Ikon SVG sederhana (gaya garis, 24x24) supaya tampil sama di semua perangkat tanpa bergantung pada font.

const P = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  download: '<path d="M12 4v11"/><path d="M7.5 11 12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.3 10.8 7-3.7M8.3 13.2l7 3.7"/>',
  rotateCcw: '<path d="M4 5v5h5"/><path d="M4.6 10A8 8 0 1 1 4.2 14"/>',
  rotateCw: '<path d="M20 5v5h-5"/><path d="M19.4 10A8 8 0 1 0 19.8 14"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M9 6 3.5 12 9 18z"/><path d="m15 6 5.5 6L15 18z"/>',
  up: '<path d="M12 19V6"/><path d="m6.5 11.5 5.5-5.5 5.5 5.5"/>',
  down: '<path d="M12 5v13"/><path d="m6.5 12.5 5.5 5.5 5.5-5.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="m6 7 1 12.5h10L18 7"/><path d="M10.5 11v5.5M13.5 11v5.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M4 4l16 16" stroke-width="2.4"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18c1.6 0 2.2-1.1 2.2-2.1 0-1.3-.9-1.6-.9-2.7 0-1 .8-1.7 1.9-1.7H18a3 3 0 0 0 3-3C21 6.9 17 3 12 3z"/><circle cx="7.6" cy="11.2" r="1.2"/><circle cx="10.3" cy="7.2" r="1.2"/><circle cx="15.3" cy="7.4" r="1.2"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="1.9"/><path d="m4 17.5 5-4.8 3.8 3.6 2.7-2.4 4.5 4"/>',
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9z"/>',
  type: '<path d="M5 7V4.5h14V7"/><path d="M12 4.5V20"/><path d="M9 20h6"/>',
  link: '<path d="M10 14a4.2 4.2 0 0 0 5.9 0l3-3a4.2 4.2 0 0 0-5.9-5.9l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-5.9 0l-3 3a4.2 4.2 0 0 0 5.9 5.9l1-1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  volume: '<path d="M4 9.5h3.5L13 5v14l-5.5-4.5H4z"/><path d="M16.3 9a4.2 4.2 0 0 1 0 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  upload: '<path d="M12 16V5"/><path d="m7.5 9 4.5-4.5L16.5 9"/><path d="M5 19.5h14"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m12 8 1.6 3.4L17 13l-3.4 1.6L12 18l-1.6-3.4L7 13l3.4-1.6z"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/><path d="M11 8.5v5M8.5 11h5"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/><path d="M8.5 11h5"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="m15 8 4 4-4 4"/><path d="M19 12H9"/>',
};

/** Buat elemen <span class="ico"> berisi ikon. */
export function ico(name, size = 20) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
  return span;
}
