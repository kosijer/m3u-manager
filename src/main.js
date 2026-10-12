import './styles.css';
import { formatCount } from './lib/text.js';
import { restoreDraft, restoreSettings, state } from './state.js';
import { initCropper } from './ui/cropper.js';
import { els, toast } from './ui/dom.js';
import { fillForm, initForm } from './ui/form.js';
import { initList, renderList } from './ui/list.js';
import { initPlaylist } from './ui/playlist.js';
import { initSettingsDialog } from './ui/settings-dialog.js';
import { initStatus } from './ui/status.js';

restoreSettings();
const restored = restoreDraft();

initStatus();
initCropper();
initList();
initForm();
initPlaylist();
initSettingsDialog();

els.fFile.value = state.filename;
fillForm(null);
renderList();

if (restored) toast(`Vraćen je nesačuvan rad (${formatCount(restored)}).`);
