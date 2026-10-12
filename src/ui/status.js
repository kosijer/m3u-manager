import { canUpload, saveDraft, serialize, state } from '../state.js';
import { formatCount, truncate } from '../lib/text.js';
import { els, toast } from './dom.js';

let draftTimer;
let draftWarned = false;

export function persistDraft() {
  clearTimeout(draftTimer);
  if (saveDraft()) { draftWarned = false; return; }
  if (draftWarned) return;
  draftWarned = true;
  toast('Nacrt nije moguće sačuvati u pregledaču (nema mesta ili je zabranjeno). Sačuvaj plejlistu da ne izgubiš izmene.', 'err');
}

/** Beleži izmenu: osvežava traku i odloženo čuva nacrt. */
export function markDirty() {
  state.dirty = true;
  updateUI();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(persistDraft, 400);
}

export function updateUI() {
  const n = state.stations.length;
  els.countTag.textContent = formatCount(n);
  els.status.textContent = state.dirty ? 'Nesačuvane izmene' : '';
  els.status.classList.toggle('dirty', state.dirty);
  els.btnSave.disabled = n === 0;
  els.btnCopy.disabled = n === 0;
  els.hdrTag.textContent = truncate(state.header, 34);
  els.hostNote.hidden = canUpload();
  els.posOf.textContent = 'od ' + n;
  if (els.raw.open) els.rawPre.textContent = serialize();
}

export function initStatus() {
  els.raw.addEventListener('toggle', updateUI);
}
