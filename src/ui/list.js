import { findAnyStation, findStation, moveStation, state } from '../state.js';
import { foldText, initials } from '../lib/text.js';
import { onPlayerChange, playerState, stop as stopPlayer, toggle as togglePlayer } from '../services/player.js';
import { els, loadThumb, toast } from './dom.js';
import { selectStation } from './form.js';
import { pauseIcon, playIcon } from './icons.js';
import { renderNowPlaying } from './now-playing.js';
import { markDirty, updateUI } from './status.js';
import { isUploading, retryUpload } from './uploads.js';

const GRIP_SVG = '<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="3" cy="15" r="1.5"/><circle cx="9" cy="15" r="1.5"/></svg>';
const PLAY_PAUSE_SVG = playIcon(14) + pauseIcon(13);

/** Tekući upit pretrage; ne menja redosled u plejlisti, samo šta se vidi. */
let query = '';

export function clearListSearch() {
  query = '';
  if (els.listSearch) els.listSearch.value = '';
}

function matches(s, q) {
  return !q || foldText(s.name).includes(q) || foldText(s.url).includes(q);
}

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

function rowEl(s, index, pad, flashId, filterOn) {
  const selected = s.id === state.selectedId;
  const li = el('li', 'row' + (selected ? ' sel' : '') + (s.id === flashId ? ' flash' : ''));
  li.dataset.id = s.id;

  const grip = el('button', 'grip');
  grip.type = 'button';
  grip.innerHTML = GRIP_SVG;
  // Dok traje pretraga, redosled se ne menja prevlačenjem (lista nije cela).
  if (filterOn) {
    grip.disabled = true;
    grip.title = 'Isključi pretragu da promeniš mesto';
  } else {
    grip.title = 'Prevuci da promeniš mesto';
    grip.setAttribute('aria-label', 'Premesti stanicu ' + s.name + ' (strelice gore i dole)');
  }

  const main = el('button', 'rowmain');
  main.type = 'button';
  main.title = 'Izmeni stanicu';
  main.setAttribute('aria-pressed', String(selected));
  const info = el('div');
  info.append(el('div', 'nm', s.name), el('div', 'u', s.url));
  main.append(thumbEl(s), info);

  const actions = el('div', 'rowact');
  if (s.pending) {
    const flag = el('button', 'flag retry', isUploading(s.id) ? 'Šaljem…' : 'Upload ↻');
    flag.type = 'button';
    flag.disabled = isUploading(s.id);
    flag.title = 'Logo još nije uploadovan. Klikni da pokušaš ponovo.';
    actions.append(flag);
  }
  const play = el('button', 'play');
  play.type = 'button';
  play.innerHTML = PLAY_PAUSE_SVG;
  setPlayButton(play, s, playerState());
  actions.append(play);

  li.append(grip, el('span', 'num', String(index + 1).padStart(pad, '0')), main, actions);
  return li;
}

function setPlayButton(btn, station, player) {
  const mine = player.id === station.id;
  const st = mine ? player.status : 'idle';
  btn.dataset.state = st;
  btn.setAttribute('aria-pressed', String(mine));
  const label = st === 'idle' ? 'Preslušaj ' : st === 'loading' ? 'Učitavam, klikni da prekineš: ' : 'Zaustavi ';
  btn.setAttribute('aria-label', label + station.name);
  btn.title = st === 'idle' ? 'Preslušaj stanicu' : 'Zaustavi';
}

function updatePlayButtons(player) {
  for (const li of els.list.children) {
    const s = findStation(li.dataset.id);
    const btn = li.querySelector('.play');
    if (s && btn) setPlayButton(btn, s, player);
  }
}

/** Zaustavlja preslušavanje ako je stanica obrisana ili joj je promenjen link (u bilo kom tabu). */
function syncPlayer() {
  const p = playerState();
  if (!p.id) return;
  const s = findAnyStation(p.id);
  if (!s || s.url !== p.url) stopPlayer();
}

export function renderList(flashId) {
  syncPlayer();
  const ul = els.list;
  const q = foldText(query.trim());
  const filterOn = !!q;
  const shown = filterOn
    ? state.stations.map((s, i) => [s, i]).filter(([s]) => matches(s, q))
    : state.stations.map((s, i) => [s, i]);
  const pad = Math.max(2, String(state.stations.length).length);
  ul.replaceChildren(...shown.map(([s, i]) => rowEl(s, i, pad, flashId, filterOn)));

  const empty = state.stations.length === 0;
  const noMatch = !empty && filterOn && !shown.length;
  ul.hidden = empty || noMatch;
  els.empty.hidden = !empty && !noMatch;
  if (empty) {
    els.empty.querySelector('h3').textContent = 'Plejlista je prazna';
    els.empty.querySelector('p').textContent = 'Dodaj prvu stanicu sa leve strane, ili uvezi postojeći .m3u fajl da nastaviš odatle. Fajl možeš i da prevučeš na ovaj panel.';
    els.btnEmptyImport.hidden = false;
  } else if (noMatch) {
    els.empty.querySelector('h3').textContent = 'Nema rezultata';
    els.empty.querySelector('p').textContent = `Nijedna stanica ne sadrži „${query.trim()}”.`;
    els.btnEmptyImport.hidden = true;
  }

  if (flashId) ul.querySelector('.flash')?.scrollIntoView({ block: 'nearest' });
  updateUI();
  renderNowPlaying();
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
  els.listSearch.addEventListener('input', () => {
    query = els.listSearch.value;
    renderList();
  });

  els.list.addEventListener('click', e => {
    const retry = e.target.closest('.retry');
    if (retry) { retryUpload(retry.closest('.row').dataset.id); return; }
    const play = e.target.closest('.play');
    if (play) {
      const s = findStation(play.closest('.row').dataset.id);
      if (s) togglePlayer(s.id, s.url);
      return;
    }
    const main = e.target.closest('.rowmain');
    if (main) selectStation(main.closest('.row').dataset.id);
  });

  els.list.addEventListener('keydown', e => {
    const grip = e.target.closest('.grip');
    if (!grip || grip.disabled || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
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
    if (grip && !grip.disabled) startDrag(e, grip.closest('.row'));
  });

  onPlayerChange(e => {
    updatePlayButtons(e);
    if (e.error) {
      const s = findAnyStation(e.failedId);
      toast((s ? s.name + ': ' : '') + e.error, 'err');
    }
  });
}
