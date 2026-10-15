import { DEFAULT_FILENAME, DEFAULT_PROVIDER, ENV_KEYS, PROVIDERS } from './config.js';
import { DEFAULT_HEADER, serializeM3U } from './lib/m3u.js';
import { createPlaylist, normalizePlaylist, uniqueFilename } from './lib/playlists.js';
import * as storage from './storage.js';

/** Aktivna plejlista (tab). Ostale su u `playlists`; aktivna se tamo upisuje pri promeni taba i čuvanju. */
export const state = {
  playlistId: '',
  /** @type {import('./lib/station.js').Station[]} */
  stations: [],
  header: DEFAULT_HEADER,
  filename: DEFAULT_FILENAME,
  selectedId: null,
  dirty: false,
  /** Forma trenutno čuva stanicu (čeka upload loga). */
  busy: false,
};

/** Svi tabovi, redom. @type {import('./lib/playlists.js').Playlist[]} */
export const playlists = [];

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

/* ---------- tabovi ---------- */

const activePlaylist = () => playlists.find(p => p.id === state.playlistId);

function syncActive() {
  const p = activePlaylist();
  if (p) Object.assign(p, { header: state.header, filename: state.filename, stations: state.stations, dirty: state.dirty });
}

function load(p) {
  Object.assign(state, { playlistId: p.id, header: p.header, filename: p.filename, stations: p.stations, dirty: p.dirty, selectedId: null });
}

/** Plejlista u kojoj je stanica (može biti i u tabu koji nije otvoren). */
export function playlistOf(station) {
  syncActive();
  return playlists.find(p => p.stations.includes(station)) ?? null;
}

/** Traži stanicu u svim tabovima (npr. stanica koja svira iz drugog taba). */
export function findAnyStation(id) {
  if (!id) return undefined;
  syncActive();
  for (const p of playlists) {
    const s = p.stations.find(x => x.id === id);
    if (s) return s;
  }
  return undefined;
}

export function switchPlaylist(id) {
  const next = playlists.find(p => p.id === id);
  if (!next || id === state.playlistId) return;
  syncActive();
  load(next);
}

/** Otvara novi tab (prazan ili sa uvezenim stanicama) i prelazi na njega. */
export function addPlaylist(fields = {}) {
  syncActive();
  const name = uniqueFilename(fields.filename || DEFAULT_FILENAME, playlists.map(p => p.filename));
  const p = createPlaylist(name, { ...fields, filename: name });
  const at = playlists.findIndex(x => x.id === state.playlistId);
  playlists.splice(at + 1, 0, p);
  load(p);
  return p;
}

/** Zatvara tab. Poslednji tab se ne zatvara, nego postaje prazan. */
export function closePlaylist(id) {
  const i = playlists.findIndex(p => p.id === id);
  if (i < 0) return;
  syncActive();
  playlists.splice(i, 1);
  if (!playlists.length) playlists.push(createPlaylist(DEFAULT_FILENAME));
  if (id === state.playlistId) load(playlists[Math.min(i, playlists.length - 1)]);
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

/* ---------- čuvanje u pregledaču ---------- */

export function savePlaylists() {
  syncActive();
  return storage.storePlaylists({ activeId: state.playlistId, playlists });
}

/** Vraća sve tabove. Prvi put preuzima nacrt iz verzije sa jednom plejlistom. */
export function restorePlaylists() {
  const saved = storage.loadPlaylists();
  let list = Array.isArray(saved?.playlists) ? saved.playlists.map(p => normalizePlaylist(p, DEFAULT_FILENAME)) : [];
  if (!saved) {
    const draft = storage.loadDraft();
    if (draft && Array.isArray(draft.stations) && draft.stations.length) list = [normalizePlaylist(draft, DEFAULT_FILENAME)];
  }
  if (!list.length) list = [createPlaylist(DEFAULT_FILENAME)];
  playlists.splice(0, playlists.length, ...list);
  load(list.find(p => p.id === saved?.activeId) ?? list[0]);
  if (!saved && savePlaylists()) storage.removeDraft();
}
