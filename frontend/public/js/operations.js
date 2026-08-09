/**
 * operations.js
 * Manages operation cards (Mask/Hash/Encrypt) and settings panels.
 * Exports: initOperations()
 */

export function initOperations() {
  const cards = document.querySelectorAll('.op-card');
  const opSettings   = document.getElementById('op-settings');
  const settingsMask = document.getElementById('settings-mask');
  const settingsHash = document.getElementById('settings-hash');
  const settingsEnc  = document.getElementById('settings-encrypt');
  const pwInput      = document.getElementById('encrypt-password');
  const togglePwBtn  = document.getElementById('toggle-password');
  const eyeOpen      = document.getElementById('eye-open');
  const eyeClosed    = document.getElementById('eye-closed');

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
      // Add glow class based on op
      card.classList.remove('op-card-mask', 'op-card-hash', 'op-card-encrypt');
      card.classList.add(`op-card-${card.dataset.operation}`);
    });

    // Show/hide settings
    Object.entries(panelMap).forEach(([key, panel]) => {
      panel.classList.toggle('hidden', key !== op);
    });
    opSettings.classList.remove('hidden');

    // Smooth scroll to settings
    opSettings.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  cards.forEach(card => {
    // Init class
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
      const algo = document.querySelector('input[name="hash-algorithm"]:checked')?.value || 'sha256';
      const password = pwInput.value;
      return { algorithm: algo, password };
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
    }
  };
}
