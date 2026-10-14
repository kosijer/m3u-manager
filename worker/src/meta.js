/**
 * Čitanje naziva pesme iz radio streama:
 * - ICY: Icecast/Shoutcast ubacuju "StreamTitle='…';" u MP3/AAC stream na svakih icy-metaint bajtova.
 * - ID3: HLS stanice šalju ID3 tagove u MPEG-TS segmentima (stream_type 0x15) ili na početku AAC segmenta.
 */

const latin1 = bytes => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
};

function decodeUtf8OrLatin1(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return latin1(bytes);
  }
}

/** Blok ICY metapodataka, npr. "StreamTitle='Izvođač - Pesma';StreamUrl='';". */
export function parseIcyMeta(bytes) {
  const text = decodeUtf8OrLatin1(bytes).replace(/\0+$/, '');
  const m = /StreamTitle='(.*?)'(?:;|$)/s.exec(text);
  return m ? m[1].trim() || null : null;
}

const syncsafe = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];
const uint32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

function decodeUtf16(b, littleEndian) {
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) {
    s += String.fromCharCode(littleEndian ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
  }
  return s;
}

/** Tekstualni ID3 frejm: prvi bajt je kodiranje (0 latin1, 1 UTF-16 sa BOM, 2 UTF-16BE, 3 UTF-8). */
function decodeId3Text(data) {
  const enc = data[0];
  let body = data.subarray(1);
  let s;
  if (enc === 1 || enc === 2) {
    let le = false;
    if (enc === 1 && body[0] === 0xff && body[1] === 0xfe) { le = true; body = body.subarray(2); }
    else if (enc === 1 && body[0] === 0xfe && body[1] === 0xff) body = body.subarray(2);
    s = decodeUtf16(body, le);
  } else if (enc === 3) {
    s = new TextDecoder('utf-8').decode(body);
  } else {
    s = latin1(body);
  }
  // ID3v2.4 dozvoljava više vrednosti razdvojenih nulom; uzima se prva.
  return s.split('\0')[0].trim();
}

/** @returns {{ title?: string, artist?: string } | null} ID3v2.3/2.4 tag koji počinje na b[0]. */
export function parseId3(b) {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null;
  const version = b[3];
  if (version < 3 || version > 4) return null;
  const end = Math.min(b.length, 10 + syncsafe(b, 6));
  let p = 10;
  if (b[5] & 0x40) p += version === 4 ? syncsafe(b, p) : uint32(b, p) + 4;
  const out = {};
  while (p + 10 <= end) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const len = version === 4 ? syncsafe(b, p + 4) : uint32(b, p + 4);
    const data = b.subarray(p + 10, Math.min(end, p + 10 + len));
    if (id === 'TIT2' && data.length > 1) out.title = decodeId3Text(data);
    else if (id === 'TPE1' && data.length > 1) out.artist = decodeId3Text(data);
    p += 10 + len;
  }
  return out;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Sadržaj PES paketa bez zaglavlja. */
function pesPayload(pes) {
  if (pes.length < 9 || pes[0] !== 0 || pes[1] !== 0 || pes[2] !== 1) return null;
  return pes.subarray(9 + pes[8]);
}

/**
 * ID3 tagovi iz MPEG-TS segmenta. Vraća null ako segment nema stream sa metapodacima.
 * @returns {Uint8Array[] | null}
 */
export function id3FromTs(b) {
  let pmtPid = -1;
  let metaPid = -1;
  const tags = [];
  let pes = null;
  for (let i = 0; i + 188 <= b.length; i += 188) {
    if (b[i] !== 0x47) continue;
    const start = (b[i + 1] & 0x40) !== 0;
    const pid = ((b[i + 1] & 0x1f) << 8) | b[i + 2];
    const afc = (b[i + 3] >> 4) & 3;
    let p = i + 4;
    if (afc & 2) p += 1 + b[p];
    if (!(afc & 1) || p >= i + 188) continue;
    const payload = b.subarray(p, i + 188);

    if (pid === 0 && start) {
      const q = 1 + payload[0];
      pmtPid = ((payload[q + 10] & 0x1f) << 8) | payload[q + 11];
    } else if (pid === pmtPid && start) {
      const q = 1 + payload[0];
      const sectionEnd = q + 3 + (((payload[q + 1] & 0x0f) << 8) | payload[q + 2]) - 4;
      let e = q + 12 + (((payload[q + 10] & 0x0f) << 8) | payload[q + 11]);
      while (e + 5 <= sectionEnd) {
        if (payload[e] === 0x15) metaPid = ((payload[e + 1] & 0x1f) << 8) | payload[e + 2];
        e += 5 + (((payload[e + 3] & 0x0f) << 8) | payload[e + 4]);
      }
    } else if (pid === metaPid) {
      if (start) {
        if (pes) tags.push(concat(pes));
        pes = [payload];
      } else if (pes) {
        pes.push(payload);
      }
    }
  }
  if (pes) tags.push(concat(pes));
  if (metaPid < 0) return null;
  return tags.map(pesPayload).filter(Boolean);
}

const formatTrack = t => (t.artist && t.title ? `${t.artist} - ${t.title}` : t.title || t.artist || null);

/**
 * Naziv pesme iz HLS segmenta (MPEG-TS ili AAC sa ID3 na početku).
 * @returns {{ supported: boolean, track: string | null }}
 */
export function trackFromSegment(b) {
  const tags = b[0] === 0x47 ? id3FromTs(b) : b[0] === 0x49 ? [b] : null;
  if (!tags) return { supported: false, track: null };
  let track = null;
  for (const tag of tags) {
    const t = parseId3(tag);
    if (t) track = formatTrack(t) || track;
  }
  return { supported: true, track };
}
