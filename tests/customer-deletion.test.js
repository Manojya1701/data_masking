'use strict';

/**
 * Unit Tests for Dedicated Privacy Data Deletion Feature
 * Verifies fetching from privacy_deletion_customers table, deletion by ID, 404 response for non-existent records, and ID validation.
 */

const { getPrivacyDeletionCustomers, deletePrivacyCustomer } = require('../backend/services/privacy-deletion-service');

describe('Dedicated Privacy Data Deletion Feature', () => {

  test('getPrivacyDeletionCustomers returns records from privacy_deletion_customers table including sample records', async () => {
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
    expect(first.email).toMatch(/@/);
  });

  test('deletePrivacyCustomer with invalid ID throws validation error', async () => {
    await expect(deletePrivacyCustomer('invalid')).rejects.toThrow(/Invalid customer ID/i);
    await expect(deletePrivacyCustomer(-5)).rejects.toThrow(/Invalid customer ID/i);
  });

  test('deletePrivacyCustomer with non-existent ID returns notFound flag', async () => {
    const res = await deletePrivacyCustomer(999999);
    expect(res.success).toBe(false);
    expect(res.notFound).toBe(true);
    expect(res.message).toMatch(/Customer not found/i);
  });

  test('deletePrivacyCustomer permanently deletes an existing customer record by ID', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    const targetCustomer = initialData.records[0];
    const targetId = targetCustomer.id;

    // Execute deletion
    const res = await deletePrivacyCustomer(targetId);
    expect(res.success).toBe(true);
    expect(res.deletedId).toBe(targetId);
    expect(res.message).toMatch(/Customer personal data deleted successfully/i);

    // Verify record no longer exists in database
    const updatedData = await getPrivacyDeletionCustomers();
    const exists = updatedData.records.some(c => c.id === targetId);
    expect(exists).toBe(false);
  });

  test('Re-attempting to delete the same customer returns notFound: true', async () => {
    const initialData = await getPrivacyDeletionCustomers();
    if (initialData.records.length > 0) {
      const targetId = initialData.records[0].id;
      // First deletion
      await deletePrivacyCustomer(targetId);

      // Second deletion (duplicate request)
      const res = await deletePrivacyCustomer(targetId);
      expect(res.success).toBe(false);
      expect(res.notFound).toBe(true);
    }
  });

});
