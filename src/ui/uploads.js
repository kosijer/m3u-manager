import { dataUrlToBlob } from '../lib/blob.js';
import { canUpload, findStation, playlistOf, selectedStation, settings, state, uploadKey } from '../state.js';
import { describeUploadError, uploadImage } from '../services/upload.js';
import { updateLogoThumb } from './cropper.js';
import { els, toast } from './dom.js';
import { renderList } from './list.js';
import { openSettings } from './settings-dialog.js';
import { markDirty, persistDraft } from './status.js';

/** Id-jevi stanica čiji se logo upravo šalje (sprečava dupli upload). */
const inFlight = new Set();

export const isUploading = id => inFlight.has(id);

export const uploadLogo = blob => uploadImage(blob, { provider: settings.provider, key: uploadKey() });

/** Šalje `pending` sliku stanice. Baca grešku ako upload ne uspe. */
async function uploadPending(station) {
  const dataUrl = station.pending;
  inFlight.add(station.id);
  renderList();
  try {
    const url = await uploadLogo(dataUrlToBlob(dataUrl));
    // Stanica je u međuvremenu mogla da dobije novu sliku, da bude obrisana ili da se pređe na drugi tab.
    const owner = playlistOf(station);
    if (station.pending !== dataUrl || !owner) return;
    station.logo = url;
    station.pending = '';
    if (owner.id === state.playlistId) markDirty();
    else { owner.dirty = true; persistDraft(); }
    if (selectedStation() === station) {
      els.fLogo.value = url;
      updateLogoThumb();
    }
  } finally {
    inFlight.delete(station.id);
    renderList();
  }
}

export async function retryUpload(id) {
  const s = findStation(id);
  if (!s || !s.pending || inFlight.has(id)) return;
  if (!canUpload()) { openSettings(); return; }
  try {
    await uploadPending(s);
    toast('Logo je uploadovan: ' + s.name);
  } catch (e) {
    toast('Upload nije uspeo: ' + describeUploadError(e), 'err');
  }
}

/** Vraća true kada nijedan logo više ne čeka upload. */
export async function uploadAllPending() {
  if (!canUpload()) { openSettings(); return false; }
  for (const s of state.stations.filter(x => x.pending && !inFlight.has(x.id))) {
    try {
      await uploadPending(s);
    } catch (e) {
      toast('Upload nije uspeo za ' + s.name + ': ' + describeUploadError(e), 'err');
      return false;
    }
  }
  if (inFlight.size) {
    toast('Još se uploaduju neki logotipi. Sačekaj pa pokušaj ponovo.', 'err');
    return false;
  }
  return true;
}
