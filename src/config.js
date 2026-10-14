const env = import.meta.env;

export const PROVIDERS = ['imgbb', 'imgur'];

export const DEFAULT_PROVIDER = PROVIDERS.includes(env.VITE_UPLOAD_PROVIDER) ? env.VITE_UPLOAD_PROVIDER : 'imgbb';

/** Ključevi iz .env fajla. Koriste se samo kada korisnik nije uneo svoj ključ u aplikaciji. */
export const ENV_KEYS = {
  imgbb: (env.VITE_IMGBB_API_KEY || '').trim(),
  imgur: (env.VITE_IMGUR_CLIENT_ID || '').trim(),
};

/** Adresa Cloudflare Workera za naziv pesme (worker/). Bez nje se naziv pesme ne prikazuje. */
export const NOWPLAYING_URL = (env.VITE_NOWPLAYING_URL || '').trim().replace(/\/+$/, '');

export const STORAGE_KEYS = {
  draft: 'm3ustudio.draft.v1',
  settings: 'm3ustudio.settings.v1',
};

export const DEFAULT_FILENAME = 'radio.m3u';
export const LOGO_SIZE = 600;
export const UPLOAD_TIMEOUT_MS = 30_000;
