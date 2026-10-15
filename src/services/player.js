/**
 * Preslušavanje jedne stanice u isto vreme. HLS (.m3u8) ide preko hls.js tamo gde browser
 * nema ugrađenu podršku (Chrome, Firefox); hls.js se učitava tek kad zatreba.
 * Pušta se kroz <video>, pa stanice koje imaju i sliku mogu da je prikažu (videoElement).
 */

const LOAD_TIMEOUT_MS = 15_000;

const media = document.createElement('video');
media.preload = 'none';
// Bez ovoga iPhone otvara sopstveni plejer preko celog ekrana.
media.playsInline = true;
media.setAttribute('playsinline', '');
media.disableRemotePlayback = true;

/** Element u kome se vidi slika; postavlja ga UI. */
export const videoElement = media;

let hls = null;
/** @type {{ id: string, url: string } | null} */
let current = null;
/** 'idle' | 'loading' | 'playing' */
let status = 'idle';
let hasVideo = false;
let loadTimer;
const listeners = new Set();

/**
 * `error` i `failedId` postoje samo kad puštanje ne uspe.
 * @param {(e: { id: string | null, url: string | null, status: string, video: boolean, error?: string, failedId?: string }) => void} fn
 */
export function onPlayerChange(fn) {
  listeners.add(fn);
}

export const playerState = () => ({ id: current?.id ?? null, url: current?.url ?? null, status, video: hasVideo });

function emit(failure) {
  const e = { ...playerState(), ...failure };
  listeners.forEach(fn => fn(e));
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  emit();
}

const isHlsUrl = url => /\.m3u8(?:[?#]|$)/i.test(url);

function describeError(url, err) {
  if (location.protocol === 'https:' && /^http:/i.test(url)) {
    return 'Stream koristi http://, a sajt je na https://, pa ga browser blokira. Probaj https verziju linka.';
  }
  if (err?.name === 'NotAllowedError') return 'Browser nije dozvolio puštanje zvuka. Klikni ponovo.';
  if (err?.name === 'TimeoutError') return 'Stream ne odgovara.';
  if (err?.hls) return 'Stream nije dostupan ili server ne dozvoljava puštanje iz browsera (CORS).';
  return 'Stream nije dostupan ili format nije podržan.';
}

function teardown() {
  clearTimeout(loadTimer);
  if (hls) { hls.destroy(); hls = null; }
  hasVideo = false;
  media.pause();
  media.removeAttribute('src');
  media.load();
}

export function stop() {
  if (!current) return;
  teardown();
  current = null;
  setStatus('idle');
}

function fail(token, err) {
  if (current !== token) return;
  const msg = describeError(token.url, err);
  teardown();
  current = null;
  status = 'idle';
  emit({ error: msg, failedId: token.id });
}

export async function play(id, url) {
  stop();
  const token = { id, url };
  current = token;
  setStatus('loading');
  loadTimer = setTimeout(() => {
    if (status === 'loading') fail(token, { name: 'TimeoutError' });
  }, LOAD_TIMEOUT_MS);

  try {
    if (isHlsUrl(url)) {
      const { default: Hls } = await import('hls.js/light');
      if (current !== token) return;
      // Chrome ponekad javi "maybe" za HLS, a ne pušta audio-only streamove (npr. NTS).
      // Zato hls.js ima prednost; nativno ostaje samo za Safari (gde hls.js nije podržan).
      if (Hls.isSupported()) {
        // Kad je slika mala ili sakrivena, bira se najslabiji kvalitet (manje podataka).
        hls = new Hls({ capLevelToPlayerSize: true });
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fail(token, { hls: data }); });
        hls.loadSource(url);
        hls.attachMedia(media);
      } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
        media.src = url;
      } else {
        throw new Error('HLS nije podržan');
      }
    } else {
      media.src = url;
    }
    await media.play();
  } catch (err) {
    // AbortError znači da je puštanje prekinuto novim play() ili stop().
    if (err?.name !== 'AbortError') fail(token, err);
  }
}

export function toggle(id, url) {
  if (current?.id === id) stop();
  else play(id, url);
}

media.addEventListener('playing', () => {
  if (!current) return;
  clearTimeout(loadTimer);
  setStatus('playing');
});
media.addEventListener('waiting', () => { if (current) setStatus('loading'); });
for (const type of ['loadedmetadata', 'resize']) {
  media.addEventListener(type, () => {
    const next = !!current && media.videoWidth > 0;
    if (next === hasVideo) return;
    hasVideo = next;
    emit();
  });
}
media.addEventListener('error', () => {
  if (current && !hls) fail(current, media.error);
});
