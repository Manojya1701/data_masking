'use strict';

/**
 * Sensitive Data Detector
 * Detects common PII via regex patterns and field-name heuristics.
 * Completely independent of file parsing — works on raw string values.
 */

// ─── Pattern Registry ────────────────────────────────────────────────────────

const PATTERNS = [
  {
    type: 'email',
    regex: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    priority: 10,
  },
  {
    type: 'phone_in',
    // Indian mobile: 10 digits optionally prefixed by +91 or 0
    regex: /^(?:\+91|0)?[6-9]\d{9}$/,
    priority: 9,
  },
  {
    type: 'aadhaar',
    // 12-digit number, optionally space/dash separated in groups of 4
    regex: /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/,
    priority: 10,
  },
  {
    type: 'pan',
    // Permanent Account Number: AAAAA9999A
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    priority: 10,
  },
  {
    type: 'name',
    // Heuristic: 2-4 title-cased words
    regex: /^(?:[A-Z][a-z]+)(?:\s[A-Z][a-z]+){1,3}$/,
    priority: 3,
  },
  {
    type: 'phone_intl',
    // International phone: +CountryCode followed by 6-14 digits
    regex: /^\+[1-9]\d{1,3}[\s\-]?\d{6,14}$/,
    priority: 8,
  },
  {
    type: 'credit_card',
    regex: /^(?:\d{4}[\s\-]?){3}\d{4}$/,
    priority: 10,
  },
  {
    type: 'dob',
    regex: /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})$/,
    priority: 5,
  },
];

// Field/column name keywords that hint at sensitive data
const SENSITIVE_FIELD_NAMES = [
  'name', 'fullname', 'full_name', 'firstname', 'first_name',
  'lastname', 'last_name', 'email', 'e_mail', 'phone', 'mobile',
  'contact', 'aadhaar', 'aadhar', 'uid', 'pan', 'panno',
  'dob', 'birthdate', 'birth_date', 'dateofbirth',
  'address', 'addr', 'ssn', 'creditcard', 'credit_card',
  'card', 'cardnumber', 'card_number', 'passport', 'nid',
  'nationalid', 'national_id',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a raw string value matches any sensitive pattern.
 * @param {string} value
 * @returns {{ isSensitive: boolean, type: string|null, confidence: number }}
 */
function detectValue(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { isSensitive: false, type: null, confidence: 0 };
  }

  const trimmed = value.trim();

  // Run patterns in priority order
  const sorted = [...PATTERNS].sort((a, b) => b.priority - a.priority);
  for (const pattern of sorted) {
    if (pattern.regex.test(trimmed)) {
      return { isSensitive: true, type: pattern.type, confidence: pattern.priority };
    }
  }

  return { isSensitive: false, type: null, confidence: 0 };
}

/**
 * Check whether a field/column name is a known sensitive field.
 * @param {string} fieldName
 * @returns {boolean}
 */
function isSensitiveField(fieldName) {
  if (typeof fieldName !== 'string') return false;
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_FIELD_NAMES.some(f => normalized === f.replace(/[^a-z0-9]/g, ''));
}

/**
 * Decides whether to protect a value, using both field name and value patterns.
 * Field-name match is enough; value-pattern match is also enough.
 * @param {string} value
 * @param {string|null} [fieldName]
 * @returns {{ protect: boolean, reason: string|null }}
 */
function shouldProtect(value, fieldName) {
  if (fieldName && isSensitiveField(fieldName)) {
    return { protect: true, reason: 'field_name' };
  }
  const result = detectValue(value);
  if (result.isSensitive) {
    return { protect: true, reason: result.type };
  }
  return { protect: false, reason: null };
}

module.exports = { detectValue, isSensitiveField, shouldProtect, PATTERNS, SENSITIVE_FIELD_NAMES };
