// Salin kode/tautan dan bagikan undangan.

export function inviteLink(code) {
  return `${location.origin}/r/${code}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* lanjut ke cara lama */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export const canNativeShare = () => typeof navigator.share === 'function';

export async function shareInvite(code, name) {
  const url = inviteLink(code);
  const text = `${name ? name + ' mengajakmu' : 'Ayo'} photobooth bareng di DuoBooth! Kode room: ${code}`;
  try {
    await navigator.share({ title: 'DuoBooth', text, url });
    return true;
  } catch (e) {
    return e && e.name === 'AbortError';
  }
}

/** Bagikan gambar hasil (menu bagikan bawaan HP -> bisa langsung "Simpan ke Foto"). */
export async function shareImage(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Foto DuoBooth kami' });
      return 'shared';
    } catch (e) {
      return e && e.name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }
  return 'unsupported';
}
