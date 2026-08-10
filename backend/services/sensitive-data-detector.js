'use strict';

/**
 * Sensitive Data Detector
 * Detects common PII via regex patterns and field-name heuristics.
 * Completely independent of file parsing — works on raw string values.
 *
 * Each pattern has an `enabled` flag so callers can selectively disable detection.
 */

// ─── Pattern Registry ─────────────────────────────────────────────────────────

const PATTERNS = [
  {
    type: 'email',
    regex: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    priority: 10,
    enabled: true,
  },
  {
    type: 'phone_in',
    // Indian mobile: 10 digits optionally prefixed by +91 or 0
    regex: /^(?:\+91|0)?[6-9]\d{9}$/,
    priority: 9,
    enabled: true,
  },
  {
    type: 'aadhaar',
    // 12-digit number, optionally space/dash separated in groups of 4
    regex: /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/,
    priority: 10,
    enabled: true,
  },
  {
    type: 'pan',
    // Permanent Account Number: AAAAA9999A
    regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    priority: 10,
    enabled: true,
  },
  {
    type: 'credit_card',
    regex: /^(?:\d{4}[\s\-]?){3}\d{4}$/,
    priority: 10,
    enabled: true,
  },
  {
    type: 'dob',
    regex: /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})$/,
    priority: 5,
    enabled: true,
  },
  {
    type: 'phone_intl',
    // International phone: +CountryCode followed by 6-14 digits
    regex: /^\+[1-9]\d{1,3}[\s\-]?\d{6,14}$/,
    priority: 8,
    enabled: true,
  },
  {
    type: 'ipv4',
    regex: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    priority: 6,
    enabled: true,
  },
  {
    type: 'ipv6',
    // Basic compressed/full IPv6
    regex: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/,
    priority: 6,
    enabled: true,
  },
  {
    type: 'passport',
    // Generic passport format: 1-2 letters followed by 6-7 digits
    regex: /^[A-Z]{1,2}\d{6,7}$/,
    priority: 7,
    enabled: true,
  },
  {
    type: 'name',
    // Heuristic: 2-4 title-cased words, each 2+ chars
    regex: /^(?:[A-Z][a-z]{1,})(?:\s[A-Z][a-z]{1,}){1,3}$/,
    priority: 3,
    enabled: true,
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
  'nationalid', 'national_id', 'ip', 'ipaddress', 'ip_address',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a raw string value matches any sensitive pattern.
 * @param {string} value
 * @param {object} [opts]
 * @param {string[]} [opts.disabledTypes]  Types to skip (e.g. ['name', 'dob'])
 * @returns {{ isSensitive: boolean, type: string|null, confidence: number }}
 */
function detectValue(value, opts = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { isSensitive: false, type: null, confidence: 0 };
  }

  const trimmed = value.trim();
  const disabled = new Set(opts.disabledTypes || []);

  // Run patterns in priority order
  const sorted = [...PATTERNS]
    .filter(p => p.enabled && !disabled.has(p.type))
    .sort((a, b) => b.priority - a.priority);

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
  // Exact match first
  if (SENSITIVE_FIELD_NAMES.some(f => normalized === f.replace(/[^a-z0-9]/g, ''))) return true;
  // Substring match: column names like "email_address", "phone_number", "card_number"
  const sensitiveKeywords = ['email', 'phone', 'mobile', 'aadhaar', 'aadhar', 'pan', 'dob', 'birth',
    'creditcard', 'card', 'passport', 'national', 'ssn', 'ip', 'address', 'contact', 'uid'];
  return sensitiveKeywords.some(kw => normalized.includes(kw));
}

/**
 * Decides whether to protect a value, using both field name and value patterns.
 * @param {string} value
 * @param {string|null} [fieldName]
 * @param {object} [opts]   Passed to detectValue
 * @returns {{ protect: boolean, reason: string|null, type: string|null }}
 */
function shouldProtect(value, fieldName, opts = {}) {
  if (fieldName && isSensitiveField(fieldName)) {
    const result = detectValue(value, opts);
    return { protect: true, reason: 'field_name', type: result.type || 'generic' };
  }
  const result = detectValue(value, opts);
  if (result.isSensitive) {
    return { protect: true, reason: result.type, type: result.type };
  }
  return { protect: false, reason: null, type: null };
}

/**
 * Scan a text string or array of strings and return counts by PII type.
 * Used for the Privacy Scan feature.
 *
 * @param {string|string[]} textOrLines
 * @param {object} [opts]
 * @returns {{ counts: Object.<string, number>, total: number, riskScore: 'Low'|'Medium'|'High' }}
 */
function scanText(textOrLines, opts = {}) {
  const lines = Array.isArray(textOrLines) ? textOrLines : [textOrLines];
  const counts = {};

  // Tokenize: split on whitespace, commas, semicolons, quotes, newlines
  for (const line of lines) {
    const tokens = String(line).split(/[\s,;"'<>(){}\[\]|]+/);
    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed || trimmed.length < 2) continue;
      const result = detectValue(trimmed, opts);
      if (result.isSensitive) {
        counts[result.type] = (counts[result.type] || 0) + 1;
      }
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Risk scoring
  const highRiskTypes = ['aadhaar', 'pan', 'credit_card', 'passport', 'ssn'];
  const hasHighRisk = Object.keys(counts).some(t => highRiskTypes.includes(t));
  let riskScore = 'Low';
  if (hasHighRisk || total > 20) {
    riskScore = 'High';
  } else if (total > 5) {
    riskScore = 'Medium';
  }

  return { counts, total, riskScore };
}

/**
 * Scan an array of structured records (objects) for sensitive values.
 * Returns counts per PII type and total.
 *
 * @param {object[]} records
 * @param {object} [opts]
 * @returns {{ counts: Object.<string, number>, total: number, riskScore: string }}
 */
function scanRecords(records, opts = {}) {
  const counts = {};
  for (const record of records) {
    for (const [key, val] of Object.entries(record)) {
      const strVal = String(val ?? '');
      const { protect, type } = shouldProtect(strVal, key, opts);
      if (protect && type) {
        const category = type === 'field_name' ? 'generic' : type;
        counts[category] = (counts[category] || 0) + 1;
      }
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const highRiskTypes = ['aadhaar', 'pan', 'credit_card', 'passport'];
  const hasHighRisk = Object.keys(counts).some(t => highRiskTypes.includes(t));
  let riskScore = 'Low';
  if (hasHighRisk || total > 20) riskScore = 'High';
  else if (total > 5) riskScore = 'Medium';
  return { counts, total, riskScore };
}

/**
 * Scan a single string and return each sensitive token found inside it.
 * Useful for PDF lines where pdfjs returns full sentences ("Email: foo@bar.com").
 *
 * @param {string} text
 * @param {object} [opts]
 * @returns {Array<{ token: string, type: string, startIndex: number }>}
 */
function extractSensitiveTokens(text, opts = {}) {
  if (!text || typeof text !== 'string') return [];
  const tokens = text.split(/[\s,;"'<>(){}\[\]|]+/);
  const results = [];
  let searchFrom = 0;

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 2) {
      searchFrom += token.length + 1;
      continue;
    }
    const result = detectValue(trimmed, opts);
    if (result.isSensitive) {
      const idx = text.indexOf(trimmed, searchFrom);
      results.push({ token: trimmed, type: result.type, startIndex: idx >= 0 ? idx : searchFrom });
    }
    searchFrom = Math.max(searchFrom, text.indexOf(trimmed, searchFrom) + trimmed.length);
  }
  return results;
}

module.exports = {
  detectValue,
  isSensitiveField,
  shouldProtect,
  scanText,
  scanRecords,
  extractSensitiveTokens,
  PATTERNS,
  SENSITIVE_FIELD_NAMES,
};
