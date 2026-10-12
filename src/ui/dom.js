/** Svi elementi sa id-jem iz index.html, npr. els.fName, els.btnSave. */
export const els = {};
for (const el of document.querySelectorAll('[id]')) els[el.id] = el;

let toastTimer;
export function toast(msg, kind) {
  const t = els.toast;
  t.textContent = msg;
  t.className = 'toast show' + (kind === 'err' ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, kind === 'err' ? 6500 : 3200);
}

export function setLabel(btn, text) {
  btn.querySelector('.lbl').textContent = text;
}

/**
 * Dugme koje traži drugi klik za potvrdu (3 s). Vraća funkciju koja poništava čekanje potvrde.
 */
export function confirmButton(btn, armedText, onConfirm) {
  const lbl = btn.querySelector('.lbl');
  const original = lbl.textContent;
  let timer;
  const reset = () => {
    clearTimeout(timer);
    delete btn.dataset.armed;
    lbl.textContent = original;
    btn.classList.remove('danger');
  };
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) { reset(); onConfirm(); return; }
    btn.dataset.armed = '1';
    lbl.textContent = armedText;
    btn.classList.add('danger');
    timer = setTimeout(reset, 3000);
  });
  return reset;
}

export function loadThumb(container, src, onError) {
  const im = new Image();
  im.alt = '';
  im.referrerPolicy = 'no-referrer';
  im.onerror = () => {
    // Kontejner je u međuvremenu mogao da dobije drugi sadržaj.
    if (im.parentNode !== container) return;
    im.remove();
    onError();
  };
  im.src = src;
  container.append(im);
}
