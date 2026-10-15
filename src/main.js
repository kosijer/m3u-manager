import './styles.css';
import { restorePlaylists, restoreSettings, state } from './state.js';
import { initAccordion } from './ui/accordion.js';
import { initCropper } from './ui/cropper.js';
import { els } from './ui/dom.js';
import { fillForm, initForm } from './ui/form.js';
import { initHistory } from './ui/history.js';
import { initList, renderList } from './ui/list.js';
import { initNowPlaying } from './ui/now-playing.js';
import { initPlaylist } from './ui/playlist.js';
import { initPwa } from './ui/pwa.js';
import { initSettingsDialog } from './ui/settings-dialog.js';
import { initStatus } from './ui/status.js';
import { initTabs } from './ui/tabs.js';

restoreSettings();
restorePlaylists();

initStatus();
initAccordion();
initCropper();
initList();
initForm();
initPlaylist();
initTabs();
initSettingsDialog();
initNowPlaying();
initHistory();

els.fFile.value = state.filename;
fillForm(null);
renderList();
initPwa();
