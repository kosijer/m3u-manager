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

export const loadDraft = () => readJson(STORAGE_KEYS.draft);
export const storeDraft = draft => write(STORAGE_KEYS.draft, JSON.stringify(draft));
