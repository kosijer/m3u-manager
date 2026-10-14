import { initials } from '../lib/text.js';
import { findStation, state } from '../state.js';
import { onPlayerChange, play, playerState, stop, toggle } from '../services/player.js';
import { els, loadThumb } from './dom.js';
import { nextIcon, pauseIcon, playIcon, prevIcon } from './icons.js';

/**
 * Veliki pregled ispod forme. Prikazuje stanicu koja svira; dok ništa ne svira,
 * stanicu izabranu u listi (ili prvu u listi).
 */
let currentId = null;
let artKey = null;
let metaKey = null;
let flashTimer;

function currentStation() {
  let s = findStation(currentId);
  if (!s) {
    s = state.stations[0] ?? null;
    currentId = s?.id ?? null;
  }
  return s;
}

/** Prikazuje stanicu u pregledu, osim ako trenutno svira neka druga. */
export function previewStation(id) {
  if (playerState().id) return;
  currentId = id;
  renderNowPlaying();
}

export function playPause() {
  const s = currentStation();
  if (s) toggle(s.id, s.url);
}

/** Prelazi na susednu stanicu (u krug). Ako je nešto sviralo, odmah pušta novu. */
function step(dir) {
  const n = state.stations.length;
  if (!n) return;
  const i = state.stations.indexOf(currentStation());
  const next = state.stations[(i + dir + n) % n];
  currentId = next.id;
  if (playerState().id) play(next.id, next.url);
  renderNowPlaying();
}

export const nextStation = () => step(1);
export const prevStation = () => step(-1);

function renderArt(s) {
  const src = s ? s.pending || s.logo : '';
  const key = s ? `${s.id}|${src}|${s.name}` : '';
  if (key === artKey) return;
  artKey = key;
  const art = els.npArt;
  art.textContent = '';
  art.className = 'np-art';
  if (!s) {
    art.classList.add('ph', 'none');
    art.textContent = 'Dodaj stanicu ili uvezi .m3u da bi je preslušao ovde.';
    return;
  }
  const placeholder = () => { art.classList.add('ph'); art.textContent = initials(s.name); };
  if (src) loadThumb(art, src, placeholder);
  else placeholder();
}

function updateMediaSession(s, status) {
  const ms = navigator.mediaSession;
  if (!ms) return;
  ms.playbackState = status === 'idle' ? 'paused' : 'playing';
  const art = s ? s.logo || s.pending : '';
  const key = s ? `${s.name}|${art}` : '';
  if (status === 'idle' || key === metaKey) return;
  metaKey = key;
  ms.metadata = new MediaMetadata({ title: s.name, artist: 'M3U Studio', artwork: art ? [{ src: art }] : [] });
}

export function renderNowPlaying() {
  const s = currentStation();
  const p = playerState();
  const status = s && p.id === s.id ? p.status : 'idle';
  const n = state.stations.length;

  els.np.classList.toggle('empty', !s);
  renderArt(s);

  els.npPlay.dataset.state = status;
  const action = status === 'idle' ? 'Pusti' : 'Zaustavi';
  els.npPlay.setAttribute('aria-label', s ? `${action} ${s.name}` : action);
  els.npPlay.title = `${action} (razmak)`;
  els.npPrev.disabled = els.npNext.disabled = n < 2;

  els.npStatus.classList.toggle('live', status === 'playing');
  els.npStatus.textContent = !s ? ''
    : status === 'playing' ? 'Uživo'
    : status === 'loading' ? 'Učitavam…'
    : `Stanica ${state.stations.indexOf(s) + 1} od ${n}`;
  els.npName.textContent = s?.name ?? '';
  els.npUrl.textContent = s?.url ?? '';

  updateMediaSession(s, status);
}

/** Kratko pokaže kontrole preko slike (kad se koristi tastatura). */
function flashControls() {
  els.npCover.classList.add('show-ctl');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => els.npCover.classList.remove('show-ctl'), 1200);
}

const KEY_ACTIONS = {
  ' ': playPause,
  MediaPlayPause: playPause,
  ArrowRight: nextStation,
  MediaTrackNext: nextStation,
  ArrowLeft: prevStation,
  MediaTrackPrevious: prevStation,
};

function onKeydown(e) {
  const action = KEY_ACTIONS[e.key];
  if (!action || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || els.dlg.open) return;
  const t = e.target;
  if (t.closest?.('input, textarea, select, [contenteditable]')) return;
  // Dugme fokusirano tastaturom zadržava svoje ponašanje (razmak ga aktivira).
  if (e.key === ' ' && t.closest?.('button, a, summary, [role=button]') && t.matches(':focus-visible')) return;
  if (!state.stations.length) return;
  e.preventDefault();
  action();
  flashControls();
}

export function initNowPlaying() {
  els.npPrev.innerHTML = prevIcon(20);
  els.npNext.innerHTML = nextIcon(20);
  els.npPlay.innerHTML = playIcon(28) + pauseIcon(26);
  els.npPlay.addEventListener('click', playPause);
  els.npPrev.addEventListener('click', prevStation);
  els.npNext.addEventListener('click', nextStation);
  document.addEventListener('keydown', onKeydown);

  onPlayerChange(e => {
    if (e.id) currentId = e.id;
    renderNowPlaying();
  });

  // Multimedijalni tasteri na tastaturi i kontrole operativnog sistema.
  const ms = navigator.mediaSession;
  if (ms) {
    const handlers = {
      play: () => { const s = currentStation(); if (s && !playerState().id) play(s.id, s.url); },
      pause: stop,
      stop,
      nexttrack: nextStation,
      previoustrack: prevStation,
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { ms.setActionHandler(action, handler); } catch { /* browser ne podržava tu akciju */ }
    }
  }
}
