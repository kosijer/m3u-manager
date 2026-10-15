import { tabLabel } from '../lib/playlists.js';
import { formatCount } from '../lib/text.js';
import { addPlaylist, closePlaylist, playlists, state, switchPlaylist } from '../state.js';
import { els, toast } from './dom.js';
import { renderList } from './list.js';
import { showPlaylist } from './playlist.js';
import { busyGuard, persistDraft } from './status.js';

/** Tabovi iznad plejliste: svaki tab je posebna plejlista sačuvana u pregledaču. */

const CONFIRM_MS = 3000;
let armedId = null;
let armTimer;

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Podaci taba; aktivna plejlista je ažurna samo u `state`. */
function info(p) {
  const active = p.id === state.playlistId;
  const src = active ? state : p;
  return { active, name: src.filename, count: src.stations.length, dirty: src.dirty };
}

function tabEl(p) {
  const { active, name, count, dirty } = info(p);
  const tab = el('div', 'ptab' + (active ? ' on' : '') + (dirty ? ' dirty' : ''));
  tab.dataset.id = p.id;

  const main = el('button', 'ptab-main');
  main.type = 'button';
  main.setAttribute('aria-current', String(active));
  main.title = `${name}, ${formatCount(count)}${dirty ? ', nije sačuvano u fajl' : ''}`;
  main.append(el('span', 'ptab-name', tabLabel(name)));
  if (dirty) main.append(el('span', 'ptab-dot'));

  const armed = armedId === p.id;
  const close = el('button', 'ptab-x' + (armed ? ' armed' : ''), armed ? 'Zatvori?' : '×');
  close.type = 'button';
  close.title = armed ? 'Klikni ponovo da zatvoriš (stanice nisu sačuvane u fajl)' : 'Zatvori';
  close.setAttribute('aria-label', armed ? 'Potvrdi zatvaranje ' + tabLabel(name) : 'Zatvori ' + tabLabel(name));

  tab.append(main, close);
  return tab;
}

export function renderTabs() {
  const strip = els.plTabs;
  const f = document.activeElement;
  const focus = strip.contains(f) ? { id: f.closest('.ptab')?.dataset.id, cls: f.classList[0] } : null;

  const add = el('button', 'ptab-add', '+');
  add.type = 'button';
  add.title = 'Nova plejlista';
  add.setAttribute('aria-label', 'Nova plejlista');
  strip.replaceChildren(...playlists.map(tabEl), add);

  if (focus) {
    const sel = focus.id ? `.ptab[data-id="${focus.id}"] .${focus.cls}` : '.ptab-add';
    strip.querySelector(sel)?.focus();
  }
}

function disarm() {
  clearTimeout(armTimer);
  armedId = null;
  renderTabs();
}

function openTab(id) {
  if (id === state.playlistId || busyGuard()) return;
  disarm();
  switchPlaylist(id);
  showPlaylist();
}

function newTab() {
  if (busyGuard()) return;
  disarm();
  addPlaylist();
  showPlaylist();
  els.fFile.focus();
  els.fFile.select();
}

function closeTab(id) {
  if (busyGuard()) return;
  const p = playlists.find(x => x.id === id);
  if (!p) return;
  const { active, name, count, dirty } = info(p);
  if (count && dirty && armedId !== id) {
    clearTimeout(armTimer);
    armedId = id;
    renderTabs();
    armTimer = setTimeout(disarm, CONFIRM_MS);
    return;
  }
  clearTimeout(armTimer);
  armedId = null;
  closePlaylist(id);
  if (active) showPlaylist();
  else { renderList(); persistDraft(); }
  toast('Zatvoreno: ' + tabLabel(name));
}

export function initTabs() {
  els.plTabs.addEventListener('click', e => {
    if (e.target.closest('.ptab-add')) { newTab(); return; }
    const tab = e.target.closest('.ptab');
    if (!tab) return;
    if (e.target.closest('.ptab-x')) closeTab(tab.dataset.id);
    else openTab(tab.dataset.id);
  });
  // Srednji klik zatvara tab, kao u pregledaču.
  els.plTabs.addEventListener('auxclick', e => {
    const tab = e.button === 1 && e.target.closest('.ptab');
    if (tab) closeTab(tab.dataset.id);
  });
  renderTabs();
}
