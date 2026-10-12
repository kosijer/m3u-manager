/**
 * Preslušavanje jedne stanice u isto vreme. HLS (.m3u8) ide preko hls.js tamo gde browser
 * nema ugrađenu podršku (Chrome, Firefox); hls.js se učitava tek kad zatreba.
 */

const LOAD_TIMEOUT_MS = 15_000;

const audio = new Audio();
audio.preload = 'none';

let hls = null;
/** @type {{ id: string, url: string } | null} */
let current = null;
/** 'idle' | 'loading' | 'playing' */
let status = 'idle';
let loadTimer;
const listeners = new Set();

/**
 * `error` i `failedId` postoje samo kad puštanje ne uspe.
 * @param {(e: { id: string | null, url: string | null, status: string, error?: string, failedId?: string }) => void} fn
 */
export function onPlayerChange(fn) {
  listeners.add(fn);
}

export const playerState = () => ({ id: current?.id ?? null, url: current?.url ?? null, status });

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
const nativeHls = () => audio.canPlayType('application/vnd.apple.mpegurl') !== '';

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
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
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
    if (isHlsUrl(url) && !nativeHls()) {
      const { default: Hls } = await import('hls.js/light');
      if (current !== token) return;
      if (!Hls.isSupported()) throw new Error('HLS nije podržan');
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fail(token, { hls: data }); });
      hls.loadSource(url);
      hls.attachMedia(audio);
    } else {
      audio.src = url;
    }
    await audio.play();
  } catch (err) {
    // AbortError znači da je puštanje prekinuto novim play() ili stop().
    if (err?.name !== 'AbortError') fail(token, err);
  }
}

export function toggle(id, url) {
  if (current?.id === id) stop();
  else play(id, url);
}

audio.addEventListener('playing', () => {
  if (!current) return;
  clearTimeout(loadTimer);
  setStatus('playing');
});
audio.addEventListener('waiting', () => { if (current) setStatus('loading'); });
audio.addEventListener('error', () => {
  if (current && !hls) fail(current, audio.error);
});
