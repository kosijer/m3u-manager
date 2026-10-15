import { canUpload, savePlaylists, serialize, state } from '../state.js';
import { formatCount, truncate } from '../lib/text.js';
import { els, toast } from './dom.js';
import { renderTabs } from './tabs.js';

let draftTimer;
let draftWarned = false;

/** Čuva sve plejliste u pregledaču. */
export function persistDraft() {
  clearTimeout(draftTimer);
  if (savePlaylists()) { draftWarned = false; return; }
  if (draftWarned) return;
  draftWarned = true;
  toast('Plejliste nije moguće sačuvati u pregledaču (nema mesta ili je zabranjeno). Sačuvaj plejlistu u fajl da ne izgubiš izmene.', 'err');
}

/** Dok se šalje logo, lista ne sme da se zameni ili promeni tab. */
export function busyGuard() {
  if (!state.busy) return false;
  toast('Sačekaj da se završi slanje loga.', 'err');
  return true;
}

/** Pregledač je odbio poslednji upis, pa zatvaranje stranice gubi izmene. */
export const draftFailed = () => draftWarned;

export function schedulePersist() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(persistDraft, 400);
}

/** Beleži izmenu: osvežava traku i odloženo čuva plejliste. */
export function markDirty() {
  state.dirty = true;
  updateUI();
  schedulePersist();
}

export function updateUI() {
  const n = state.stations.length;
  els.countTag.textContent = formatCount(n);
  els.status.textContent = state.dirty ? 'Nije sačuvano u fajl' : '';
  els.status.classList.toggle('dirty', state.dirty);
  els.btnSave.disabled = n === 0;
  els.btnCopy.disabled = n === 0;
  els.hdrTag.textContent = truncate(state.header, 34);
  els.hostNote.hidden = canUpload();
  els.posOf.textContent = 'od ' + n;
  if (els.raw.open) els.rawPre.textContent = serialize();
  renderTabs();
}

export function initStatus() {
  els.raw.addEventListener('toggle', updateUI);
}
