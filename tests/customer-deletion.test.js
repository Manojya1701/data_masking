'use strict';

/**
 * Unit Tests for Comprehensive Privacy Data Management Service
 * Verifies all 8 Privacy Operations (masking, tokenization, anonymization, pseudonymization, redaction, encryption, hashing, deletion)
 * against privacy_deletion_customers table records.
 */

const { getPrivacyDeletionCustomers, deletePrivacyCustomer, applyOperationToPrivacyCustomer } = require('../backend/services/privacy-deletion-service');

describe('Comprehensive Privacy Data Management Service', () => {

  test('getPrivacyDeletionCustomers returns customer records', async () => {
    const data = await getPrivacyDeletionCustomers();
    expect(data).toHaveProperty('source');
    expect(data).toHaveProperty('records');
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records.length).toBeGreaterThan(0);

    const first = data.records[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('first_name');
    expect(first).toHaveProperty('last_name');
    expect(first).toHaveProperty('email');
  });

  test('applyOperationToPrivacyCustomer with invalid ID throws validation error', async () => {
    await expect(applyOperationToPrivacyCustomer('invalid', 'masking')).rejects.toThrow(/Invalid customer ID/i);
    await expect(applyOperationToPrivacyCustomer(-5, 'masking')).rejects.toThrow(/Invalid customer ID/i);
  });

  test('applyOperationToPrivacyCustomer with unsupported operation throws error', async () => {
    await expect(applyOperationToPrivacyCustomer(1, 'invalid_op')).rejects.toThrow(/Unsupported operation/i);
  });

  test('applyOperationToPrivacyCustomer applies MASKING correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'masking');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('masking');
    expect(res.record.email).not.toBe(target.email);
    expect(res.record.email).toMatch(/[*@]/);
  });

  test('applyOperationToPrivacyCustomer applies TOKENIZATION correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[1] || initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'tokenization');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('tokenization');
    expect(res.record.first_name).toMatch(/^TKN_FIRST_/);
    expect(res.record.last_name).toMatch(/^TKN_LAST_/);
  });

  test('applyOperationToPrivacyCustomer applies ANONYMIZATION correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[2] || initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'anonymization');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('anonymization');
    expect(res.record.first_name).toBe('Anonymous');
    expect(res.record.last_name).toBe('User');
    expect(res.record.email).toMatch(/anonymized_/);
  });

  test('applyOperationToPrivacyCustomer applies PSEUDONYMIZATION correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[3] || initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'pseudonymization');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('pseudonymization');
    expect(res.record.first_name).toMatch(/^PERSON_/);
  });

  test('applyOperationToPrivacyCustomer applies REDACTION correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[4] || initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'redaction');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('redaction');
    expect(res.record.first_name).toBe('[REDACTED]');
    expect(res.record.email).toBe('[REDACTED]');
  });

  test('applyOperationToPrivacyCustomer applies ENCRYPTION correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[5] || initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'encryption');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('encryption');
    expect(res.record.first_name).toMatch(/^ENC_AES256_/);
  });

  test('applyOperationToPrivacyCustomer applies HASHING correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[6] || initialData.records[0];
    const res = await applyOperationToPrivacyCustomer(target.id, 'hashing');

    expect(res.success).toBe(true);
    expect(res.operation).toBe('hashing');
    expect(res.record.first_name).toMatch(/^[a-f0-9]+$/i);
  });

  test('applyOperationToPrivacyCustomer applies DELETION correctly', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const target = initialData.records[initialData.records.length - 1];
    const targetId = target.id;

    const res = await applyOperationToPrivacyCustomer(targetId, 'deletion');
    expect(res.success).toBe(true);
    expect(res.operation).toBe('deletion');

    const updatedData = await getPrivacyDeletionCustomers();
    expect(updatedData.records.some(c => c.id === targetId)).toBe(false);
  });

});
