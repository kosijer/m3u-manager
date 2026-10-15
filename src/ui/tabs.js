import { tabLabel } from '../lib/playlists.js';
import { formatCount } from '../lib/text.js';
import { addPlaylist, closePlaylist, playlists, state, switchPlaylist } from '../state.js';
import { els, toast } from './dom.js';
import { showPlaylist } from './playlist.js';
import { busyGuard } from './status.js';

/** Padajući meni plejlisti u redu sa imenom fajla (+ nova, × zatvori). */

const CONFIRM_MS = 3000;
let armed = false;
let armTimer;

/** Podaci liste; aktivna je ažurna samo u `state`. */
function info(p) {
  const active = p.id === state.playlistId;
  const src = active ? state : p;
  return { active, name: src.filename, count: src.stations.length, dirty: src.dirty };
}

export function renderTabs() {
  const sel = els.plSelect;
  const keep = document.activeElement === sel;
  sel.replaceChildren(...playlists.map(p => {
    const { name, count, dirty } = info(p);
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${tabLabel(name)}${dirty ? ' •' : ''} (${formatCount(count)})`;
    opt.title = dirty ? 'Nije sačuvano u fajl' : '';
    return opt;
  }));
  sel.value = state.playlistId;
  if (keep) sel.focus();

  const cur = info(playlists.find(p => p.id === state.playlistId) || playlists[0]);
  els.btnPlClose.classList.toggle('danger', armed);
  els.btnPlClose.querySelector('.lbl').textContent = armed ? '?' : '×';
  els.btnPlClose.title = armed
    ? 'Klikni ponovo da zatvoriš (stanice nisu sačuvane u fajl)'
    : 'Zatvori plejlistu';
  els.btnPlClose.setAttribute('aria-label', armed
    ? 'Potvrdi zatvaranje ' + tabLabel(cur.name)
    : 'Zatvori ' + tabLabel(cur.name));
}

function disarm() {
  clearTimeout(armTimer);
  armed = false;
  renderTabs();
}

function openPlaylist(id) {
  if (id === state.playlistId || busyGuard()) {
    els.plSelect.value = state.playlistId;
    return;
  }
  disarm();
  switchPlaylist(id);
  showPlaylist();
}

function newPlaylist() {
  if (busyGuard()) return;
  disarm();
  addPlaylist();
  showPlaylist();
  els.fFile.focus();
  els.fFile.select();
}

function closeCurrent() {
  if (busyGuard()) return;
  const id = state.playlistId;
  const p = playlists.find(x => x.id === id);
  if (!p) return;
  const { name, count, dirty } = info(p);
  if (count && dirty && !armed) {
    clearTimeout(armTimer);
    armed = true;
    renderTabs();
    armTimer = setTimeout(disarm, CONFIRM_MS);
    return;
  }
  clearTimeout(armTimer);
  armed = false;
  closePlaylist(id);
  showPlaylist();
  toast('Zatvoreno: ' + tabLabel(name));
}

export function initTabs() {
  els.plSelect.addEventListener('change', () => openPlaylist(els.plSelect.value));
  els.btnPlAdd.addEventListener('click', newPlaylist);
  els.btnPlClose.addEventListener('click', closeCurrent);
  renderTabs();
}
