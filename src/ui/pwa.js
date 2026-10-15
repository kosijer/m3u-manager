import { openSection } from './accordion.js';
import { els, toast } from './dom.js';
import { deselect } from './form.js';
import { importFiles } from './playlist.js';

/**
 * Instalacija kao aplikacija (PWA): service worker za rad bez interneta, dugme "Instaliraj",
 * otvaranje .m3u fajlova iz sistema i prijem linka iz menija "Podeli" (Android).
 */

let installPrompt = null;

function initInstall() {
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    els.btnInstall.hidden = false;
  });
  addEventListener('appinstalled', () => {
    installPrompt = null;
    els.btnInstall.hidden = true;
    toast('M3U Studio je instaliran kao aplikacija.');
  });
  els.btnInstall.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') els.btnInstall.hidden = true;
    installPrompt = null;
  });
}

/** Fajlovi otvoreni dvoklikom ili sa "Otvori pomoću" (manifest: file_handlers). */
function initFileLaunch() {
  if (!('launchQueue' in window)) return;
  window.launchQueue.setConsumer(async params => {
    if (!params.files?.length) return;
    importFiles(await Promise.all(params.files.map(h => h.getFile())));
  });
}

/** Link podeljen iz druge aplikacije (manifest: share_target) ide u formu za novu stanicu. */
function receiveShare() {
  const q = new URLSearchParams(location.search);
  if (!q.has('url') && !q.has('text')) return;
  history.replaceState(null, '', location.pathname);
  const link = [q.get('url'), q.get('text')].map(v => /https?:\/\/\S+/i.exec(v || '')?.[0]).find(Boolean);
  if (!link) { toast('U podeljenom sadržaju nema linka.', 'err'); return; }
  deselect();
  els.fUrl.value = link;
  els.fName.value = q.get('title') || '';
  openSection('form');
  els.fName.focus();
  toast('Link je ubačen u formu. Dopuni naziv i dodaj stanicu.');
}

export function initPwa() {
  initInstall();
  initFileLaunch();
  receiveShare();
  // U razvoju (npm run dev) bez keša, da se izmene odmah vide.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}
