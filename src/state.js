import { DEFAULT_FILENAME, DEFAULT_PROVIDER, ENV_KEYS, PROVIDERS } from './config.js';
import { DEFAULT_HEADER, serializeM3U } from './lib/m3u.js';
import { normalizeStation } from './lib/station.js';
import * as storage from './storage.js';

export const state = {
  /** @type {import('./lib/station.js').Station[]} */
  stations: [],
  header: DEFAULT_HEADER,
  filename: DEFAULT_FILENAME,
  selectedId: null,
  dirty: false,
  /** Forma trenutno čuva stanicu (čeka upload loga). */
  busy: false,
};

export const settings = { provider: DEFAULT_PROVIDER, imgbb: '', imgur: '' };

export const findStation = id => state.stations.find(s => s.id === id);
export const selectedStation = () => (state.selectedId ? findStation(state.selectedId) : null);
export const pendingCount = () => state.stations.filter(s => s.pending).length;
export const serialize = () => serializeM3U(state.header, state.stations);

export function moveStation(from, to) {
  const [moved] = state.stations.splice(from, 1);
  state.stations.splice(to, 0, moved);
  return moved;
}

export function resetPlaylist() {
  Object.assign(state, { stations: [], header: DEFAULT_HEADER, filename: DEFAULT_FILENAME, selectedId: null, dirty: false });
}

/* ---------- podešavanje upload-a ---------- */

/** Ključ iz aplikacije ima prednost, pa onda ključ iz .env fajla. */
export const uploadKey = (provider = settings.provider) => settings[provider] || ENV_KEYS[provider] || '';
export const canUpload = () => !!uploadKey();

export function restoreSettings() {
  const saved = storage.loadSettings();
  if (!saved || typeof saved !== 'object') return;
  if (PROVIDERS.includes(saved.provider)) settings.provider = saved.provider;
  for (const p of PROVIDERS) if (typeof saved[p] === 'string') settings[p] = saved[p];
}

export function updateSettings(next) {
  Object.assign(settings, next);
  return storage.storeSettings(settings);
}

/* ---------- nacrt ---------- */

export function saveDraft() {
  const { header, filename, stations, dirty } = state;
  return storage.storeDraft({ header, filename, stations, dirty });
}

/** Vraća broj vraćenih stanica (0 ako nema nesačuvanog nacrta). */
export function restoreDraft() {
  const d = storage.loadDraft();
  if (!d || !d.dirty || !Array.isArray(d.stations) || !d.stations.length) return 0;
  state.stations = d.stations.map(normalizeStation);
  state.header = typeof d.header === 'string' && d.header ? d.header : DEFAULT_HEADER;
  state.filename = typeof d.filename === 'string' && d.filename ? d.filename : DEFAULT_FILENAME;
  state.dirty = true;
  return state.stations.length;
}
