import { HISTORY_MAX, NOWPLAYING_URL } from '../config.js';
import { downloadBlob } from '../lib/blob.js';
import { addEntry, dayLabel, filterEntries, localStamp, normalizeHistory, searchLinks, timeOfDay, toCsv } from '../lib/history.js';
import { formatSongs } from '../lib/text.js';
import { onPlayerChange, playerState } from '../services/player.js';
import { currentTrack, onTrackChange } from '../services/track.js';
import { findStation } from '../state.js';
import * as storage from '../storage.js';
import { confirmButton, els, toast } from './dom.js';

/**
 * Istorija pesama: svaka nova pesma koju Worker javi upisuje se sa stanicom i vremenom.
 * Desni panel prikazuje ili plejlistu ili istoriju.
 */

/** @type {import('../lib/history.js').HistoryEntry[]} */
let entries = [];
let view = 'playlist';

/** @param {'playlist' | 'history'} name */
export function showView(name) {
  view = name;
  const history = name === 'history';
  els.plView.hidden = history;
  els.histView.hidden = !history;
  els.plActions.hidden = history;
  els.histActions.hidden = !history;
  els.countTag.hidden = history;
  els.histCount.hidden = !history;
  els.viewPlaylist.setAttribute('aria-pressed', String(!history));
  els.viewHistory.setAttribute('aria-pressed', String(history));
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
  const li = el('li', 'hrow' + (now ? ' now' : ''));
  const time = el('time', 'ht', timeOfDay(e.at));
  time.dateTime = new Date(e.at).toISOString();
  time.title = localStamp(e.at);
  const main = el('div', 'hmain');
  main.append(el('div', 'hti', e.title), el('div', 'hst', e.station || e.url));
  main.title = e.url;
  const { youtube, spotify } = searchLinks(e.title);
  const act = el('div', 'hact');
  act.append(link(youtube, 'YouTube', 'Traži na YouTube-u'), link(spotify, 'Spotify', 'Traži na Spotify-u'));
  li.append(time, main, act);
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
    station: findStation(t.id)?.name ?? '',
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
  downloadBlob(new Blob(['\uFEFF' + toCsv(entries)], { type: 'text/csv;charset=utf-8' }), name);
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
  els.viewPlaylist.addEventListener('click', () => showView('playlist'));
  els.viewHistory.addEventListener('click', () => showView('history'));
  els.histSearch.addEventListener('input', renderHistory);
  els.btnHistCsv.addEventListener('click', downloadCsv);
  confirmButton(els.btnHistClear, 'Obrisati istoriju?', clearHistory);
  onTrackChange(record);
  onPlayerChange(() => { if (view === 'history') renderHistory(); });
  renderHistory();
}
