import { ENV_KEYS } from '../config.js';
import { settings, updateSettings } from '../state.js';
import { els, toast } from './dom.js';
import { updateUI } from './status.js';

const ENV_PLACEHOLDER = 'Podešen preko .env';

function syncProviderRows() {
  const provider = els.sProvider.value;
  els.rowImgbb.hidden = provider !== 'imgbb';
  els.rowImgur.hidden = provider !== 'imgur';
  els.envHint.hidden = !ENV_KEYS[provider];
}

export function openSettings() {
  els.sProvider.value = settings.provider;
  els.sImgbb.value = settings.imgbb;
  els.sImgur.value = settings.imgur;
  els.sImgbb.placeholder = ENV_KEYS.imgbb ? ENV_PLACEHOLDER : '';
  els.sImgur.placeholder = ENV_KEYS.imgur ? ENV_PLACEHOLDER : '';
  syncProviderRows();
  els.dlg.showModal();
}

export function initSettingsDialog() {
  els.sProvider.addEventListener('change', syncProviderRows);
  els.btnSettings.addEventListener('click', openSettings);
  els.btnHostSetup.addEventListener('click', openSettings);
  els.btnDlgCancel.addEventListener('click', () => els.dlg.close());
  els.dlgForm.addEventListener('submit', e => {
    e.preventDefault();
    const saved = updateSettings({
      provider: els.sProvider.value,
      imgbb: els.sImgbb.value.trim(),
      imgur: els.sImgur.value.trim(),
    });
    els.dlg.close();
    updateUI();
    toast(saved ? 'Podešavanje je sačuvano.' : 'Podešavanje važi do zatvaranja stranice (pregledač ne dozvoljava čuvanje).');
  });
}
