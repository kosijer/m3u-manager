/**
 * @typedef {object} Station
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} dur      Trajanje iz #EXTINF (za radio uvek "-1").
 * @property {string} logo     Uploadovan URL loga (ide u tvg-logo).
 * @property {string} pending  Data URL slike koja čeka upload.
 * @property {[string, string][]} attrs  Ostali atributi iz #EXTINF (tvg-id, group-title...).
 * @property {string[]} extras Dodatne # linije između #EXTINF i linka (npr. #EXTVLCOPT).
 */

let counter = 0;
export const newId = () => 's' + Date.now().toString(36) + (counter++).toString(36);

/** @returns {Station} */
export function createStation(fields = {}) {
  return { id: newId(), name: '', url: '', dur: '-1', logo: '', pending: '', attrs: [], extras: [], ...fields };
}

/** Pravi ispravnu stanicu od nepouzdanih podataka (npr. nacrt iz localStorage-a). */
export function normalizeStation(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return createStation({
    name: String(s.name || ''),
    url: String(s.url || ''),
    dur: String(s.dur || '-1'),
    logo: String(s.logo || ''),
    pending: String(s.pending || ''),
    attrs: Array.isArray(s.attrs)
      ? s.attrs.filter(a => Array.isArray(a) && a.length === 2).map(([k, v]) => [String(k), String(v)])
      : [],
    extras: Array.isArray(s.extras) ? s.extras.map(String) : [],
  });
}
