'use strict';

/**
 * Protection Preview Module (Before vs After)
 * Provides visual 2-column comparison showing how sensitive fields are transformed
 * across Masking, Tokenization, Hashing, and Encryption operations.
 */

let activeMethod = 'mask';
let sampleDataItems = [];

// Fallback realistic PII sample template
const DEFAULT_SAMPLES = [
  { fieldName: 'Full Name', rawValue: 'Harika Sharma', piiType: 'NAME', piiBadge: 'PII · NAME' },
  { fieldName: 'Email Address', rawValue: 'harika.sharma@example.com', piiType: 'EMAIL', piiBadge: 'PII · EMAIL' },
  { fieldName: 'Phone Number', rawValue: '9876543210', piiType: 'PHONE', piiBadge: 'PII · PHONE' },
  { fieldName: 'Aadhaar Number', rawValue: '1234 5678 9012', piiType: 'AADHAAR', piiBadge: 'PII · AADHAAR' },
  { fieldName: 'PAN Card', rawValue: 'ABCDE1234F', piiType: 'PAN', piiBadge: 'PII · PAN' },
  { fieldName: 'Credit Card', rawValue: '4532 8910 2345 6789', piiType: 'CREDIT_CARD', piiBadge: 'PII · CREDIT CARD' },
];

/**
 * Transforms a raw PII string based on selected protection method.
 */
export function transformValue(val, type, method) {
  if (!val) return '';

  if (method === 'mask') {
    switch (type) {
      case 'EMAIL': {
        const parts = val.split('@');
        if (parts.length === 2) {
          const user = parts[0];
          const maskedUser = user.length > 2 ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1] : user[0] + '*';
          return `${maskedUser}@${parts[1]}`;
        }
        return val.replace(/./g, '*');
      }
      case 'PHONE': {
        const clean = val.replace(/\s+/g, '');
        if (clean.length >= 10) {
          return '*'.repeat(clean.length - 4) + clean.slice(-4);
        }
        return '******' + val.slice(-4);
      }
      case 'AADHAAR': {
        const clean = val.replace(/[\s\-]/g, '');
        if (clean.length === 12) {
          return '********' + clean.slice(-4);
        }
        return '********9012';
      }
      case 'PAN': {
        if (val.length === 10) {
          return val[0] + '*****' + val.slice(-4);
        }
        return 'A*****34F';
      }
      case 'CREDIT_CARD': {
        const clean = val.replace(/[\s\-]/g, '');
        if (clean.length >= 16) {
          return clean.slice(0, 4) + ' **** **** ' + clean.slice(-4);
        }
        return '4532 **** **** 6789';
      }
      case 'NAME':
      default: {
        const words = val.split(' ');
        return words.map(w => w.length > 1 ? w[0] + '*'.repeat(w.length - 1) : w[0] + '*').join(' ');
      }
    }
  }

  if (method === 'tokenize') {
    const shortHash = Math.abs(hashCode(val)).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
    return `TOKEN-${shortHash}`;
  }

  if (method === 'hash') {
    const hex = Math.abs(hashCode(val + 'salt')).toString(16).padStart(8, '0');
    return `SHA-256: ${hex.slice(0, 4)}...${hex.slice(-4)}`;
  }

  if (method === 'encrypt') {
    // Safe illustrative representation (no private keys exposed)
    const hexSnippet = Math.abs(hashCode(val + 'enc')).toString(16).toUpperCase().padStart(8, '0');
    return `AES-256-GCM: [0x${hexSnippet}...89B]`;
  }

  return val;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Populate BEFORE vs AFTER preview lists based on detected PII scan counts.
 */
export function renderPreviewComparison(scanCounts = {}) {
  const typeMap = {
    email:       { fieldName: 'Email Address', rawValue: 'harika.sharma@example.com', type: 'EMAIL', badge: 'PII · EMAIL' },
    phone_in:   { fieldName: 'Phone Number (IN)', rawValue: '9876543210', type: 'PHONE', badge: 'PII · PHONE' },
    phone_intl: { fieldName: 'Phone Number', rawValue: '+1 987 654 3210', type: 'PHONE', badge: 'PII · PHONE' },
    aadhaar:    { fieldName: 'Aadhaar Number', rawValue: '1234 5678 9012', type: 'AADHAAR', badge: 'PII · AADHAAR' },
    pan:        { fieldName: 'PAN Card', rawValue: 'ABCDE1234F', type: 'PAN', badge: 'PII · PAN' },
    name:       { fieldName: 'Full Name', rawValue: 'Harika Sharma', type: 'NAME', badge: 'PII · NAME' },
    credit_card:{ fieldName: 'Credit Card', rawValue: '4532 8910 2345 6789', type: 'CREDIT_CARD', badge: 'PII · CREDIT CARD' },
  };

  sampleDataItems = [];
  const detectedKeys = Object.keys(scanCounts).filter(k => scanCounts[k] > 0);

  if (detectedKeys.length > 0) {
    detectedKeys.forEach(key => {
      if (typeMap[key]) {
        sampleDataItems.push(typeMap[key]);
      }
    });
  }

  if (sampleDataItems.length === 0) {
    sampleDataItems = DEFAULT_SAMPLES.slice(0, 4);
  }

  updateLists();
}

export function updateLists() {
  const beforeContainer   = document.getElementById('prot-preview-before-list');
  const afterContainer    = document.getElementById('prot-preview-after-list');
  const activeMethodLabel = document.getElementById('prot-active-method-name');
  const footerCount       = document.getElementById('prot-footer-count');

  if (!beforeContainer || !afterContainer) return;

  const methodNames = {
    mask:     'Pattern Masking',
    tokenize: 'Format-Preserving Tokenization',
    hash:     'Cryptographic Hashing (HMAC-SHA256)',
    encrypt:  'AES-256-GCM Encryption',
  };

  if (activeMethodLabel) {
    activeMethodLabel.textContent = methodNames[activeMethod] || activeMethod;
  }

  if (footerCount) {
    footerCount.textContent = `${sampleDataItems.length} sensitive fields protected`;
  }

  // Render BEFORE column
  beforeContainer.innerHTML = sampleDataItems.map(item => `
    <div class="prot-item-card">
      <div class="prot-item-header">
        <span class="prot-item-label">${escapeHtml(item.fieldName)}</span>
        <span class="prot-pii-chip">${escapeHtml(item.badge)}</span>
      </div>
      <div class="prot-item-val before-val">${escapeHtml(item.rawValue)}</div>
    </div>
  `).join('');

  // Render AFTER column
  afterContainer.innerHTML = sampleDataItems.map(item => {
    const transformed = transformValue(item.rawValue, item.type, activeMethod);
    return `
      <div class="prot-item-card after-card">
        <div class="prot-item-header">
          <span class="prot-item-label">${escapeHtml(item.fieldName)}</span>
          <span class="prot-method-tag ${activeMethod}">${activeMethod.toUpperCase()}</span>
        </div>
        <div class="prot-item-val after-val ${activeMethod}">${escapeHtml(transformed)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Initializes modal event listeners and controls.
 */
export function initProtectionPreview(onApplyCallback) {
  const modal     = document.getElementById('protection-preview-modal');
  const backdrop  = document.getElementById('prot-preview-backdrop');
  const closeBtn  = document.getElementById('prot-preview-close-btn');
  const cancelBtn = document.getElementById('prot-preview-cancel-btn');
  const applyBtn  = document.getElementById('prot-apply-btn');
  const tabs      = document.querySelectorAll('.prot-method-tab');

  function openModal() {
    const targetModal = document.getElementById('protection-preview-modal');
    if (!targetModal) return;

    if (sampleDataItems.length === 0) {
      renderPreviewComparison({});
    } else {
      updateLists();
    }

    targetModal.classList.remove('hidden');
  }

  function closeModal() {
    const targetModal = document.getElementById('protection-preview-modal');
    if (targetModal) targetModal.classList.add('hidden');
  }

  // Document-level delegated click handler for any open button
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('#btn-open-protection-preview, .btn-open-protection-preview, [data-action="protection-preview"]');
    if (trigger) {
      e.preventDefault();
      openModal();
    }
  });

  if (closeBtn)  closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (backdrop)  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const targetModal = document.getElementById('protection-preview-modal');
      if (targetModal && !targetModal.classList.contains('hidden')) {
        closeModal();
      }
    }
  });

  // Method tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeMethod = tab.dataset.method || 'mask';
      updateLists();
    });
  });

  // Apply button handler
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      closeModal();
      if (typeof onApplyCallback === 'function') {
        onApplyCallback(activeMethod);
      }
    });
  }
}
