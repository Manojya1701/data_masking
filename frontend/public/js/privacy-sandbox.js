'use strict';

/**
 * privacy-sandbox.js — Real-Time Interactive Privacy Sandbox & 6-Way Transformation Matrix
 *
 * Provides real-time, zero-latency detection and simultaneous 6-way transformation
 * across:
 * 1. Partial Masking
 * 2. Full Redaction
 * 3. Character Masking
 * 4. Pseudonymization
 * 5. Crypto Tokenization
 * 6. Base64 Reversible Tokenization (with live 1-click decode!)
 */

import { showToast } from './toast.js';

const PRESETS = {
  customer: `Vikram Patel, Email: vikram.patel@example.com, Phone: +91 9876543210, City: Bengaluru`,
  financial: `Priya Sharma, PAN: ABCDE1234F, Card: 4532 8910 2345 6789, Account: ACC-90812`,
  identity: `Rahul Verma, Aadhaar: 2345 6789 0123, IP: 192.168.1.104, Status: Active`,
  json: `{\n  "name": "Ananya Roy",\n  "email": "ananya.roy@segmento.io",\n  "phone": "9812345678",\n  "pan": "BNZPK9876Q"\n}`,
};

const PSEUDO_TYPE_MAP = {
  email: 'EMAIL',
  name: 'PERSON',
  phone: 'PHONE',
  aadhaar: 'AADHAAR',
  pan: 'PAN',
  credit_card: 'CARD',
  ip: 'IP',
};

const TOKEN_TYPE_MAP = {
  email: 'EMAIL',
  name: 'NAME',
  phone: 'PHONE',
  aadhaar: 'AADHAAR',
  pan: 'PAN',
  credit_card: 'CARD',
  ip: 'IP',
};

/**
 * Detect all PII entities inside a string with their ranges and types.
 */
function scanEntities(text) {
  if (!text || typeof text !== 'string') return [];

  const entities = [];

  // 1. Email Regex
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  let match;
  while ((match = emailRe.exec(text)) !== null) {
    entities.push({ text: match[0], type: 'email', start: match.index, end: match.index + match[0].length });
  }

  // 2. Aadhaar Regex: 12 digits with spaces or hyphens
  const aadhaarRe = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g;
  while ((match = aadhaarRe.exec(text)) !== null) {
    entities.push({ text: match[0], type: 'aadhaar', start: match.index, end: match.index + match[0].length });
  }

  // 3. PAN Regex: 5 uppercase letters, 4 digits, 1 uppercase letter
  const panRe = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
  while ((match = panRe.exec(text)) !== null) {
    entities.push({ text: match[0], type: 'pan', start: match.index, end: match.index + match[0].length });
  }

  // 4. Credit Card: 16 digits
  const cardRe = /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g;
  while ((match = cardRe.exec(text)) !== null) {
    // Avoid colliding with Aadhaar
    if (!entities.some(e => e.start <= match.index && e.end >= match.index + match[0].length)) {
      entities.push({ text: match[0], type: 'credit_card', start: match.index, end: match.index + match[0].length });
    }
  }

  // 5. Phone Regex: Indian (+91/0) or Intl
  const phoneRe = /(?:\+91|0)?[6-9]\d{9}|\+[1-9]\d{1,3}[\s\-]?\d{6,14}/g;
  while ((match = phoneRe.exec(text)) !== null) {
    if (!entities.some(e => e.start <= match.index && e.end >= match.index + match[0].length)) {
      entities.push({ text: match[0], type: 'phone', start: match.index, end: match.index + match[0].length });
    }
  }

  // 6. IPv4 Address
  const ipRe = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  while ((match = ipRe.exec(text)) !== null) {
    entities.push({ text: match[0], type: 'ip', start: match.index, end: match.index + match[0].length });
  }

  // 7. Names: Capitalized multi-word phrases (e.g. Vikram Patel, Priya Sharma)
  const nameRe = /\b[A-Z][a-z]{1,15}\s[A-Z][a-z]{1,15}(?:\s[A-Z][a-z]{1,15})?\b/g;
  while ((match = nameRe.exec(text)) !== null) {
    // Check if not overlapping with previous entities or keywords
    const lower = match[0].toLowerCase();
    if (!lower.includes('customer') && !lower.includes('account') && !lower.includes('email') && !lower.includes('phone')) {
      if (!entities.some(e => e.start <= match.index && e.end >= match.index + match[0].length)) {
        entities.push({ text: match[0], type: 'name', start: match.index, end: match.index + match[0].length });
      }
    }
  }

  // Sort by start position
  entities.sort((a, b) => a.start - b.start);

  // Deduplicate overlapping spans (keep the first/longest)
  const deduped = [];
  let lastEnd = -1;
  for (const ent of entities) {
    if (ent.start >= lastEnd) {
      deduped.push(ent);
      lastEnd = ent.end;
    }
  }

  return deduped;
}

// ── Masking Transforms ────────────────────────────────────────────────────────

function partialMaskValue(val, type) {
  if (!val) return val;
  if (type === 'email') {
    const parts = val.split('@');
    if (parts.length === 2) {
      const u = parts[0];
      const masked = u.length <= 1 ? '*' : u[0] + '*'.repeat(Math.min(u.length - 1, 4));
      return `${masked}@${parts[1]}`;
    }
  }
  if (type === 'aadhaar') {
    const digits = val.replace(/\D/g, '');
    return 'XXXX XXXX ' + digits.slice(-4);
  }
  if (type === 'phone') {
    const digits = val.replace(/\D/g, '');
    return digits.length >= 4 ? '*'.repeat(digits.length - 4) + digits.slice(-4) : '******' + digits.slice(-2);
  }
  if (type === 'pan') {
    return val.length >= 10 ? val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2) : val[0] + '*****' + val.slice(-1);
  }
  if (type === 'credit_card') {
    const digits = val.replace(/\D/g, '');
    return '**** **** **** ' + digits.slice(-4);
  }
  if (type === 'name') {
    return val.split(' ').map(w => (w.length <= 1 ? w : w[0] + '*'.repeat(Math.min(w.length - 1, 4)))).join(' ');
  }
  return val.length <= 2 ? '*'.repeat(val.length) : val[0] + '*'.repeat(Math.max(val.length - 2, 1)) + val[val.length - 1];
}

function characterMaskValue(val, type) {
  if (!val) return val;
  if (type === 'email') {
    const parts = val.split('@');
    return '*'.repeat(parts[0].length) + '@' + parts[1];
  }
  if (type === 'pan') {
    return val[0] + '****' + val.slice(5, 9) + '*';
  }
  if (type === 'aadhaar') {
    return '**** **** ' + val.replace(/\D/g, '').slice(-4);
  }
  if (type === 'phone') {
    const d = val.replace(/\D/g, '');
    return '*'.repeat(Math.max(d.length - 4, 0)) + d.slice(-4);
  }
  return '*'.repeat(val.length);
}

function encodeBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

function decodeBase64(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return atob(b64);
  }
}

/**
 * Apply a transformation across all detected entities in text.
 */
function applyTransform(text, entities, transformFn) {
  if (!entities.length) return text;

  let out = '';
  let cursor = 0;

  for (const ent of entities) {
    out += text.slice(cursor, ent.start);
    out += transformFn(ent.text, ent.type);
    cursor = ent.end;
  }
  out += text.slice(cursor);
  return out;
}

// ── Public Initialization ─────────────────────────────────────────────────────

export function initPrivacySandbox() {
  const inputEl          = document.getElementById('sandbox-input');
  const charCountEl      = document.getElementById('sandbox-char-count');
  const detectedBadgeEl  = document.getElementById('sandbox-detected-badge');
  const chipsContainerEl = document.getElementById('sandbox-chips-container');
  const riskPillEl       = document.getElementById('sandbox-risk-pill');

  const outPartialEl     = document.getElementById('sandbox-out-partial');
  const outRedactEl      = document.getElementById('sandbox-out-redact');
  const outCharacterEl   = document.getElementById('sandbox-out-character');
  const outPseudoEl      = document.getElementById('sandbox-out-pseudo');
  const outTokenEl       = document.getElementById('sandbox-out-token');
  const outBase64El      = document.getElementById('sandbox-out-base64');

  const decodeBtn        = document.getElementById('sandbox-decode-btn');
  const decodedPreviewEl = document.getElementById('sandbox-decoded-preview');
  const decodedTextEl    = document.getElementById('sandbox-decoded-text');
  const clearBtn         = document.getElementById('sandbox-clear-btn');
  const presetBtns       = document.querySelectorAll('.sandbox-preset-btn');
  const copyBtns         = document.querySelectorAll('.sandbox-copy-btn');

  if (!inputEl || !outBase64El) return;

  function update() {
    const raw = inputEl.value;
    charCountEl.textContent = `${raw.length} chars`;

    // Reset decode box on text edit
    decodedPreviewEl.classList.add('hidden');

    const entities = scanEntities(raw);

    // 1. Update Telemetry
    if (entities.length > 0) {
      detectedBadgeEl.textContent = `✓ ${entities.length} Sensitive ${entities.length === 1 ? 'Entity' : 'Entities'} Detected`;
      detectedBadgeEl.className = 'meta-pill success';

      const typeCounts = {};
      entities.forEach(e => {
        typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      });

      chipsContainerEl.innerHTML = Object.entries(typeCounts).map(([t, count]) => {
        const typeLabels = {
          email: 'Email',
          phone: 'Phone',
          pan: 'PAN',
          aadhaar: 'Aadhaar',
          credit_card: 'Card',
          ip: 'IP',
          name: 'Name',
        };
        return `<span class="meta-pill neutral" style="font-size:0.75rem; text-transform:uppercase;">${typeLabels[t] || t} (${count})</span>`;
      }).join('');

      // Risk score calculation
      let score = Math.min(100, entities.length * 25);
      if (entities.some(e => e.type === 'pan' || e.type === 'aadhaar' || e.type === 'credit_card')) {
        score = Math.max(score, 85);
      }
      riskPillEl.textContent = `HIGH RISK (${score}/100)`;
      riskPillEl.className = 'meta-pill danger';
    } else {
      detectedBadgeEl.textContent = raw.trim() ? 'No PII Detected' : 'Waiting for Input…';
      detectedBadgeEl.className = 'meta-pill neutral';
      chipsContainerEl.innerHTML = '<span style="font-size:0.78rem; color:var(--text-muted);">None</span>';
      riskPillEl.textContent = 'SAFE (0/100)';
      riskPillEl.className = 'meta-pill success';
    }

    if (!raw.trim()) {
      outPartialEl.textContent = '—';
      outRedactEl.textContent = '—';
      outCharacterEl.textContent = '—';
      outPseudoEl.textContent = '—';
      outTokenEl.textContent = '—';
      outBase64El.textContent = '—';
      return;
    }

    // 2. Compute 6 Outputs
    // Mode 1: Partial
    outPartialEl.textContent = applyTransform(raw, entities, (val, type) => partialMaskValue(val, type));

    // Mode 2: Redact
    outRedactEl.textContent = applyTransform(raw, entities, () => '[REDACTED]');

    // Mode 3: Character
    outCharacterEl.textContent = applyTransform(raw, entities, (val, type) => characterMaskValue(val, type));

    // Mode 4: Pseudonymization (Session Consistent)
    const pseudoMap = {};
    outPseudoEl.textContent = applyTransform(raw, entities, (val, type) => {
      if (pseudoMap[val]) return pseudoMap[val];
      const category = PSEUDO_TYPE_MAP[type] || 'VALUE';
      const count = Object.values(pseudoMap).filter(v => v.startsWith(category + '_')).length;
      const pseudo = `${category}_${String(count + 1).padStart(3, '0')}`;
      pseudoMap[val] = pseudo;
      return pseudo;
    });

    // Mode 5: Tokenization
    const tokenMap = {};
    outTokenEl.textContent = applyTransform(raw, entities, (val, type) => {
      if (tokenMap[val]) return tokenMap[val];
      const category = TOKEN_TYPE_MAP[type] || 'DATA';
      let hash = 0;
      for (let i = 0; i < val.length; i++) hash = ((hash << 5) - hash) + val.charCodeAt(i);
      const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
      const token = `TKN_${category}_${hex}`;
      tokenMap[val] = token;
      return token;
    });

    // Mode 6: Base64 Tokenize (Hero)
    outBase64El.textContent = applyTransform(raw, entities, (val) => `BASE64[${encodeBase64(val)}]`);
  }

  // Live Input Listener
  inputEl.addEventListener('input', update);

  // Clear Button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      update();
      inputEl.focus();
    });
  }

  // Presets
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      if (PRESETS[presetKey]) {
        inputEl.value = PRESETS[presetKey];
        update();
        showToast(`✓ Loaded ${btn.textContent.trim()} preset`, 'info');
      }
    });
  });

  // Base64 Live Decode Button
  if (decodeBtn) {
    decodeBtn.addEventListener('click', () => {
      const b64Text = outBase64El.textContent;
      if (!b64Text || b64Text === '—' || !b64Text.includes('BASE64[')) {
        showToast('No Base64 tokens to decode. Type or select a preset first.', 'warning');
        return;
      }

      const decoded = b64Text.replace(/BASE64\[([A-Za-z0-9+/=]+)\]/g, (_, token) => {
        try {
          return decodeBase64(token);
        } catch {
          return token;
        }
      });

      decodedTextEl.textContent = decoded;
      decodedPreviewEl.classList.remove('hidden');

      // Pulse animation effect on the hero card
      outBase64El.style.borderColor = 'var(--cyan)';
      setTimeout(() => {
        outBase64El.style.borderColor = 'rgba(34,197,94,0.3)';
      }, 800);

      showToast('✓ Decoded all Base64 tokens back to original plaintext!', 'success');
    });
  }

  // Copy Buttons
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl && targetEl.textContent && targetEl.textContent !== '—') {
        navigator.clipboard.writeText(targetEl.textContent).then(() => {
          const originalText = btn.textContent;
          btn.textContent = '✓ Copied!';
          btn.style.color = 'var(--green)';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = '';
          }, 1500);
        });
      }
    });
  });

  // Set default initial customer preset so the sandbox is immediately visually active!
  inputEl.value = PRESETS.customer;
  update();
}
