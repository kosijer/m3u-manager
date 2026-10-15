import { downloadBlob } from '../lib/blob.js';
import { parseM3U } from '../lib/m3u.js';
import { cleanFilename, formatCount } from '../lib/text.js';
import { addPlaylist, pendingCount, serialize, state } from '../state.js';
import { els, toast } from './dom.js';
import { fillForm } from './form.js';
import { showView } from './history.js';
import { renderList } from './list.js';
import { busyGuard, draftFailed, persistDraft, schedulePersist, updateUI } from './status.js';
import { renderTabs } from './tabs.js';
import { uploadAllPending } from './uploads.js';

/** Uvezen fajl koji čeka odluku "Novi tab" / "Zameni listu" / "Dodaj na kraj". */
let pendingImport = null;

function hideBars() {
  els.importBar.hidden = true;
  els.saveWarn.hidden = true;
  pendingImport = null;
}

/** Prikazuje aktivnu plejlistu iz početka (posle promene taba). */
export function showPlaylist() {
  els.fFile.value = state.filename;
  hideBars();
  showView('playlist');
  fillForm(null);
  renderList();
  persistDraft();
}

async function readPlaylist(file) {
  if (file.type.startsWith('image/')) { toast('Ovde ide .m3u fajl. Slike prevuci u polje za logo.', 'err'); return null; }
  let text;
  try { text = await file.text(); } catch { toast('Fajl nije moguće pročitati: ' + file.name, 'err'); return null; }
  const result = parseM3U(text);
  if (!result.stations.length) { toast('U fajlu nema nijedne stanice: ' + file.name, 'err'); return null; }
  return result;
}

/** Jedan fajl pita šta da radi sa njim; više fajlova se otvara svaki u svom tabu. */
export async function importFiles(files) {
  const list = [...files];
  if (list.length === 1) { importFile(list[0]); return; }
  for (const file of list) {
    const result = await readPlaylist(file);
    if (result) applyImport(result, file.name, state.stations.length ? 'tab' : 'replace');
  }
}

async function importFile(file) {
  const result = await readPlaylist(file);
  if (!result) return;
  showView('playlist');
  if (state.stations.length) {
    pendingImport = { result, name: file.name };
    els.importText.textContent = `${file.name}: ${formatCount(result.stations.length)}. Šta da uradim sa njima?`;
    els.importBar.hidden = false;
  } else {
    applyImport(result, file.name, 'replace');
  }
}

const IMPORT_DONE = { tab: 'Otvoreno u novom tabu: ', replace: 'Uvezeno: ', append: 'Dodato na kraj: ' };

function applyImport(result, name, mode) {
  if (busyGuard()) return;
  if (mode === 'tab') {
    addPlaylist({ stations: result.stations, header: result.header, filename: name });
  } else if (mode === 'replace') {
    Object.assign(state, { stations: result.stations, header: result.header, filename: name, dirty: false });
  } else {
    state.stations.push(...result.stations);
    state.dirty = true;
  }
  state.selectedId = null;
  showPlaylist();
  toast(IMPORT_DONE[mode] + formatCount(result.stations.length));
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
    importFiles(e.dataTransfer.files);
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
    importFiles(els.importInput.files);
    els.importInput.value = '';
  });
  for (const [btn, mode] of [[els.btnImpTab, 'tab'], [els.btnImpReplace, 'replace'], [els.btnImpAppend, 'append']]) {
    btn.addEventListener('click', () => pendingImport && applyImport(pendingImport.result, pendingImport.name, mode));
  }
  els.btnImpCancel.addEventListener('click', () => { pendingImport = null; els.importBar.hidden = true; });
  initFileDrop();

  els.fFile.addEventListener('input', () => {
    state.filename = els.fFile.value;
    renderTabs();
    schedulePersist();
  });

  els.btnSave.addEventListener('click', onSaveClick);
  els.btnWarnUpload.addEventListener('click', async () => {
    els.btnWarnUpload.disabled = true;
    try { if (await uploadAllPending()) savePlaylist(); } finally { els.btnWarnUpload.disabled = false; }
  });
  els.btnWarnSkip.addEventListener('click', savePlaylist);
  els.btnWarnCancel.addEventListener('click', () => { els.saveWarn.hidden = true; });
  els.btnCopy.addEventListener('click', copyPlaylist);

  addEventListener('beforeunload', e => {
    persistDraft();
    if (state.dirty && state.stations.length && draftFailed()) { e.preventDefault(); e.returnValue = ''; }
  });
}
