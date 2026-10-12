import { UPLOAD_TIMEOUT_MS } from '../config.js';

export class MissingKeyError extends Error {
  constructor() {
    super('Nije unet API ključ');
    this.name = 'MissingKeyError';
  }
}

async function readJson(res) {
  return res.json().catch(() => null);
}

async function uploadToImgbb(blob, key, signal) {
  const fd = new FormData();
  fd.append('image', blob, 'logo.png');
  const res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), { method: 'POST', body: fd, signal });
  const j = await readJson(res);
  if (!res.ok || !j?.success) throw new Error(j?.error?.message || 'HTTP ' + res.status);
  return j.data.url;
}

async function uploadToImgur(blob, clientId, signal) {
  const fd = new FormData();
  fd.append('image', blob);
  fd.append('type', 'file');
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { Authorization: 'Client-ID ' + clientId },
    body: fd,
    signal,
  });
  const j = await readJson(res);
  if (!res.ok || !j?.success) throw new Error(j?.data?.error || 'HTTP ' + res.status);
  return j.data.link;
}

const UPLOADERS = { imgbb: uploadToImgbb, imgur: uploadToImgur };

/**
 * Šalje sliku na servis i vraća javni URL.
 * Novi servis se dodaje kao još jedna funkcija u UPLOADERS, plus opcija u dijalogu i u config.PROVIDERS.
 * @param {Blob} blob
 * @param {{ provider: string, key: string }} opts
 */
export async function uploadImage(blob, { provider, key }) {
  if (!key) throw new MissingKeyError();
  const upload = UPLOADERS[provider];
  if (!upload) throw new Error('nepoznat servis: ' + provider);
  return upload(blob, key, AbortSignal.timeout(UPLOAD_TIMEOUT_MS));
}

export function describeUploadError(e) {
  if (e instanceof MissingKeyError) return 'nije unet API ključ';
  if (e?.name === 'TimeoutError') return 'servis ne odgovara (isteklo vreme)';
  if (e instanceof TypeError) return 'nema veze sa servisom (mreža ili blokiran zahtev)';
  return e?.message || 'nepoznata greška';
}
