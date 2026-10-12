import { createStation } from './station.js';
import { hostOf } from './text.js';

export const DEFAULT_HEADER = '#EXTM3U';

const ATTR_RE = /([^\s=,]+)=(?:"([^"]*)"|([^\s,"]*))/g;
const EXTINF_RE = /^#EXTINF:\s*(-?\d+(?:\.\d+)?)((?:\s+[^\s=,]+=(?:"[^"]*"|[^\s,"]*))*)\s*,(.*)$/i;
const EXTINF_LOOSE_RE = /^#EXTINF:\s*(-?\d+(?:\.\d+)?)(.*)$/i;

const encodeAttr = v => String(v).replace(/"/g, '&quot;');
const decodeAttr = v => v.replace(/&quot;/g, '"');

/** `tvg-logo="x" group-title=Y` -> [['tvg-logo', 'x'], ['group-title', 'Y']] */
export function parseAttrs(s) {
  return [...s.matchAll(ATTR_RE)].map(m => [m[1], decodeAttr(m[2] ?? m[3])]);
}

function parseExtinf(line) {
  const m = line.match(EXTINF_RE);
  if (m) return { dur: m[1], attrs: parseAttrs(m[2]), name: m[3].trim(), extras: [] };
  const loose = line.match(EXTINF_LOOSE_RE);
  return {
    dur: loose ? loose[1] : '-1',
    attrs: [],
    name: (loose ? loose[2] : '').replace(/^[\s,]+/, '').trim(),
    extras: [],
  };
}

function toStation(info, url) {
  const attrs = [];
  let logo = '';
  for (const [k, v] of info.attrs) {
    if (k.toLowerCase() === 'tvg-logo') logo = v;
    else attrs.push([k, v]);
  }
  return createStation({ name: info.name || hostOf(url), url, dur: info.dur, logo, attrs, extras: info.extras });
}

/** @returns {{ header: string, stations: import('./station.js').Station[] }} */
export function parseM3U(text) {
  let header = DEFAULT_HEADER;
  const stations = [];
  let info = null;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#EXTM3U/i.test(line)) { header = line; continue; }
    if (/^#EXTINF:/i.test(line)) { info = parseExtinf(line); continue; }
    if (line.startsWith('#')) { if (info) info.extras.push(line); continue; }
    stations.push(toStation(info || { dur: '-1', attrs: [], name: '', extras: [] }, line));
    info = null;
  }
  return { header, stations };
}

/** Stanice koje imaju samo `pending` (neuploadovan logo) izlaze bez tvg-logo. */
export function serializeM3U(header, stations) {
  const lines = [header || DEFAULT_HEADER];
  for (const s of stations) {
    const attrs = (s.logo ? [['tvg-logo', s.logo], ...s.attrs] : s.attrs)
      .map(([k, v]) => ` ${k}="${encodeAttr(v)}"`)
      .join('');
    lines.push(`#EXTINF:${s.dur || '-1'}${attrs},${s.name.replace(/[\r\n]+/g, ' ')}`);
    lines.push(...s.extras);
    lines.push(s.url);
  }
  return lines.join('\n') + '\n';
}
