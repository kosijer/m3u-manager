import { els } from './dom.js';

/** Leva kolona je harmonika: otvorena je forma ili pregled stanice, nikad oba. */
let open = 'form';

export const isOpen = name => open === name;

/** @param {'form' | 'np'} name */
export function openSection(name) {
  open = name;
  const form = name === 'form';
  els.form.hidden = !form;
  els.npBody.hidden = form;
  els.formToggle.setAttribute('aria-expanded', String(form));
  els.npToggle.setAttribute('aria-expanded', String(!form));
  els.leftPanel.classList.toggle('np-open', !form);
}

export function initAccordion() {
  els.formToggle.addEventListener('click', () => openSection(isOpen('form') ? 'np' : 'form'));
  els.npToggle.addEventListener('click', () => openSection(isOpen('np') ? 'form' : 'np'));
}
