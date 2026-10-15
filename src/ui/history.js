import { HISTORY_MAX, NOWPLAYING_URL } from '../config.js';
import { downloadBlob } from '../lib/blob.js';
import { addEntry, dayLabel, filterEntries, localStamp, normalizeFavorites, normalizeHistory, searchLinks, timeOfDay, toCsv, toggleFavorite } from '../lib/history.js';
import { formatSongs } from '../lib/text.js';
import { onPlayerChange, playerState } from '../services/player.js';
import { currentTrack, onTrackChange } from '../services/track.js';
import { findAnyStation } from '../state.js';
import * as storage from '../storage.js';
import { confirmButton, els, toast } from './dom.js';

/**
 * Istorija pesama: svaka nova pesma koju Worker javi upisuje se sa stanicom i vremenom.
 * Desni panel prikazuje ili plejlistu ili istoriju. Zvezdica čuva omiljene po nazivu pesme.
 */

/** @type {import('../lib/history.js').HistoryEntry[]} */
let entries = [];
/** @type {string[]} */
let favorites = [];
let view = 'playlist';

const STAR = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.2 2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.9 6.9 18.6l.9-5.6-4-3.9 5.6-.8Z"/></svg>';

/** @param {'playlist' | 'history'} name */
export function showView(name) {
  view = name;
  const history = name === 'history';
  els.plView.hidden = history;
  els.histView.hidden = !history;
  els.countTag.hidden = history;
  els.histCount.hidden = !history;
  if (history) {
    els.viewPlaylist.removeAttribute('aria-current');
    els.viewHistory.setAttribute('aria-current', 'page');
  } else {
    els.viewHistory.removeAttribute('aria-current');
    els.viewPlaylist.setAttribute('aria-current', 'page');
  }
  document.body.classList.toggle('view-history', history);
  if (history) renderHistory();
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(href, text, title) {
  const a = el('a', 'flag', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.title = title;
  return a;
}

/** Pesma koja upravo ide (prvi upis, ako stanica još svira istu pesmu). */
function isNow(e) {
  const p = playerState();
  return p.status === 'playing' && p.url === e.url && currentTrack().title === e.title;
}

function rowEl(e, now) {
  const fav = favorites.includes(e.title);
  const li = el('li', 'hrow' + (now ? ' now' : '') + (fav ? ' fav' : ''));
  const time = el('time', 'ht', timeOfDay(e.at));
  time.dateTime = new Date(e.at).toISOString();
  time.title = localStamp(e.at);
  const star = el('button', 'hfav' + (fav ? ' on' : ''));
  star.type = 'button';
  star.innerHTML = STAR;
  star.title = fav ? 'Ukloni iz omiljenih' : 'Dodaj u omiljene';
  star.setAttribute('aria-label', fav ? 'Ukloni iz omiljenih: ' + e.title : 'Dodaj u omiljene: ' + e.title);
  star.setAttribute('aria-pressed', String(fav));
  star.dataset.title = e.title;
  const main = el('div', 'hmain');
  main.append(el('div', 'hti', e.title), el('div', 'hst', e.station || e.url));
  main.title = e.url;
  const { youtube, spotify } = searchLinks(e.title);
  const act = el('div', 'hact');
  act.append(link(youtube, 'YouTube', 'Traži na YouTube-u'), link(spotify, 'Spotify', 'Traži na Spotify-u'));
  li.append(time, star, main, act);
  return li;
}

export function renderHistory() {
  els.histCount.textContent = formatSongs(entries.length);
  els.btnHistCsv.disabled = els.btnHistClear.disabled = !entries.length;
  if (view !== 'history') return;

  const q = els.histSearch.value;
  const shown = filterEntries(entries, q);
  const nodes = [];
  let day = null, ol = null;
  shown.forEach(e => {
    const label = dayLabel(e.at);
    if (label !== day) {
      day = label;
      ol = el('ol', 'hlist');
      nodes.push(el('h3', 'hday', label), ol);
    }
    ol.append(rowEl(e, e === entries[0] && isNow(e)));
  });
  els.histList.replaceChildren(...nodes);

  els.histEmpty.hidden = shown.length > 0;
  if (entries.length) {
    els.histEmptyTitle.textContent = 'Nema rezultata';
    els.histEmptyText.textContent = `Nijedna pesma ni stanica ne sadrži „${q.trim()}”.`;
  } else {
    els.histEmptyTitle.textContent = 'Istorija je prazna';
    els.histEmptyText.textContent = NOWPLAYING_URL
      ? 'Dok stanica svira, ovde se upisuje svaka nova pesma, sa nazivom stanice i vremenom. Radi za stanice koje šalju naziv pesme.'
      : 'Naziv pesme nije podešen (VITE_NOWPLAYING_URL), pa se pesme ne beleže. Vidi README, odeljak "Naziv pesme".';
  }
}

function record(t) {
  if (!t.id || !t.title) return;
  const p = playerState();
  const next = addEntry(entries, {
    at: Date.now(),
    title: t.title,
    station: findAnyStation(t.id)?.name ?? '',
    url: p.url ?? '',
  }, HISTORY_MAX);
  if (next === entries) return;
  entries = next;
  storage.storeHistory(entries);
  renderHistory();
}

function downloadCsv() {
  const name = `istorija-pesama-${localStamp(Date.now()).slice(0, 10)}.csv`;
  // BOM: Excel bez njega pogrešno čita ćirilicu i naša slova.
  downloadBlob(new Blob(['\uFEFF' + toCsv(entries, favorites)], { type: 'text/csv;charset=utf-8' }), name);
}

function clearHistory() {
  entries = [];
  storage.storeHistory(entries);
  els.histSearch.value = '';
  renderHistory();
  toast('Istorija je obrisana.');
}

export function initHistory() {
  entries = normalizeHistory(storage.loadHistory());
  favorites = normalizeFavorites(storage.loadFavorites());
  els.viewPlaylist.addEventListener('click', () => showView('playlist'));
  els.viewHistory.addEventListener('click', () => showView('history'));
  els.histSearch.addEventListener('input', renderHistory);
  els.btnHistCsv.addEventListener('click', downloadCsv);
  confirmButton(els.btnHistClear, 'Obrisati istoriju?', clearHistory);
  els.histList.addEventListener('click', e => {
    const btn = e.target.closest('.hfav');
    if (!btn) return;
    favorites = toggleFavorite(favorites, btn.dataset.title);
    storage.storeFavorites(favorites);
    renderHistory();
  });
  onTrackChange(record);
  onPlayerChange(() => { if (view === 'history') renderHistory(); });
  renderHistory();
}
