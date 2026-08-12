'use strict';

const crypto = require('crypto');

/**
 * Masking utilities — shared across all handlers.
 *
 * Masking types:
 *   partial      — keep first/last chars, mask middle  (default)
 *   redact       — replace entire value with [REDACTED]
 *   character    — replace each sensitive char with * preserving format
 *   pseudo       — replace with consistent pseudonym (PERSON_001, EMAIL_001, etc.)
 *   tokenization — replace with secure random crypto token (TKN_NAME_A7F291, TKN_EMAIL_4C82D1, etc.)
 */

// Pseudonym counters and maps — per processing session
// Pass a `pseudoMap` object per file; it persists across all cells in that file.
const PSEUDO_TYPE_MAP = {
  email:       'EMAIL',
  name:        'PERSON',
  phone_in:    'PHONE',
  phone_intl:  'PHONE',
  aadhaar:     'AADHAAR',
  pan:         'PAN',
  credit_card: 'CARD',
  dob:         'DOB',
  ipv4:        'IP',
  ipv6:        'IP',
  passport:    'PASSPORT',
};

const TOKEN_TYPE_MAP = {
  email:       'EMAIL',
  name:        'NAME',
  phone_in:    'PHONE',
  phone_intl:  'PHONE',
  phone:       'PHONE',
  aadhaar:     'AADHAAR',
  pan:         'PAN',
  credit_card: 'CARD',
  dob:         'DOB',
  ipv4:        'IP',
  ipv6:        'IP',
  passport:    'PASSPORT',
};

/**
 * Detect what PII type a value looks like (basic, for masking decisions).
 * Returns 'email' | 'aadhaar' | 'phone' | 'pan' | 'name' | 'generic'
 */
function detectType(value) {
  if (/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(value)) return 'email';
  if (/^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(value)) return 'aadhaar';
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) return 'pan';
  if (/^(?:\+91|0)?[6-9]\d{9}$/.test(value)) return 'phone';
  if (/^\+[1-9]\d{1,3}[\s\-]?\d{6,14}$/.test(value)) return 'phone';
  if (/^(?:\d{4}[\s\-]?){3}\d{4}$/.test(value)) return 'credit_card';
  if (/^(?:[A-Z][a-z]+)(?:\s[A-Z][a-z]+){1,3}$/.test(value)) return 'name';
  return 'generic';
}

// ── Partial Masking ───────────────────────────────────────────────────────────

function partialMask(value, fieldName) {
  if (typeof value !== 'string' || value === '') return value;
  const type = detectType(value);

  if (type === 'email') {
    const [local, domain] = value.split('@');
    const masked = local.length <= 1 ? '*' : local[0] + '*'.repeat(Math.min(local.length - 1, 4));
    return `${masked}@${domain}`;
  }
  if (type === 'aadhaar') {
    const digits = value.replace(/\D/g, '');
    return 'XXXX XXXX ' + digits.slice(-4);
  }
  if (type === 'phone') {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 4
      ? '*'.repeat(digits.length - 4) + digits.slice(-4)
      : '*'.repeat(value.length);
  }
  if (type === 'pan') {
    return value.length >= 10
      ? value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2)
      : value[0] + '*'.repeat(Math.max(value.length - 2, 1)) + value.slice(-1);
  }
  if (type === 'name') {
    return value.split(' ').map(w =>
      w.length <= 1 ? w : w[0] + '*'.repeat(Math.min(w.length - 1, 4))
    ).join(' ');
  }
  // generic
  if (value.length <= 2) return '*'.repeat(value.length);
  return value[0] + '*'.repeat(Math.max(value.length - 2, 1)) + value[value.length - 1];
}

// ── Full Redaction ────────────────────────────────────────────────────────────

function redactFull() {
  return '[REDACTED]';
}

// ── Character Masking ─────────────────────────────────────────────────────────

function characterMask(value) {
  if (typeof value !== 'string' || value === '') return value;
  const type = detectType(value);

  if (type === 'email') {
    const [local, domain] = value.split('@');
    const domainParts = domain.split('.');
    // Mask local entirely, keep domain visible (public info anyway)
    return '*'.repeat(local.length) + '@' + domain;
  }
  if (type === 'pan') {
    // AAAAA9999A → A****9999*
    return value[0] + '*'.repeat(4) + value.slice(5, 9) + '*';
  }
  if (type === 'aadhaar') {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 4).replace(/\d/g, '*') + ' ' +
           digits.slice(4, 8).replace(/\d/g, '*') + ' ' +
           digits.slice(8);
  }
  if (type === 'phone') {
    const digits = value.replace(/\D/g, '');
    return '*'.repeat(Math.max(digits.length - 4, 0)) + digits.slice(-4);
  }
  // generic: replace every char with *
  return '*'.repeat(value.length);
}

// ── Pseudonymization ──────────────────────────────────────────────────────────

function pseudoMask(value, pseudoMap, piiType) {
  if (!pseudoMap) pseudoMap = {};

  // Already assigned?
  if (pseudoMap[value] !== undefined) return pseudoMap[value];

  const type = detectType(value);
  const category = PSEUDO_TYPE_MAP[piiType] || PSEUDO_TYPE_MAP[type] || 'VALUE';

  // Count existing pseudonyms of this category
  const existingCount = Object.values(pseudoMap).filter(v => v.startsWith(category + '_')).length;
  const pseudonym = `${category}_${String(existingCount + 1).padStart(3, '0')}`;
  pseudoMap[value] = pseudonym;
  return pseudonym;
}

// ── Tokenization ──────────────────────────────────────────────────────────────

function tokenMask(value, tokenMap, piiType) {
  if (!tokenMap) tokenMap = {};

  // Session consistency: same sensitive value gets same token within operation
  if (tokenMap[value] !== undefined) return tokenMap[value];

  const type = detectType(value);
  const category = TOKEN_TYPE_MAP[piiType] || TOKEN_TYPE_MAP[type] || 'DATA';

  // Generate 6 uppercase random hex digits using Node.js crypto
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const token = `TKN_${category}_${hex}`;

  tokenMap[value] = token;
  return token;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Mask a value using the specified masking type.
 *
 * @param {string} value        The raw sensitive value
 * @param {string} [fieldName]  Column/field name hint
 * @param {string} [maskingType] 'partial' | 'redact' | 'character' | 'pseudo' | 'tokenization'
 * @param {object} [pseudoMap]   Shared map for pseudonymization / tokenization consistency
 * @param {string} [piiType]     Detected PII type from sensitive-data-detector
 * @returns {string}
 */
function maskValue(value, fieldName, maskingType, pseudoMap, piiType) {
  if (typeof value !== 'string' || value === '') return value;

  const type = (maskingType || 'partial').toLowerCase();
  switch (type) {
    case 'redact':
      return redactFull();
    case 'character':
      return characterMask(value);
    case 'pseudo':
    case 'pseudonymization':
      return pseudoMask(value, pseudoMap, piiType);
    case 'token':
    case 'tokenization':
      return tokenMask(value, pseudoMap, piiType);
    case 'partial':
    default:
      return partialMask(value, fieldName);
  }
}

module.exports = { maskValue, partialMask, redactFull, characterMask, pseudoMask, tokenMask };

