import { LOGO_SIZE } from '../config.js';
import { dataUrlToBlob, downloadBlob } from '../lib/blob.js';
import { slugify } from '../lib/text.js';
import { selectedStation } from '../state.js';
import { openSection } from './accordion.js';
import { els, loadThumb, toast } from './dom.js';

const MAX_ZOOM = 4;
const LOGO_PLACEHOLDER = 'Link logotipa (https://…)';

/**
 * cx, cy: centar slike u odnosu na okvir (0..1). z: zum, gde 1 znači da kraća strana slike popunjava okvir,
 * a zmin da cela slika staje u okvir.
 */
const crop = { active: false, img: null, w: 1, h: 1, z: 1, zmin: 1, cx: 0.5, cy: 0.5, bg: 'transparent', objUrl: null, prevLogo: '' };
let pan = null;

export const isCropActive = () => crop.active;

function drawCrop(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  if (crop.bg !== 'transparent') {
    ctx.fillStyle = crop.bg === 'white' ? '#fff' : '#000';
    ctx.fillRect(0, 0, size, size);
  }
  const m = Math.max(1 / crop.w, 1 / crop.h);
  const dw = crop.w * m * crop.z * size, dh = crop.h * m * crop.z * size;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(crop.img, crop.cx * size - dw / 2, crop.cy * size - dh / 2, dw, dh);
}

function drawPreview() {
  if (crop.active) drawCrop(els.cv.getContext('2d'), els.cv.width);
}

/** Ne dozvoljava da slika izađe iz okvira (ili da manja slika pređe ivicu okvira). */
function clampCrop() {
  const m = Math.max(1 / crop.w, 1 / crop.h);
  const fw = crop.w * m * crop.z, fh = crop.h * m * crop.z;
  const clamp = (c, f) => (f >= 1
    ? Math.min(f / 2, Math.max(1 - f / 2, c))
    : Math.min(1 - f / 2, Math.max(f / 2, c)));
  crop.cx = clamp(crop.cx, fw);
  crop.cy = clamp(crop.cy, fh);
}

function setZoom(z) {
  crop.z = Math.min(MAX_ZOOM, Math.max(crop.zmin, z));
  els.zoom.value = String(crop.z);
  clampCrop();
  drawPreview();
}

function showCropper(on) {
  els.dz.hidden = on;
  els.cropper.hidden = !on;
  els.fLogo.disabled = on;
  els.btnLoadLogo.disabled = on;
  if (on) {
    crop.prevLogo = els.fLogo.value;
    els.fLogo.value = '';
    els.fLogo.placeholder = 'Link logotipa: popuniće se posle uploada';
  } else {
    if (crop.prevLogo) els.fLogo.value = crop.prevLogo;
    crop.prevLogo = '';
    els.fLogo.placeholder = LOGO_PLACEHOLDER;
  }
  updateLogoThumb();
}

export function clearCrop() {
  if (!crop.active) return;
  crop.active = false;
  crop.img = null;
  if (crop.objUrl) { URL.revokeObjectURL(crop.objUrl); crop.objUrl = null; }
  showCropper(false);
}

function loadIntoCropper(src, { cors = false, objectUrl = false } = {}) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.referrerPolicy = 'no-referrer';
    im.onload = () => {
      const w = im.naturalWidth || LOGO_SIZE, h = im.naturalHeight || LOGO_SIZE;
      const wasActive = crop.active;
      if (crop.objUrl) URL.revokeObjectURL(crop.objUrl);
      crop.objUrl = objectUrl ? src : null;
      const fit = Math.min(w, h) / Math.max(w, h);
      Object.assign(crop, { active: true, img: im, w, h, cx: 0.5, cy: 0.5, zmin: fit, z: fit });
      els.zoom.min = String(fit);
      els.zoom.value = String(fit);
      if (!wasActive) showCropper(true);
      openSection('form');
      drawPreview();
      resolve();
    };
    im.onerror = () => reject(new Error('LOAD'));
    im.src = src;
  });
}

function takeImageFile(file) {
  if (!file || !file.type.startsWith('image/')) { toast('To nije slika.', 'err'); return; }
  const url = URL.createObjectURL(file);
  loadIntoCropper(url, { objectUrl: true }).catch(() => {
    URL.revokeObjectURL(url);
    toast('Ovu sliku nije moguće učitati.', 'err');
  });
}

async function loadLogoFromUrl(url) {
  url = url.trim();
  if (!url) return;
  els.btnLoadLogo.disabled = true;
  try {
    await loadIntoCropper(url, { cors: true });
  } catch {
    toast('Taj sajt ne dozvoljava da se slika učita u pregledač. Sačuvaj je na računar i prevuci je u polje za logo. Link možeš i da ostaviš ovakav kakav jeste.', 'err');
  } finally {
    els.btnLoadLogo.disabled = crop.active;
  }
}

/** @returns {Promise<{ blob: Blob, dataUrl: string }>} PNG LOGO_SIZE x LOGO_SIZE */
export function exportCrop() {
  const c = document.createElement('canvas');
  c.width = c.height = LOGO_SIZE;
  drawCrop(c.getContext('2d'), LOGO_SIZE);
  const dataUrl = c.toDataURL('image/png');
  return new Promise(resolve => c.toBlob(b => resolve({ blob: b || dataUrlToBlob(dataUrl), dataUrl }), 'image/png'));
}

/** Mala sličica pored polja "Link logotipa". */
export function updateLogoThumb() {
  const t = els.lthumb;
  t.textContent = '';
  const sel = selectedStation();
  const link = els.fLogo.value.trim();
  const src = sel?.pending && (!link || link === sel.logo) ? sel.pending : link;
  if (!src) { t.textContent = 'logo'; return; }
  loadThumb(t, src, () => { t.textContent = '?'; });
}

function handleImageDrop(e) {
  e.preventDefault();
  els.dz.classList.remove('over');
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (file) { takeImageFile(file); return; }
  const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').split('\n')[0].trim();
  if (/^https?:\/\//i.test(url)) loadLogoFromUrl(url);
  else toast('Prevuci sliku ili klikni da je izabereš.', 'err');
}

export function initCropper() {
  const cv = els.cv;
  cv.width = cv.height = LOGO_SIZE;
  els.cropSize.textContent = `${LOGO_SIZE} × ${LOGO_SIZE}`;
  cv.addEventListener('pointerdown', e => {
    if (!crop.active) return;
    cv.setPointerCapture(e.pointerId);
    pan = { x: e.clientX, y: e.clientY };
    els.stageBox.classList.add('grab');
  });
  cv.addEventListener('pointermove', e => {
    if (!pan) return;
    const r = cv.getBoundingClientRect();
    crop.cx += (e.clientX - pan.x) / r.width;
    crop.cy += (e.clientY - pan.y) / r.height;
    pan = { x: e.clientX, y: e.clientY };
    clampCrop();
    drawPreview();
  });
  for (const type of ['pointerup', 'pointercancel']) {
    cv.addEventListener(type, () => { pan = null; els.stageBox.classList.remove('grab'); });
  }
  cv.addEventListener('wheel', e => {
    if (!crop.active) return;
    e.preventDefault();
    setZoom(crop.z * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  els.zoom.addEventListener('input', () => setZoom(parseFloat(els.zoom.value)));
  els.btnFit.addEventListener('click', () => { crop.cx = crop.cy = 0.5; setZoom(crop.zmin); });
  els.btnFill.addEventListener('click', () => { crop.cx = crop.cy = 0.5; setZoom(1); });
  els.bgSel.addEventListener('click', e => {
    const b = e.target.closest('button[data-bg]');
    if (!b) return;
    crop.bg = b.dataset.bg;
    els.bgSel.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    drawPreview();
  });

  els.btnRemoveImg.addEventListener('click', clearCrop);
  els.btnDlPng.addEventListener('click', async () => {
    if (!crop.active) return;
    const out = await exportCrop();
    downloadBlob(out.blob, `${slugify(els.fName.value.trim())}-${LOGO_SIZE}.png`);
  });
  els.btnLoadLogo.addEventListener('click', () => loadLogoFromUrl(els.fLogo.value));
  els.fLogo.addEventListener('change', updateLogoThumb);

  for (const zone of [els.dz, els.cropper]) {
    zone.addEventListener('dragenter', e => { e.preventDefault(); els.dz.classList.add('over'); });
    zone.addEventListener('dragover', e => { e.preventDefault(); els.dz.classList.add('over'); });
    zone.addEventListener('dragleave', () => els.dz.classList.remove('over'));
    zone.addEventListener('drop', handleImageDrop);
  }
  els.dz.addEventListener('click', () => els.logoInput.click());
  els.dz.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.logoInput.click(); }
  });
  els.logoInput.addEventListener('change', () => {
    takeImageFile(els.logoInput.files[0]);
    els.logoInput.value = '';
  });

  document.addEventListener('paste', e => {
    if (els.dlg.open) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (item) { e.preventDefault(); takeImageFile(item.getAsFile()); }
  });
}
