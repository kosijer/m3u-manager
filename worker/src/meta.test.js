import { describe, expect, it } from 'vitest';
import { id3FromTs, parseIcyMeta, parseId3, trackFromSegment } from './meta.js';

const bytes = s => Uint8Array.from(s, c => c.charCodeAt(0));
const utf8 = s => new TextEncoder().encode(s);

function id3Frame(id, text, enc = 3) {
  const body = enc === 3 ? utf8(text) : bytes(text);
  const len = body.length + 1;
  return [...bytes(id), (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, 0, 0, enc, ...body];
}

function id3Tag(...frames) {
  const body = frames.flat();
  const n = body.length;
  return Uint8Array.from([...bytes('ID3'), 3, 0, 0, (n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127, ...body]);
}

function tsPacket(pid, payload, start) {
  const p = new Uint8Array(188).fill(0xff);
  p.set([0x47, (start ? 0x40 : 0) | (pid >> 8), pid & 255, 0x10]);
  p.set(payload.subarray(0, 184), 4);
  return p;
}

/** Minimalan MPEG-TS: PAT, PMT sa audio (0x0f) i metadata (0x15) stream-om, i ID3 tag u PES paketu. */
function tsWithId3(tag) {
  const pat = Uint8Array.from([0, 0x00, 0xb0, 13, 0, 1, 0xc1, 0, 0, 0, 1, 0xf0, 0x00, 0, 0, 0, 0]);
  const pmt = Uint8Array.from([0, 0x02, 0xb0, 23, 0, 1, 0xc1, 0, 0, 0xe1, 0x00, 0xf0, 0,
    0x0f, 0xe1, 0x00, 0xf0, 0, 0x15, 0xe1, 0x01, 0xf0, 0, 0, 0, 0, 0]);
  const pes = Uint8Array.from([0, 0, 1, 0xbd, 0, 0, 0x84, 0x80, 5, 0x21, 0, 1, 0, 1, ...tag]);
  const packets = [tsPacket(0, pat, true), tsPacket(0x1000, pmt, true)];
  for (let o = 0; o < pes.length; o += 184) packets.push(tsPacket(0x101, pes.subarray(o), o === 0));
  const out = new Uint8Array(packets.length * 188);
  packets.forEach((p, i) => out.set(p, i * 188));
  return out;
}

describe('parseIcyMeta', () => {
  it('čita StreamTitle, i sa apostrofom u nazivu', () => {
    expect(parseIcyMeta(bytes("StreamTitle='Guns N' Roses - Patience';StreamUrl='';\0\0"))).toBe("Guns N' Roses - Patience");
  });
  it('dekodira UTF-8, a kad nije validan, latin1', () => {
    expect(parseIcyMeta(utf8("StreamTitle='Đorđe Balašević - Ne lomite mi bagrenje';"))).toBe('Đorđe Balašević - Ne lomite mi bagrenje');
    expect(parseIcyMeta(Uint8Array.from([...bytes("StreamTitle='Caf"), 0xe9, ...bytes("';")]))).toBe('Café');
  });
  it('vraća null za prazan naslov', () => {
    expect(parseIcyMeta(bytes("StreamTitle='';"))).toBeNull();
  });
});

describe('parseId3', () => {
  it('čita izvođača i naslov', () => {
    expect(parseId3(id3Tag(id3Frame('TPE1', 'Neil Young'), id3Frame('TIT2', 'Like a Hurricane')))).toEqual({ artist: 'Neil Young', title: 'Like a Hurricane' });
  });
  it('vraća null za podatke koji nisu ID3', () => {
    expect(parseId3(bytes('not an id3 tag'))).toBeNull();
  });
});

describe('trackFromSegment', () => {
  it('nalazi ID3 u MPEG-TS segmentu', () => {
    const ts = tsWithId3(id3Tag(id3Frame('TIT2', '1000 Balles - Feng Shit')));
    expect(id3FromTs(ts)).toHaveLength(1);
    expect(trackFromSegment(ts)).toEqual({ supported: true, track: '1000 Balles - Feng Shit' });
  });
  it('spaja izvođača i naslov', () => {
    const aac = id3Tag(id3Frame('TPE1', 'Artist'), id3Frame('TIT2', 'Song'));
    expect(trackFromSegment(aac)).toEqual({ supported: true, track: 'Artist - Song' });
  });
  it('segment bez metapodataka nije podržan', () => {
    expect(trackFromSegment(new Uint8Array(376).fill(0x47, 0, 1))).toEqual({ supported: false, track: null });
  });
});
