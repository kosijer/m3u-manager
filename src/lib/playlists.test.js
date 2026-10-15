import { describe, expect, it } from 'vitest';
import { normalizePlaylist, tabLabel, uniqueFilename } from './playlists.js';

describe('playlists', () => {
  it('normalizePlaylist popravlja oštećen zapis', () => {
    const p = normalizePlaylist({ id: 'p1', filename: '', stations: [{ name: 'A', url: 'https://a' }, null], dirty: 1 }, 'radio.m3u');
    expect(p).toMatchObject({ id: 'p1', filename: 'radio.m3u', header: '#EXTM3U', dirty: true });
    expect(p.stations.map(s => s.name)).toEqual(['A', '']);
    expect(normalizePlaylist(null, 'x.m3u').id).toMatch(/^p/);
  });

  it('uniqueFilename dodaje broj pre ekstenzije', () => {
    expect(uniqueFilename('radio.m3u', ['jazz.m3u'])).toBe('radio.m3u');
    expect(uniqueFilename('radio.m3u', ['radio.m3u', 'radio-2.m3u'])).toBe('radio-3.m3u');
    expect(uniqueFilename('lista', ['lista'])).toBe('lista-2');
  });

  it('tabLabel skida ekstenziju', () => {
    expect(tabLabel('Jazz.M3U8')).toBe('Jazz');
    expect(tabLabel('.m3u')).toBe('.m3u');
  });
});
