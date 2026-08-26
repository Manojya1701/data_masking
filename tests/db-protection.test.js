'use strict';

/**
 * Unit Tests for Database Table Protection Service
 * Verifies all 7 privacy operations directly on database customer records.
 */

const { getCustomers, protectCustomers, SENSITIVE_COLUMNS } = require('../backend/services/db-protection-service');

describe('Database Table Protection Service', () => {
  test('getCustomers returns customer records containing expected schema fields', async () => {
    const data = await getCustomers();
    expect(data).toHaveProperty('source');
    expect(data).toHaveProperty('records');
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records.length).toBeGreaterThan(0);

    const first = data.records[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('email');
    expect(first).toHaveProperty('phone');
    expect(first).toHaveProperty('aadhaar');
    expect(first).toHaveProperty('pan');
    expect(first).toHaveProperty('address');
    expect(first).toHaveProperty('created_at');
  });

  const operations = [
    'masking',
    'tokenization',
    'anonymization',
    'pseudonymization',
    'redaction',
    'encryption',
    'hashing',
  ];

  operations.forEach(op => {
    test(`protectCustomers applies operation "${op}" to all sensitive columns while preserving non-sensitive fields`, async () => {
      const res = await protectCustomers(op);
      expect(res.success !== false).toBe(true);
      expect(res.operation).toBeDefined();
      expect(Array.isArray(res.records)).toBe(true);

      const origData = await getCustomers();

      res.records.forEach((rec, idx) => {
        const orig = origData.records[idx];

        // Non-sensitive fields MUST remain unchanged
        expect(rec.id).toBe(orig.id);
        expect(rec.created_at).toBe(orig.created_at);

        // Sensitive columns MUST be transformed
        SENSITIVE_COLUMNS.forEach(col => {
          expect(rec[col]).toBeDefined();
          if (op !== 'masking' && op !== 'anonymization') {
            // Transformation must differ from original value
            expect(rec[col]).not.toBe(orig[col]);
          }
        });
      });
    });
  });

  test('Masking transforms values into partial mask structure', async () => {
    const res = await protectCustomers('masking');
    const first = res.records[0];
    expect(first.name).toContain('*');
    expect(first.email).toContain('@');
  });

  test('Tokenization replaces values with cryptographic TKN_ tokens', async () => {
    const res = await protectCustomers('tokenization');
    const first = res.records[0];
    expect(first.name).toMatch(/^TKN_NAME_[A-F0-9]{6}$/);
    expect(first.email).toMatch(/^TKN_EMAIL_[A-F0-9]{6}$/);
  });

  test('Anonymization replaces identifying values with generic replacements', async () => {
    const res = await protectCustomers('anonymization');
    const first = res.records[0];
    expect(first.name).toBe('Anonymous');
    expect(first.email).toBe('anonymous@example.invalid');
    expect(first.phone).toBe('0000000000');
  });

  test('Pseudonymization produces consistent pseudonyms (PERSON_001, EMAIL_001)', async () => {
    const res = await protectCustomers('pseudonymization');
    const first = res.records[0];
    expect(first.name).toMatch(/^PERSON_\d{3}$/);
    expect(first.email).toMatch(/^EMAIL_\d{3}$/);
  });

  test('Redaction replaces all sensitive fields with [REDACTED]', async () => {
    const res = await protectCustomers('redaction');
    const first = res.records[0];
    SENSITIVE_COLUMNS.forEach(col => {
      expect(first[col]).toBe('[REDACTED]');
    });
  });

  test('Encryption produces authenticated AES-256-GCM ciphertexts', async () => {
    const res = await protectCustomers('encryption');
    const first = res.records[0];
    expect(first.name).toMatch(/^ENC_AES256_[a-f0-9]+:[a-f0-9]+:[a-f0-9]+…$/);
  });

  test('Hashing produces SHA-256 64-char hex digests', async () => {
    const res = await protectCustomers('hashing');
    const first = res.records[0];
    expect(first.name).toMatch(/^[a-f0-9]{64}$/);
    expect(first.email).toMatch(/^[a-f0-9]{64}$/);
  });

  test('Invalid operation name throws clear error', async () => {
    await expect(protectCustomers('invalid_op')).rejects.toThrow(/Unsupported operation/);
  });

  describe('Persistence & Saved Protected Data', () => {
    const { saveProtectedCustomers, getSavedProtectedCustomers } = require('../backend/services/db-protection-service');

    test('saveProtectedCustomers saves preview records and getSavedProtectedCustomers retrieves them', async () => {
      const preview = await protectCustomers('tokenization');
      const saveRes = await saveProtectedCustomers('tokenization', preview.records);
      expect(saveRes).toHaveProperty('savedCount', preview.records.length);
      expect(saveRes).toHaveProperty('operation', 'tokenization');

      const savedData = await getSavedProtectedCustomers(10);
      expect(savedData).toHaveProperty('records');
      expect(Array.isArray(savedData.records)).toBe(true);
      expect(savedData.records.length).toBeGreaterThanOrEqual(preview.records.length);

      const firstSaved = savedData.records[0];
      expect(firstSaved).toHaveProperty('operation', 'tokenization');
      expect(firstSaved.name).toMatch(/^TKN_NAME_[A-F0-9]{6}$/);
    });

    test('saveProtectedCustomers rejects invalid operation names or empty records', async () => {
      await expect(saveProtectedCustomers('invalid_op', [{ id: 1 }])).rejects.toThrow(/Invalid operation/);
      await expect(saveProtectedCustomers('masking', [])).rejects.toThrow(/No protected records/);
    });
  });
});
