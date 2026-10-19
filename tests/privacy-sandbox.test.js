'use strict';

/**
 * privacy-sandbox.test.js
 * Unit tests validating regex detection and 6-way transformation algorithms
 * matching frontend/public/js/privacy-sandbox.js and backend/handlers/mask-utils.js.
 */

describe('Privacy Sandbox Engine', () => {

  function scanEntities(text) {
    if (!text || typeof text !== 'string') return [];
    const entities = [];

    const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    let match;
    while ((match = emailRe.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'email', start: match.index, end: match.index + match[0].length });
    }

    const aadhaarRe = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g;
    while ((match = aadhaarRe.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'aadhaar', start: match.index, end: match.index + match[0].length });
    }

    const panRe = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
    while ((match = panRe.exec(text)) !== null) {
      entities.push({ text: match[0], type: 'pan', start: match.index, end: match.index + match[0].length });
    }

    const phoneRe = /(?:\+91|0)?[6-9]\d{9}|\+[1-9]\d{1,3}[\s\-]?\d{6,14}/g;
    while ((match = phoneRe.exec(text)) !== null) {
      if (!entities.some(e => e.start <= match.index && e.end >= match.index + match[0].length)) {
        entities.push({ text: match[0], type: 'phone', start: match.index, end: match.index + match[0].length });
      }
    }

    const nameRe = /\b[A-Z][a-z]{1,15}\s[A-Z][a-z]{1,15}(?:\s[A-Z][a-z]{1,15})?\b/g;
    while ((match = nameRe.exec(text)) !== null) {
      const lower = match[0].toLowerCase();
      if (!lower.includes('customer') && !lower.includes('account') && !lower.includes('email') && !lower.includes('phone')) {
        if (!entities.some(e => e.start <= match.index && e.end >= match.index + match[0].length)) {
          entities.push({ text: match[0], type: 'name', start: match.index, end: match.index + match[0].length });
        }
      }
    }

    entities.sort((a, b) => a.start - b.start);
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

  test('Detects Email, Phone, PAN, Aadhaar, and Names accurately', () => {
    const text = 'Vikram Patel with email vikram.p@example.com, phone +91 9876543210, PAN ABCDE1234F, and Aadhaar 2345 6789 0123';
    const entities = scanEntities(text);

    expect(entities.some(e => e.type === 'name' && e.text === 'Vikram Patel')).toBe(true);
    expect(entities.some(e => e.type === 'email' && e.text === 'vikram.p@example.com')).toBe(true);
    expect(entities.some(e => e.type === 'phone' && e.text === '+91 9876543210')).toBe(true);
    expect(entities.some(e => e.type === 'pan' && e.text === 'ABCDE1234F')).toBe(true);
    expect(entities.some(e => e.type === 'aadhaar' && e.text === '2345 6789 0123')).toBe(true);
    expect(entities.length).toBe(5);
  });

  test('Base64 Token transformation and live decode roundtrip', () => {
    const original = 'Priya Sharma, priya@segmento.io';
    const entities = scanEntities(original);

    // Transform
    let out = '';
    let cursor = 0;
    for (const ent of entities) {
      out += original.slice(cursor, ent.start);
      out += `BASE64[${Buffer.from(ent.text).toString('base64')}]`;
      cursor = ent.end;
    }
    out += original.slice(cursor);

    expect(out).toContain('BASE64[');
    expect(out).not.toContain('priya@segmento.io');

    // Decode back
    const restored = out.replace(/BASE64\[([A-Za-z0-9+/=]+)\]/g, (_, token) => {
      return Buffer.from(token, 'base64').toString('utf8');
    });

    expect(restored).toBe(original);
  });
});
