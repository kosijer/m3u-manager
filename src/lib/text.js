export function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

/** Srpska množina: 1 stanica, 2-4 stanice, 5+ stanica (11-14 stanica, 21 stanica, 22 stanice). */
export function pluralStations(n) {
  const a = n % 10, b = n % 100;
  return a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'stanice' : 'stanica';
}

export const formatCount = n => `${n} ${pluralStations(n)}`;

/** 1 pesma, 2-4 pesme, 5+ pesama (11-14 pesama, 21 pesma). */
export function formatSongs(n) {
  const a = n % 10, b = n % 100;
  const word = a === 1 && b !== 11 ? 'pesma' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'pesme' : 'pesama';
  return `${n} ${word}`;
}

/** Mala slova bez dijakritika, za pretragu (č, ć, š, ž; đ nema rastavljen oblik). */
export const foldText = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj');

export function initials(name) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return (((w[0] || '?')[0]) + ((w[1] || '')[0] || '')).toUpperCase();
}

export const truncate = (s, max) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

export const isStreamUrl = url => /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(url);

/** Bezbedno ime fajla sa ekstenzijom .m3u ili .m3u8. */
export function cleanFilename(name) {
  const n = (name || '').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'radio';
  return /\.m3u8?$/i.test(n) ? n : n + '.m3u';
}

export function slugify(s, fallback = 'logo') {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}
