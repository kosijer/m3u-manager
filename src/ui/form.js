import { createStation } from '../lib/station.js';
import { isStreamUrl } from '../lib/text.js';
import { canUpload, findStation, moveStation, selectedStation, state } from '../state.js';
import { MissingKeyError, describeUploadError } from '../services/upload.js';
import { clearCrop, exportCrop, isCropActive, updateLogoThumb } from './cropper.js';
import { confirmButton, els, setLabel, toast } from './dom.js';
import { markSelected, renderList } from './list.js';
import { previewStation } from './now-playing.js';
import { markDirty, updateUI } from './status.js';
import { uploadLogo } from './uploads.js';

let resetDeleteButton = () => {};

/** Polje se samo uokviri crveno; tekst greške ide u snackbar. */
function markInvalid(input, invalid) {
  input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

/** Puni formu podacima stanice (izmena) ili je prazni (nova stanica). */
export function fillForm(station) {
  clearCrop();
  resetDeleteButton();
  const edit = !!station;
  els.fName.value = station?.name ?? '';
  els.fUrl.value = station?.url ?? '';
  els.fLogo.value = station?.logo ?? '';
  markInvalid(els.fName, false);
  markInvalid(els.fUrl, false);
  els.formTitle.textContent = edit ? 'Izmena stanice' : 'Nova stanica';
  els.modeTag.hidden = !edit;
  if (edit) {
    const pos = state.stations.indexOf(station) + 1;
    els.modeTag.textContent = '#' + pos;
    els.fPos.value = String(pos);
    els.fPos.max = String(state.stations.length);
  }
  els.posRow.hidden = !edit;
  els.btnCancel.hidden = !edit;
  els.btnDel.hidden = !edit;
  setLabel(els.btnSubmit, edit ? 'Sačuvaj izmene' : 'Dodaj stanicu');
  updateLogoThumb();
  updateUI();
}

export function selectStation(id) {
  if (state.busy) return;
  const s = findStation(id);
  if (!s) return;
  state.selectedId = id;
  fillForm(s);
  markSelected();
  previewStation(id);
  if (innerWidth <= 860) els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.fName.focus({ preventScroll: true });
}

export function deselect() {
  if (state.busy) return;
  state.selectedId = null;
  fillForm(null);
  markSelected();
}

/**
 * Određuje šta se menja u logu stanice. Ako je u kropperu slika, šalje je na servis;
 * ako upload ne uspe, slika ostaje kao `pending` da se pošalje kasnije.
 */
async function resolveLogo(original) {
  if (!isCropActive()) {
    const link = els.fLogo.value.trim();
    if (link === (original?.logo ?? '')) return { patch: {} };
    return { patch: link ? { logo: link, pending: '' } : { logo: '' } };
  }
  const out = await exportCrop();
  if (!canUpload()) return { patch: { pending: out.dataUrl }, error: new MissingKeyError() };
  try {
    return { patch: { logo: await uploadLogo(out.blob), pending: '' } };
  } catch (error) {
    return { patch: { pending: out.dataUrl }, error };
  }
}

async function onSubmit(e) {
  e.preventDefault();
  if (state.busy) return;

  const name = els.fName.value.trim();
  const url = els.fUrl.value.trim();
  const urlOk = isStreamUrl(url);
  markInvalid(els.fName, !name);
  markInvalid(els.fUrl, !urlOk);
  if (!name || !urlOk) {
    const problems = [
      !name && 'upiši naziv stanice',
      !url && 'nalepi link ka stanici',
      url && !urlOk && 'link treba da počinje sa http:// ili https://',
    ].filter(Boolean);
    toast(problems.join(', ').replace(/^./, c => c.toUpperCase()) + '.', 'err');
    (name ? els.fUrl : els.fName).focus();
    return;
  }

  const editing = selectedStation();
  const requestedPos = parseInt(els.fPos.value, 10);

  state.busy = true;
  els.btnSubmit.disabled = true;
  if (isCropActive() && canUpload()) setLabel(els.btnSubmit, 'Šaljem logo…');
  try {
    const { patch, error } = await resolveLogo(editing);

    // Dok je logo slat, stanica je mogla da bude obrisana (npr. "Novo" ili uvoz koji zamenjuje listu).
    if (editing && !state.stations.includes(editing)) {
      toast('Stanica je u međuvremenu uklonjena iz liste, izmene nisu sačuvane.', 'err');
      return;
    }

    const station = editing || createStation();
    Object.assign(station, { name, url }, patch);
    if (editing) {
      const cur = state.stations.indexOf(station);
      const pos = Math.max(1, Math.min(state.stations.length, requestedPos || cur + 1)) - 1;
      if (pos !== cur) moveStation(cur, pos);
    } else {
      state.stations.push(station);
    }

    state.selectedId = null;
    fillForm(null);
    markDirty();
    renderList(station.id);

    if (error instanceof MissingKeyError) toast('Stanica je sačuvana. Logo čeka upload dok ne podesiš servis za slike.', 'err');
    else if (error) toast('Stanica je sačuvana, ali upload logoa nije uspeo: ' + describeUploadError(error), 'err');
    else toast((editing ? 'Izmenjeno: ' : 'Dodato: ') + name);
    els.fName.focus({ preventScroll: true });
  } finally {
    state.busy = false;
    els.btnSubmit.disabled = false;
    setLabel(els.btnSubmit, state.selectedId ? 'Sačuvaj izmene' : 'Dodaj stanicu');
  }
}

function deleteSelected() {
  if (state.busy) return;
  const i = state.stations.findIndex(s => s.id === state.selectedId);
  if (i < 0) return;
  const [removed] = state.stations.splice(i, 1);
  state.selectedId = null;
  fillForm(null);
  markDirty();
  renderList();
  toast('Obrisano: ' + removed.name);
}

export function initForm() {
  els.form.addEventListener('submit', onSubmit);
  for (const input of [els.fName, els.fUrl]) {
    input.addEventListener('input', () => markInvalid(input, false));
  }
  els.btnCancel.addEventListener('click', deselect);
  resetDeleteButton = confirmButton(els.btnDel, 'Potvrdi brisanje', deleteSelected);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.selectedId && !els.dlg.open && !e.defaultPrevented) deselect();
  });
}
