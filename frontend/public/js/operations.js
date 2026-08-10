/**
 * operations.js
 * Manages operation cards (Mask/Hash/Encrypt) and settings panels.
 * Exports: initOperations()
 */

export function initOperations() {
  const cards       = document.querySelectorAll('.op-card');
  const opSettings  = document.getElementById('op-settings');
  const settingsMask    = document.getElementById('settings-mask');
  const settingsHash    = document.getElementById('settings-hash');
  const settingsEnc     = document.getElementById('settings-encrypt');
  const pwInput         = document.getElementById('encrypt-password');
  const togglePwBtn     = document.getElementById('toggle-password');
  const eyeOpen         = document.getElementById('eye-open');
  const eyeClosed       = document.getElementById('eye-closed');
  const hashAlgoSelect  = document.getElementById('hash-algorithm');
  const encAlgoSelect   = document.getElementById('enc-algorithm');

  let selected = null;

  const panelMap = {
    mask:    settingsMask,
    hash:    settingsHash,
    encrypt: settingsEnc,
  };

  function selectOperation(op) {
    selected = op;

    cards.forEach(card => {
      const isSelected = card.dataset.operation === op;
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      card.classList.remove('op-card-mask', 'op-card-hash', 'op-card-encrypt');
      card.classList.add(`op-card-${card.dataset.operation}`);
    });

    Object.entries(panelMap).forEach(([key, panel]) => {
      panel.classList.toggle('hidden', key !== op);
    });
    opSettings.classList.remove('hidden');
    opSettings.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  cards.forEach(card => {
    card.classList.add(`op-card-${card.dataset.operation}`);
    card.addEventListener('click', () => selectOperation(card.dataset.operation));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectOperation(card.dataset.operation);
      }
    });
  });

  // Toggle password visibility
  togglePwBtn.addEventListener('click', () => {
    const isPassword = pwInput.type === 'password';
    pwInput.type = isPassword ? 'text' : 'password';
    eyeOpen.classList.toggle('hidden', isPassword);
    eyeClosed.classList.toggle('hidden', !isPassword);
  });

  return {
    getOperation() { return selected; },

    getOptions() {
      const algorithm   = hashAlgoSelect ? hashAlgoSelect.value : 'sha256';
      const hashMode    = document.querySelector('input[name="hash-mode"]:checked')?.value || 'sensitive';
      const maskingType = document.querySelector('input[name="masking-type"]:checked')?.value || 'partial';
      const encAlgorithm = encAlgoSelect ? encAlgoSelect.value : 'aes-256-gcm';
      const password    = pwInput.value;
      return { algorithm, hashMode, maskingType, encAlgorithm, password };
    },

    reset() {
      selected = null;
      cards.forEach(c => c.setAttribute('aria-checked', 'false'));
      opSettings.classList.add('hidden');
      Object.values(panelMap).forEach(p => p.classList.add('hidden'));
      pwInput.value = '';
      pwInput.type  = 'password';
      eyeOpen.classList.remove('hidden');
      eyeClosed.classList.add('hidden');
      // Reset masking type to partial
      const partialRadio = document.getElementById('mask-partial');
      if (partialRadio) partialRadio.checked = true;
      // Reset hash mode
      const sensitiveRadio = document.getElementById('hash-mode-sensitive');
      if (sensitiveRadio) sensitiveRadio.checked = true;
      // Reset algorithms
      if (hashAlgoSelect) hashAlgoSelect.value = 'sha256';
      if (encAlgoSelect)  encAlgoSelect.value  = 'aes-256-gcm';
    }
  };
}
