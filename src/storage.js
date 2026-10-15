import { STORAGE_KEYS } from './config.js';

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Vraća false ako browser odbije upis (privatni režim, pun prostor). */
function write(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function readJson(key) {
  try { return JSON.parse(read(key) || 'null'); } catch { return null; }
}

export const loadSettings = () => readJson(STORAGE_KEYS.settings);
export const storeSettings = settings => write(STORAGE_KEYS.settings, JSON.stringify(settings));

/** Nacrt iz verzije sa jednom plejlistom; čita se samo radi prenosa u tabove. */
export const loadDraft = () => readJson(STORAGE_KEYS.draft);
export const removeDraft = () => { try { localStorage.removeItem(STORAGE_KEYS.draft); } catch { /* privatni režim */ } };

export const loadPlaylists = () => readJson(STORAGE_KEYS.playlists);
export const storePlaylists = data => write(STORAGE_KEYS.playlists, JSON.stringify(data));

export const loadHistory = () => readJson(STORAGE_KEYS.history);
export const storeHistory = entries => write(STORAGE_KEYS.history, JSON.stringify(entries));

export const loadFavorites = () => readJson(STORAGE_KEYS.favorites);
export const storeFavorites = titles => write(STORAGE_KEYS.favorites, JSON.stringify(titles));
