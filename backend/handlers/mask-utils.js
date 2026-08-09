'use strict';

/**
 * Masking utilities — shared across all handlers.
 */

/**
 * Mask a value based on its detected type or generic heuristic.
 * @param {string} value
 * @param {string} [fieldName]
 * @returns {string}
 */
function maskValue(value, fieldName) {
  if (typeof value !== 'string' || value === '') return value;

  const lower = (fieldName || '').toLowerCase();

  // Email: r***@example.com
  if (/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(value)) {
    const [local, domain] = value.split('@');
    const masked = local.length <= 1 ? '*' : local[0] + '*'.repeat(Math.min(local.length - 1, 4));
    return `${masked}@${domain}`;
  }

  // Aadhaar: show last 4 digits (check BEFORE phone to avoid conflict)
  if (/^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(value)) {
    const digits = value.replace(/\D/g, '');
    return 'XXXX XXXX ' + digits.slice(-4);
  }

  // Phone: last 4 digits visible
  if (/^[\+\d][\d\s\-]{5,}$/.test(value)) {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 4) {
      return '*'.repeat(digits.length - 4) + digits.slice(-4);
    }
    return '*'.repeat(value.length);
  }

  // PAN: show first 2 and last 1 chars
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)) {
    return value[0] + value[1] + '*'.repeat(8) + value[9];
  }

  // Name or generic: show first char, mask rest
  if (value.length <= 1) return '*';
  return value[0] + '*'.repeat(Math.min(value.length - 1, 6));
}

module.exports = { maskValue };
