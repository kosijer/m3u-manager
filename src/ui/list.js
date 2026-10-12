import { moveStation, state } from '../state.js';
import { initials } from '../lib/text.js';
import { els, loadThumb } from './dom.js';
import { selectStation } from './form.js';
import { markDirty, updateUI } from './status.js';
import { isUploading, retryUpload } from './uploads.js';

const GRIP_SVG = '<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="3" cy="15" r="1.5"/><circle cx="9" cy="15" r="1.5"/></svg>';

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function thumbEl(s) {
  const th = el('span', 'thumb');
  const placeholder = () => { th.textContent = initials(s.name); th.classList.add('ph'); };
  const src = s.pending || s.logo;
  if (src) loadThumb(th, src, placeholder);
  else placeholder();
  return th;
}

function rowEl(s, index, pad, flashId) {
  const selected = s.id === state.selectedId;
  const li = el('li', 'row' + (selected ? ' sel' : '') + (s.id === flashId ? ' flash' : ''));
  li.dataset.id = s.id;

  const grip = el('button', 'grip');
  grip.type = 'button';
  grip.innerHTML = GRIP_SVG;
  grip.title = 'Prevuci da promeniš mesto';
  grip.setAttribute('aria-label', 'Premesti stanicu ' + s.name + ' (strelice gore i dole)');

  const main = el('button', 'rowmain');
  main.type = 'button';
  main.title = 'Izmeni stanicu';
  main.setAttribute('aria-pressed', String(selected));
  const info = el('div');
  info.append(el('div', 'nm', s.name), el('div', 'u', s.url));
  main.append(thumbEl(s), info);

  li.append(grip, el('span', 'num', String(index + 1).padStart(pad, '0')), main);

  if (s.pending) {
    const flag = el('button', 'flag retry', isUploading(s.id) ? 'Šaljem…' : 'Upload ↻');
    flag.type = 'button';
    flag.disabled = isUploading(s.id);
    flag.title = 'Logo još nije uploadovan. Klikni da pokušaš ponovo.';
    li.append(flag);
  }
  return li;
}

export function renderList(flashId) {
  const ul = els.list;
  const pad = Math.max(2, String(state.stations.length).length);
  ul.replaceChildren(...state.stations.map((s, i) => rowEl(s, i, pad, flashId)));
  const none = state.stations.length === 0;
  ul.hidden = none;
  els.empty.hidden = !none;
  if (flashId) ul.querySelector('.flash')?.scrollIntoView({ block: 'nearest' });
  updateUI();
}

export function markSelected() {
  for (const li of els.list.children) {
    const on = li.dataset.id === state.selectedId;
    li.classList.toggle('sel', on);
    li.querySelector('.rowmain').setAttribute('aria-pressed', String(on));
  }
}

/* ---------- promena redosleda prevlačenjem (miš i touch) ---------- */

function startDrag(e, li) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const list = els.list;
  const rows = [...list.children];
  const n = rows.length;
  if (n < 2) return;
  e.preventDefault();

  const from = rows.indexOf(li);
  const step = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
  const scroller = getComputedStyle(els.listwrap).overflowY === 'auto' ? els.listwrap : null;
  const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);
  const startY = e.clientY;
  const startScroll = scrollTop();
  let y = e.clientY, to = from, raf = 0;

  list.classList.add('is-dragging');
  li.classList.add('dragging');

  const apply = () => {
    const dy = (y - startY) + (scrollTop() - startScroll);
    li.style.transform = `translateY(${dy}px)`;
    to = Math.max(0, Math.min(n - 1, Math.round(from + dy / step)));
    rows.forEach((r, i) => {
      if (r === li) return;
      let t = 0;
      if (from < to && i > from && i <= to) t = -step;
      else if (from > to && i < from && i >= to) t = step;
      r.style.transform = t ? `translateY(${t}px)` : '';
    });
  };

  // Automatsko skrolovanje kad je pokazivač blizu ivice liste.
  const tick = () => {
    const r = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    const edge = 56;
    let v = 0;
    if (y < r.top + edge) v = -Math.ceil((r.top + edge - y) / 6);
    else if (y > r.bottom - edge) v = Math.ceil((y - (r.bottom - edge)) / 6);
    if (v) {
      if (scroller) scroller.scrollTop += v; else window.scrollBy(0, v);
      apply();
    }
    raf = requestAnimationFrame(tick);
  };

  const move = ev => { y = ev.clientY; apply(); };
  const end = () => {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', end);
    removeEventListener('pointercancel', end);
    rows.forEach(r => { r.style.transform = ''; });
    li.classList.remove('dragging');
    list.classList.remove('is-dragging');
    // Lista je mogla da se promeni tokom prevlačenja (npr. završen upload), pa se pomera po id-ju.
    const id = li.dataset.id;
    const cur = state.stations.findIndex(s => s.id === id);
    if (to !== from && cur === from) {
      moveStation(from, to);
      markDirty();
      renderList(id);
    }
  };

  addEventListener('pointermove', move);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  raf = requestAnimationFrame(tick);
  apply();
}

export function initList() {
  els.list.addEventListener('click', e => {
    const retry = e.target.closest('.retry');
    if (retry) { retryUpload(retry.closest('.row').dataset.id); return; }
    const main = e.target.closest('.rowmain');
    if (main) selectStation(main.closest('.row').dataset.id);
  });

  els.list.addEventListener('keydown', e => {
    const grip = e.target.closest('.grip');
    if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const id = grip.closest('.row').dataset.id;
    const i = state.stations.findIndex(s => s.id === id);
    const j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= state.stations.length) return;
    moveStation(i, j);
    markDirty();
    renderList();
    els.list.children[j].querySelector('.grip').focus();
  });

  els.list.addEventListener('pointerdown', e => {
    const grip = e.target.closest('.grip');
    if (grip) startDrag(e, grip.closest('.row'));
  });
}
