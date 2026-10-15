import './styles.css';
import { formatCount } from './lib/text.js';
import { restoreDraft, restoreSettings, state } from './state.js';
import { initAccordion } from './ui/accordion.js';
import { initCropper } from './ui/cropper.js';
import { els, toast } from './ui/dom.js';
import { fillForm, initForm } from './ui/form.js';
import { initHistory } from './ui/history.js';
import { initList, renderList } from './ui/list.js';
import { initNowPlaying } from './ui/now-playing.js';
import { initPlaylist } from './ui/playlist.js';
import { initSettingsDialog } from './ui/settings-dialog.js';
import { initStatus } from './ui/status.js';

restoreSettings();
const restored = restoreDraft();

initStatus();
initAccordion();
initCropper();
initList();
initForm();
initPlaylist();
initSettingsDialog();
initNowPlaying();
initHistory();

els.fFile.value = state.filename;
fillForm(null);
renderList();

if (restored) toast(`Vraćen je nesačuvan rad (${formatCount(restored)}).`);
