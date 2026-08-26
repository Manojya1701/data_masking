'use strict';

/**
 * Privacy Data Deletion Service
 * Manages privacy_deletion_customers PostgreSQL table.
 * Executes parameterized SQL deletion: DELETE FROM privacy_deletion_customers WHERE id = $1
 */

const db = require('../database/db');
const auditService = require('./audit-service');

// Sample fallback records for demonstration when PostgreSQL is unconfigured / offline
let DELETION_SAMPLE_CUSTOMERS = [
  {
    id: 1,
    first_name: 'Rahul',
    last_name: 'Kumar',
    email: 'rahul@gmail.com',
    created_at: '2026-08-15T10:00:00.000Z'
  },
  {
    id: 2,
    first_name: 'Priya',
    last_name: 'Sharma',
    email: 'priya@gmail.com',
    created_at: '2026-08-15T10:05:00.000Z'
  },
  {
    id: 3,
    first_name: 'Arjun',
    last_name: 'Reddy',
    email: 'arjun@gmail.com',
    created_at: '2026-08-15T10:10:00.000Z'
  }
];

/**
 * Fetch records from privacy_deletion_customers table (or sample fallback if unconfigured).
 */
async function getPrivacyDeletionCustomers() {
  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT id, first_name, last_name, email, created_at FROM privacy_deletion_customers ORDER BY id ASC;');
      if (res && res.rows && res.rows.length > 0) {
        return { source: 'postgresql', records: res.rows };
      }
    } catch (err) {
      console.warn('[Privacy Deletion Warning] Failed to query PostgreSQL privacy_deletion_customers:', err.message);
    }
  }
  return { source: 'sample_fallback', records: JSON.parse(JSON.stringify(DELETION_SAMPLE_CUSTOMERS)) };
}

/**
 * Permanently delete a customer record from privacy_deletion_customers PostgreSQL table.
 * Uses a parameterized SQL query: DELETE FROM privacy_deletion_customers WHERE id = $1
 */
async function deletePrivacyCustomer(id) {
  const customerId = parseInt(id, 10);
  if (isNaN(customerId) || customerId <= 0) {
    throw new Error('Invalid customer ID');
  }

  if (db.isConfigured()) {
    try {
      // 1. Verify existence using parameterized query
      const checkRes = await db.query('SELECT id, email, first_name, last_name FROM privacy_deletion_customers WHERE id = $1;', [customerId]);
      if (!checkRes || !checkRes.rows || checkRes.rows.length === 0) {
        return { success: false, notFound: true, message: 'Customer not found' };
      }

      const targetEmail = checkRes.rows[0].email;

      // 2. Execute parameterized DELETE
      await db.query('DELETE FROM privacy_deletion_customers WHERE id = $1;', [customerId]);

      // 3. Log audit event
      try {
        await auditService.logOperation({
          jobId: `DEL_PRIV_${customerId}`,
          originalFileName: 'privacy_deletion_customers',
          fileFormat: 'postgresql_table',
          operation: 'privacy_deletion',
          status: 'SUCCESS',
          processedCount: 1,
          detectedCount: 1,
          riskLevel: 'HIGH',
          outputFileName: `deleted_customer_${customerId}`,
        });
      } catch { /* ignore audit error */ }

      return {
        success: true,
        message: 'Customer personal data deleted successfully',
        deletedId: customerId,
        deletedEmail: targetEmail,
      };
    } catch (err) {
      console.error('[Privacy Deletion Error] Failed to delete record from PostgreSQL:', err.message);
      throw err;
    }
  }

  // Fallback in-memory mode when PostgreSQL is offline
  const index = DELETION_SAMPLE_CUSTOMERS.findIndex(c => c.id === customerId);
  if (index === -1) {
    return { success: false, notFound: true, message: 'Customer not found' };
  }

  const deletedItem = DELETION_SAMPLE_CUSTOMERS.splice(index, 1)[0];
  return {
    success: true,
    message: 'Customer personal data deleted successfully',
    deletedId: customerId,
    deletedEmail: deletedItem.email,
  };
}

module.exports = {
  getPrivacyDeletionCustomers,
  deletePrivacyCustomer,
};
