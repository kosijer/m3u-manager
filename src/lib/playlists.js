import { DEFAULT_HEADER } from './m3u.js';
import { newId, normalizeStation } from './station.js';

/**
 * @typedef {object} Playlist
 * @property {string} id
 * @property {string} header    Prva linija fajla (#EXTM3U sa atributima).
 * @property {string} filename
 * @property {import('./station.js').Station[]} stations
 * @property {boolean} dirty    Ima izmene koje nisu sačuvane u fajl.
 */

/** @returns {Playlist} */
export function createPlaylist(filename, fields = {}) {
  return { id: newId('p'), header: DEFAULT_HEADER, filename, stations: [], dirty: false, ...fields };
}

/** Pravi ispravnu plejlistu od nepouzdanih podataka (localStorage). */
export function normalizePlaylist(raw, fallbackName) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const list = createPlaylist(typeof p.filename === 'string' && p.filename ? p.filename : fallbackName, {
    header: typeof p.header === 'string' && p.header ? p.header : DEFAULT_HEADER,
    stations: Array.isArray(p.stations) ? p.stations.map(normalizeStation) : [],
    dirty: !!p.dirty,
  });
  if (typeof p.id === 'string' && p.id) list.id = p.id;
  return list;
}

/** "radio.m3u" -> "radio-2.m3u" ako je ime već zauzeto. */
export function uniqueFilename(name, taken) {
  if (!taken.includes(name)) return name;
  const [, base, ext = ''] = /^(.*?)(\.m3u8?)?$/i.exec(name);
  for (let i = 2; ; i++) {
    const next = `${base}-${i}${ext}`;
    if (!taken.includes(next)) return next;
  }
}

export const tabLabel = filename => filename.replace(/\.m3u8?$/i, '') || filename;
