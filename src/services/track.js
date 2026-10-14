import { NOWPLAYING_URL } from '../config.js';

/**
 * Naziv pesme koja ide na stanici koja svira. Pita Worker (worker/) na svakih POLL_MS dok stanica svira.
 */

const POLL_MS = 20_000;
const RETRY_MS = 60_000;

/** Linkovi streamova koji ne šalju metapodatke; za njih se ne pita ponovo. */
const unsupported = new Set();
const listeners = new Set();

/** @type {{ id: string, url: string } | null} */
let watched = null;
let track = { id: null, title: '' };
let timer;
let ctrl;

export const currentTrack = () => track;

/** @param {(t: { id: string | null, title: string }) => void} fn */
export function onTrackChange(fn) {
  listeners.add(fn);
}

function setTrack(id, title) {
  if (track.id === id && track.title === title) return;
  track = { id, title };
  listeners.forEach(fn => fn(track));
}

async function poll(w) {
  ctrl = new AbortController();
  let next = POLL_MS;
  try {
    const res = await fetch(`${NOWPLAYING_URL}/?url=${encodeURIComponent(w.url)}`, { signal: ctrl.signal });
    const data = await res.json();
    if (watched !== w) return;
    if (res.ok && !data.source) {
      unsupported.add(w.url);
      watched = null;
      setTrack(null, '');
      return;
    }
    if (res.ok) setTrack(w.id, data.track || '');
    else next = RETRY_MS;
  } catch (err) {
    if (err?.name === 'AbortError') return;
    next = RETRY_MS;
  }
  if (watched === w) timer = setTimeout(() => poll(w), next);
}

/** Počinje praćenje stanice koja svira, ili ga prekida (null). */
export function watchTrack(id, url) {
  if (watched && watched.id === id && watched.url === url) return;
  clearTimeout(timer);
  ctrl?.abort();
  watched = id && url && NOWPLAYING_URL && !unsupported.has(url) ? { id, url } : null;
  setTrack(null, '');
  if (watched) poll(watched);
}
