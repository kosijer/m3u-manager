import { initials } from '../lib/text.js';
import { findAnyStation, findStation, state } from '../state.js';
import { onPlayerChange, play, playerState, stop, toggle, videoElement } from '../services/player.js';
import { currentTrack, onTrackChange, watchTrack } from '../services/track.js';
import { openSection } from './accordion.js';
import { els, loadThumb } from './dom.js';
import { enterFullscreenIcon, exitFullscreenIcon, nextIcon, pauseIcon, playIcon, prevIcon } from './icons.js';

/**
 * Veliki pregled ispod forme. Prikazuje stanicu koja svira; dok ništa ne svira,
 * stanicu izabranu u listi (ili prvu u listi).
 */
let currentId = null;
let artKey = null;
let metaKey = null;
let flashTimer;

function currentStation() {
  // Stanica koja svira može da bude iz drugog taba.
  let s = playerState().id === currentId ? findAnyStation(currentId) : findStation(currentId);
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

function updateMediaSession(s, status, song) {
  const ms = navigator.mediaSession;
  if (!ms) return;
  ms.playbackState = status === 'idle' ? 'paused' : 'playing';
  const art = s ? s.logo || s.pending : '';
  const key = s ? `${s.name}|${art}|${song}` : '';
  if (status === 'idle' || key === metaKey) return;
  metaKey = key;
  ms.metadata = new MediaMetadata({
    title: song || s.name,
    artist: song ? s.name : 'M3U Studio',
    artwork: art ? [{ src: art }] : [],
  });
}

export function renderNowPlaying() {
  const s = currentStation();
  const p = playerState();
  const status = s && p.id === s.id ? p.status : 'idle';
  const n = state.stations.length;

  els.np.classList.toggle('empty', !s);
  renderArt(s);
  els.npCover.classList.toggle('has-video', status !== 'idle' && p.video);

  const action = status === 'idle' ? 'Pusti' : 'Zaustavi';
  for (const btn of [els.npPlay, els.npMiniPlay]) {
    btn.dataset.state = status;
    btn.setAttribute('aria-label', s ? `${action} ${s.name}` : action);
    btn.title = `${action} (razmak)`;
  }
  els.npMiniPlay.hidden = !s;
  els.npPrev.disabled = els.npNext.disabled = n < 2;

  const t = currentTrack();
  const song = s && status === 'playing' && t.id === s.id ? t.title : '';
  els.npStatus.classList.toggle('live', status === 'playing');
  els.npStatus.classList.toggle('song', !!song);
  els.npStatus.textContent = !s ? ''
    : song ? song
    : status === 'playing' ? 'Uživo'
    : status === 'loading' ? 'Učitavam…'
    : `Stanica ${state.stations.indexOf(s) + 1} od ${n}`;
  els.npStatus.title = song;
  els.npName.textContent = s?.name ?? '';
  els.npName.title = s?.url ?? '';
  els.npFsName.textContent = s?.name ?? '';
  els.npFsTrack.textContent = song;

  if (!s && fullscreen) setFullscreenUI(false);
  updateMediaSession(s, status, song);
}

/* ---------- ceo ekran ---------- */

const AWAKE_MS = 2500;
let fullscreen = false;
let awakeTimer;

/** Pokaže kontrole i sakrije ih posle AWAKE_MS bez pomeranja miša (osim dok je miš na dugmetu). */
function wake() {
  els.npCover.classList.add('awake');
  clearTimeout(awakeTimer);
  awakeTimer = setTimeout(() => {
    if (els.npCover.querySelector('.np-btn:hover')) wake();
    else els.npCover.classList.remove('awake');
  }, AWAKE_MS);
}

function setFullscreenUI(on) {
  fullscreen = on;
  els.np.classList.toggle('is-fs', on);
  els.npCover.classList.toggle('is-fs', on);
  els.npFull.innerHTML = on ? exitFullscreenIcon(18) : enterFullscreenIcon(14);
  const label = on ? 'Izađi iz celog ekrana' : 'Ceo ekran';
  els.npFull.setAttribute('aria-label', label);
  els.npFull.title = `${label} (F)`;
  if (on) wake();
  else {
    clearTimeout(awakeTimer);
    els.npCover.classList.remove('awake');
  }
}

export async function toggleFullscreen() {
  if (fullscreen) {
    setFullscreenUI(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    return;
  }
  if (!currentStation()) return;
  openSection('np');
  setFullscreenUI(true);
  // Bez Fullscreen API-ja (npr. iPhone) ostaje prikaz preko celog prozora.
  await document.documentElement.requestFullscreen?.().catch(() => {});
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
  f: toggleFullscreen,
  F: toggleFullscreen,
};

function onKeydown(e) {
  if (e.key === 'Escape' && fullscreen && !document.fullscreenElement) {
    e.preventDefault();
    toggleFullscreen();
    return;
  }
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
  els.npPrev.innerHTML = prevIcon(16);
  els.npNext.innerHTML = nextIcon(16);
  els.npPlay.innerHTML = playIcon(22) + pauseIcon(21);
  els.npMiniPlay.innerHTML = playIcon(14) + pauseIcon(13);
  videoElement.className = 'np-video';
  videoElement.setAttribute('aria-hidden', 'true');
  els.npArt.after(videoElement);
  setFullscreenUI(false);
  els.npPlay.addEventListener('click', playPause);
  els.npMiniPlay.addEventListener('click', playPause);
  els.npPrev.addEventListener('click', prevStation);
  els.npNext.addEventListener('click', nextStation);
  els.npFull.addEventListener('click', toggleFullscreen);
  // Capture: Esc koji zatvara ceo ekran ne sme da stigne i do forme (gde poništava izmenu).
  document.addEventListener('keydown', onKeydown, true);

  for (const type of ['pointermove', 'pointerdown']) {
    els.npCover.addEventListener(type, () => { if (fullscreen) wake(); });
  }
  // Izlaz tasterom Esc ili gestom browsera.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && fullscreen) setFullscreenUI(false);
  });

  onPlayerChange(e => {
    if (e.id) currentId = e.id;
    watchTrack(e.id, e.url);
    renderNowPlaying();
  });
  onTrackChange(renderNowPlaying);

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
