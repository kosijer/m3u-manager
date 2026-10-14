/**
 * Cloudflare Worker: GET /?url=<link ka streamu> vraća naziv pesme koja trenutno ide.
 *   { track: "Izvođač - Pesma" | null, source: "icy" | "id3" | null }
 * source null znači da stream ne šalje metapodatke (nema svrhe pitati ponovo).
 * Iz streama se čita samo onoliko bajtova koliko treba do prvog bloka metapodataka.
 */
import { parseIcyMeta, trackFromSegment } from './meta.js';

const TIMEOUT_MS = 8000;
const MAX_METAINT = 256 * 1024;
const MAX_SEGMENT_BYTES = 4 * 1024 * 1024;
const USER_AGENT = 'M3U-Studio-NowPlaying/1.0';
const NONE = { track: null, source: null };

const isHls = url => /\.m3u8(?:[?#]|$)/i.test(url);

/** Čita iz streama dok ne skupi bar n bajtova. */
async function readAtLeast(reader, n) {
  const parts = [];
  let total = 0;
  while (total < n) {
    const { done, value } = await reader.read();
    if (done) throw new Error('Stream se prekinuo pre metapodataka.');
    parts.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function icyTrack(res) {
  const metaint = parseInt(res.headers.get('icy-metaint') || '', 10);
  if (!(metaint > 0 && metaint <= MAX_METAINT) || !res.body) {
    await res.body?.cancel();
    return NONE;
  }
  const reader = res.body.getReader();
  try {
    let buf = await readAtLeast(reader, metaint + 1);
    const len = buf[metaint] * 16;
    if (len && buf.length < metaint + 1 + len) {
      const rest = await readAtLeast(reader, metaint + 1 + len - buf.length);
      const all = new Uint8Array(buf.length + rest.length);
      all.set(buf);
      all.set(rest, buf.length);
      buf = all;
    }
    const track = len ? parseIcyMeta(buf.subarray(metaint + 1, metaint + 1 + len)) : null;
    return { track, source: 'icy' };
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function hlsTrack(text, baseUrl, signal, nested = false) {
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const uris = lines.filter(l => l && !l.startsWith('#'));
  if (!uris.length) return NONE;

  if (lines.some(l => l.startsWith('#EXT-X-STREAM-INF'))) {
    if (nested) return NONE;
    const res = await fetch(new URL(uris[0], baseUrl), { signal, headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return hlsTrack(await res.text(), res.url, signal, true);
  }

  const res = await fetch(new URL(uris.at(-1), baseUrl), { signal, headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get('content-length')) > MAX_SEGMENT_BYTES) {
    await res.body?.cancel();
    return NONE;
  }
  const { supported, track } = trackFromSegment(new Uint8Array(await res.arrayBuffer()));
  return supported ? { track, source: 'id3' } : NONE;
}

async function readTrack(url) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': USER_AGENT, ...(isHls(url) ? {} : { 'Icy-MetaData': '1' }) },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`HTTP ${res.status}`);
  }
  if (isHls(url) || /mpegurl/i.test(res.headers.get('content-type') || '')) {
    return hlsTrack(await res.text(), res.url, signal);
  }
  return icyTrack(res);
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return json({ error: 'Origin nije dozvoljen.' }, 403, {});
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    }
    if (request.method !== 'GET') return json({ error: 'Samo GET.' }, 405, cors);

    const url = new URL(request.url).searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(url)) return json({ error: 'Parametar url mora biti http(s) link.' }, 400, cors);

    try {
      return json(await readTrack(url), 200, cors);
    } catch (err) {
      console.error(url, err);
      const error = err?.name === 'TimeoutError' ? 'Stream ne odgovara.' : 'Stream nije dostupan.';
      return json({ ...NONE, error }, 502, cors);
    }
  },
};
