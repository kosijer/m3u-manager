import { describe, expect, it } from 'vitest';
import { addEntry, dayLabel, filterEntries, normalizeHistory, toCsv } from './history.js';
import { formatSongs } from './text.js';

const MIN = 60_000;
const entry = (title, at, url = 'https://a/stream') => ({ at, title, station: 'Radio A', url });

describe('addEntry', () => {
  it('dodaje novu pesmu na vrh i poštuje ograničenje', () => {
    let list = [];
    list = addEntry(list, entry('Prva', 0), 2);
    list = addEntry(list, entry('Druga', 4 * MIN), 2);
    list = addEntry(list, entry('Treća', 8 * MIN), 2);
    expect(list.map(e => e.title)).toEqual(['Treća', 'Druga']);
  });

  it('ne upisuje istu pesmu ponovo dok traje (npr. stanica ponovo pokrenuta)', () => {
    const list = [entry('Ista', 0)];
    expect(addEntry(list, entry('Ista', 3 * MIN), 10)).toBe(list);
  });

  it('ista pesma kasnije ili na drugoj stanici je nov upis', () => {
    const list = [entry('Ista', 0)];
    expect(addEntry(list, entry('Ista', 60 * MIN), 10)).toHaveLength(2);
    expect(addEntry(list, entry('Ista', MIN, 'https://b/stream'), 10)).toHaveLength(2);
  });
});

describe('ostalo', () => {
  it('normalizeHistory izbacuje oštećene upise', () => {
    const raw = [entry('Dobra', 1), { title: '', at: 2 }, { title: 'Bez vremena' }, null, 'x'];
    expect(normalizeHistory(raw).map(e => e.title)).toEqual(['Dobra']);
    expect(normalizeHistory({})).toEqual([]);
  });

  it('pretraga ne zavisi od velikih slova i kvačica', () => {
    const list = [entry('Đorđe Balašević - Ćaletova pesma', 0), { ...entry('Druga', 0), station: 'Čačak FM' }];
    expect(filterEntries(list, 'djordje').length).toBe(1);
    expect(filterEntries(list, 'CALETOVA').length).toBe(1);
    expect(filterEntries(list, 'cacak')[0].title).toBe('Druga');
    expect(filterEntries(list, '  ')).toBe(list);
  });

  it('toCsv navodi polja sa zarezom i navodnicima', () => {
    const at = new Date(2026, 9, 15, 15, 12, 5).getTime();
    const csv = toCsv([{ at, title: 'A, B "C"', station: 'Radio', url: 'https://x' }]);
    expect(csv).toBe('Vreme,Stanica,Pesma,Link\r\n2026-10-15 15:12:05,Radio,"A, B ""C""",https://x\r\n');
  });

  it('dayLabel', () => {
    const now = new Date(2026, 9, 15, 0, 30).getTime();
    expect(dayLabel(new Date(2026, 9, 15, 0, 5).getTime(), now)).toBe('Danas');
    expect(dayLabel(new Date(2026, 9, 14, 23, 50).getTime(), now)).toBe('Juče');
    expect(dayLabel(new Date(2026, 9, 3, 12).getTime(), now)).toBe('3. 10. 2026.');
  });

  it.each([[1, 'pesma'], [2, 'pesme'], [5, 'pesama'], [11, 'pesama'], [12, 'pesama'], [21, 'pesma'], [24, 'pesme']])(
    'formatSongs %i -> %s', (n, word) => expect(formatSongs(n)).toBe(`${n} ${word}`));
});
