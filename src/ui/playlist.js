import { downloadBlob } from '../lib/blob.js';
import { parseM3U } from '../lib/m3u.js';
import { cleanFilename, formatCount } from '../lib/text.js';
import { pendingCount, resetPlaylist, serialize, state } from '../state.js';
import { confirmButton, els, toast } from './dom.js';
import { fillForm } from './form.js';
import { showView } from './history.js';
import { renderList } from './list.js';
import { persistDraft, updateUI } from './status.js';
import { uploadAllPending } from './uploads.js';

/** Uvezen fajl koji čeka odluku "Zameni listu" / "Dodaj na kraj". */
let pendingImport = null;

function busyGuard() {
  if (!state.busy) return false;
  toast('Sačekaj da se završi slanje loga.', 'err');
  return true;
}

function hideBars() {
  els.importBar.hidden = true;
  els.saveWarn.hidden = true;
  pendingImport = null;
}

async function importFile(file) {
  if (file.type.startsWith('image/')) { toast('Ovde ide .m3u fajl. Slike prevuci u polje za logo.', 'err'); return; }
  let text;
  try { text = await file.text(); } catch { toast('Fajl nije moguće pročitati.', 'err'); return; }
  const result = parseM3U(text);
  if (!result.stations.length) { toast('U fajlu nema nijedne stanice.', 'err'); return; }
  showView('playlist');
  if (state.stations.length) {
    pendingImport = { result, name: file.name };
    els.importText.textContent = `${file.name}: ${formatCount(result.stations.length)}. Šta da uradim sa njima?`;
    els.importBar.hidden = false;
  } else {
    applyImport(result, file.name, 'replace');
  }
}

function applyImport(result, name, mode) {
  if (busyGuard()) return;
  if (mode === 'replace') {
    Object.assign(state, { stations: result.stations, header: result.header, filename: name, dirty: false });
    els.fFile.value = name;
  } else {
    state.stations.push(...result.stations);
    state.dirty = true;
  }
  state.selectedId = null;
  hideBars();
  fillForm(null);
  renderList();
  persistDraft();
  toast((mode === 'replace' ? 'Uvezeno: ' : 'Dodato na kraj: ') + formatCount(result.stations.length));
}

function savePlaylist() {
  const name = cleanFilename(state.filename);
  state.filename = name;
  els.fFile.value = name;
  downloadBlob(new Blob([serialize()], { type: 'audio/x-mpegurl;charset=utf-8' }), name);
  state.dirty = false;
  persistDraft();
  updateUI();
  els.saveWarn.hidden = true;
  toast('Sačuvano kao ' + name);
}

function onSaveClick() {
  const p = pendingCount();
  if (!p) { savePlaylist(); return; }
  showView('playlist');
  els.saveWarnText.textContent = p === 1
    ? '1 logo još nije uploadovan. Bez uploada neće biti u fajlu.'
    : `${p} logotipa još nije uploadovano. Bez uploada neće biti u fajlu.`;
  els.saveWarn.hidden = false;
}

async function copyPlaylist() {
  const text = serialize();
  try {
    await navigator.clipboard.writeText(text);
    toast('M3U tekst je kopiran.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* stari browseri */ }
    ta.remove();
    toast(ok ? 'M3U tekst je kopiran.' : 'Kopiranje nije uspelo.', ok ? undefined : 'err');
  }
}

function newPlaylist() {
  if (busyGuard()) return;
  resetPlaylist();
  els.fFile.value = state.filename;
  hideBars();
  fillForm(null);
  renderList();
  persistDraft();
}

function initFileDrop() {
  const panel = els.rightPanel;
  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  panel.addEventListener('dragenter', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    panel.classList.add('dropping');
  });
  panel.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  panel.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) panel.classList.remove('dropping');
  });
  panel.addEventListener('drop', e => {
    e.preventDefault();
    depth = 0;
    panel.classList.remove('dropping');
    const file = e.dataTransfer.files[0];
    if (file) importFile(file);
  });
  // Fajl pušten van zona za prevlačenje ne sme da otvori novu stranicu.
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => e.preventDefault());
}

export function initPlaylist() {
  const pickFile = () => els.importInput.click();
  els.btnImport.addEventListener('click', pickFile);
  els.btnEmptyImport.addEventListener('click', pickFile);
  els.importInput.addEventListener('change', () => {
    const file = els.importInput.files[0];
    if (file) importFile(file);
    els.importInput.value = '';
  });
  els.btnImpReplace.addEventListener('click', () => pendingImport && applyImport(pendingImport.result, pendingImport.name, 'replace'));
  els.btnImpAppend.addEventListener('click', () => pendingImport && applyImport(pendingImport.result, pendingImport.name, 'append'));
  els.btnImpCancel.addEventListener('click', () => { pendingImport = null; els.importBar.hidden = true; });
  initFileDrop();

  confirmButton(els.btnNew, 'Obrisati sve?', newPlaylist);
  els.fFile.addEventListener('input', () => { state.filename = els.fFile.value; });

  els.btnSave.addEventListener('click', onSaveClick);
  els.btnWarnUpload.addEventListener('click', async () => {
    els.btnWarnUpload.disabled = true;
    try { if (await uploadAllPending()) savePlaylist(); } finally { els.btnWarnUpload.disabled = false; }
  });
  els.btnWarnSkip.addEventListener('click', savePlaylist);
  els.btnWarnCancel.addEventListener('click', () => { els.saveWarn.hidden = true; });
  els.btnCopy.addEventListener('click', copyPlaylist);

  addEventListener('beforeunload', e => {
    if (state.dirty && state.stations.length) { e.preventDefault(); e.returnValue = ''; }
  });
}
