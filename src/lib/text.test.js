import { describe, expect, it } from 'vitest';
import { cleanFilename, formatCount, initials, isStreamUrl, slugify, truncate } from './text.js';
import { normalizeStation } from './station.js';

describe('formatCount', () => {
  it.each([
    [0, 'stanica'], [1, 'stanica'], [2, 'stanice'], [4, 'stanice'], [5, 'stanica'],
    [11, 'stanica'], [12, 'stanica'], [14, 'stanica'], [21, 'stanica'], [22, 'stanice'], [112, 'stanica'],
  ])('%i -> %s', (n, word) => {
    expect(formatCount(n)).toBe(`${n} ${word}`);
  });
});

describe('cleanFilename', () => {
  it('dodaje .m3u i čisti nedozvoljene znake', () => {
    expect(cleanFilename('moja/lista')).toBe('moja-lista.m3u');
    expect(cleanFilename('lista.M3U8')).toBe('lista.M3U8');
    expect(cleanFilename('   ')).toBe('radio.m3u');
  });
});

describe('ostalo', () => {
  it('initials', () => {
    expect(initials('lyl lyon')).toBe('LL');
    expect(initials('  ')).toBe('?');
  });

  it('slugify skida dijakritike', () => {
    expect(slugify('Radio Beograd Čačak!')).toBe('radio-beograd-cacak');
    expect(slugify('***')).toBe('logo');
  });

  it('truncate', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });

  it('isStreamUrl', () => {
    expect(isStreamUrl('https://a.b/c')).toBe(true);
    expect(isStreamUrl('rtmp://a.b/c')).toBe(true);
    expect(isStreamUrl('a.b/c')).toBe(false);
    expect(isStreamUrl('http://a b')).toBe(false);
  });

  it('normalizeStation popravlja oštećen nacrt', () => {
    const s = normalizeStation({ name: 5, attrs: [['a', 1], 'x', ['b']], extras: 'nije niz' });
    expect(s).toMatchObject({ name: '5', url: '', dur: '-1', attrs: [['a', '1']], extras: [] });
    expect(s.id).toBeTruthy();
  });
});
