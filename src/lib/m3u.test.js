import { describe, expect, it } from 'vitest';
import { parseAttrs, parseM3U, serializeM3U } from './m3u.js';

describe('parseAttrs', () => {
  it('čita atribute sa i bez navodnika', () => {
    expect(parseAttrs(' tvg-id="a b" group-title=News')).toEqual([['tvg-id', 'a b'], ['group-title', 'News']]);
  });

  it('dekodira &quot;', () => {
    expect(parseAttrs(' tvg-name="Radio &quot;X&quot;"')).toEqual([['tvg-name', 'Radio "X"']]);
  });
});

describe('parseM3U', () => {
  it('čita header, logo, atribute, dodatne linije i link', () => {
    const text = [
      '\uFEFF#EXTM3U x-tvg-url="http://e.pg"',
      '#EXTINF:-1 tvg-logo="https://i.ibb.co/l.png" group-title="Rock",LYL Lyon',
      '#EXTVLCOPT:http-user-agent=VLC',
      'https://radio.lyl.live/hls/aac_hifi.m3u8',
      '',
    ].join('\r\n');
    const { header, stations } = parseM3U(text);
    expect(header).toBe('#EXTM3U x-tvg-url="http://e.pg"');
    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({
      name: 'LYL Lyon',
      url: 'https://radio.lyl.live/hls/aac_hifi.m3u8',
      dur: '-1',
      logo: 'https://i.ibb.co/l.png',
      pending: '',
      attrs: [['group-title', 'Rock']],
      extras: ['#EXTVLCOPT:http-user-agent=VLC'],
    });
  });

  it('linku bez #EXTINF daje ime po hostu', () => {
    const { stations } = parseM3U('#EXTM3U\nhttp://stream.example.com:8000/live\n');
    expect(stations[0].name).toBe('stream.example.com');
  });

  it('podnosi #EXTINF bez zareza', () => {
    const { stations } = parseM3U('#EXTINF:-1 Radio X\nhttp://x.example/s');
    expect(stations[0].name).toBe('Radio X');
  });

  it('ime sme da sadrži zarez', () => {
    const { stations } = parseM3U('#EXTINF:-1 tvg-id="a",Radio, Jazz & Blues\nhttp://x.example/s');
    expect(stations[0].name).toBe('Radio, Jazz & Blues');
  });

  it('daje jedinstvene id-jeve', () => {
    const { stations } = parseM3U('http://a.example/1\nhttp://a.example/2\nhttp://a.example/3');
    expect(new Set(stations.map(s => s.id)).size).toBe(3);
  });
});

describe('serializeM3U', () => {
  it('stavlja tvg-logo prvi i preskače neuploadovan logo', () => {
    const out = serializeM3U('#EXTM3U', [
      { name: 'A', url: 'http://a', dur: '-1', logo: 'http://l/a.png', pending: '', attrs: [['group-title', 'G']], extras: [] },
      { name: 'B\nB', url: 'http://b', dur: '-1', logo: '', pending: 'data:image/png;base64,AAA', attrs: [], extras: ['#EXTVLCOPT:x'] },
    ]);
    expect(out).toBe([
      '#EXTM3U',
      '#EXTINF:-1 tvg-logo="http://l/a.png" group-title="G",A',
      'http://a',
      '#EXTINF:-1,B B',
      '#EXTVLCOPT:x',
      'http://b',
      '',
    ].join('\n'));
  });

  it('parse -> serialize -> parse ne menja podatke', () => {
    const text = '#EXTM3U\n#EXTINF:-1 tvg-logo="http://l.png" tvg-name="Say &quot;hi&quot;",Hi\n#EXTVLCOPT:a=b\nhttp://s\n';
    const first = parseM3U(text);
    const again = serializeM3U(first.header, first.stations);
    expect(again).toBe(text);
  });
});
