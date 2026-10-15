import { foldText } from './text.js';

/**
 * @typedef {object} HistoryEntry
 * @property {number} at       Vreme kad je pesma prepoznata (ms).
 * @property {string} title    Naziv pesme kako ga stanica šalje (obično "Izvođač - Pesma").
 * @property {string} station  Naziv stanice u tom trenutku.
 * @property {string} url      Link streama.
 */

/** Ista pesma na istoj stanici u ovom razmaku je ista pesma (npr. stanica ponovo pokrenuta). */
const REPEAT_MS = 15 * 60_000;

/** Dodaje pesmu na vrh liste (najnovija prva). Vraća istu listu ako je pesma već upisana. */
export function addEntry(list, entry, max) {
  const seen = list.some(e => e.url === entry.url && e.title === entry.title && entry.at - e.at < REPEAT_MS);
  return seen ? list : [entry, ...list].slice(0, max);
}

/** Pravi ispravnu listu od nepouzdanih podataka iz localStorage-a. */
export function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(e => e && typeof e === 'object' && typeof e.title === 'string' && e.title && Number.isFinite(e.at))
    .map(e => ({ at: e.at, title: e.title, station: String(e.station || ''), url: String(e.url || '') }));
}

export function filterEntries(list, query) {
  const q = foldText(query.trim());
  if (!q) return list;
  return list.filter(e => foldText(e.title).includes(q) || foldText(e.station).includes(q));
}

const pad = n => String(n).padStart(2, '0');

/** "2026-10-15 15:12:05" po lokalnom vremenu. */
export function localStamp(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const timeOfDay = ts => localStamp(ts).slice(11, 16);

/** "Danas", "Juče" ili "13. 10. 2026." */
export function dayLabel(ts, now = Date.now()) {
  const day = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const diff = Math.round((day(now) - day(ts)) / 86_400_000);
  if (diff === 0) return 'Danas';
  if (diff === 1) return 'Juče';
  const d = new Date(ts);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`;
}

const csvField = v => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(list) {
  const rows = [['Vreme', 'Stanica', 'Pesma', 'Link'], ...list.map(e => [localStamp(e.at), e.station, e.title, e.url])];
  return rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export const searchLinks = title => ({
  youtube: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(title),
  spotify: 'https://open.spotify.com/search/' + encodeURIComponent(title),
});
