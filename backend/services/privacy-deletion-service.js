'use strict';

/**
 * Privacy Data Management Service (Deletion & In-Place Anonymization)
 * Manages privacy_deletion_customers table.
 * Executes parameterized SQL deletion: DELETE FROM privacy_deletion_customers WHERE id = $1
 * Executes parameterized SQL anonymization: UPDATE privacy_deletion_customers SET first_name = $1, last_name = $2, email = $3 WHERE id = $4
 */

const db = require('../database/db');
const auditService = require('./audit-service');

// Sample fallback records for demonstration when PostgreSQL is unconfigured / offline
let DELETION_SAMPLE_CUSTOMERS = [
  { id: 1, first_name: 'Rahul', last_name: 'Kumar', email: 'rahul@gmail.com', created_at: '2026-08-15T10:00:00.000Z' },
  { id: 2, first_name: 'Priya', last_name: 'Sharma', email: 'priya@gmail.com', created_at: '2026-08-15T10:05:00.000Z' },
  { id: 3, first_name: 'Arjun', last_name: 'Reddy', email: 'arjun@gmail.com', created_at: '2026-08-15T10:10:00.000Z' },
  { id: 4, first_name: 'Sneha', last_name: 'Patel', email: 'sneha.p@gmail.com', created_at: '2026-08-15T10:15:00.000Z' },
  { id: 5, first_name: 'Vikram', last_name: 'Verma', email: 'vikram.v@example.com', created_at: '2026-08-15T10:20:00.000Z' },
  { id: 6, first_name: 'Ananya', last_name: 'Roy', email: 'ananya.roy@example.com', created_at: '2026-08-15T10:25:00.000Z' },
  { id: 7, first_name: 'Karthik', last_name: 'Nair', email: 'karthik.n@gmail.com', created_at: '2026-08-15T10:30:00.000Z' },
  { id: 8, first_name: 'Divya', last_name: 'Das', email: 'divya.das@example.com', created_at: '2026-08-15T10:35:00.000Z' }
];

/**
 * Fetch records from privacy_deletion_customers table.
 */
async function getPrivacyDeletionCustomers() {
  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT id, first_name, last_name, email, created_at FROM privacy_deletion_customers ORDER BY id ASC;');
      if (res && res.rows && res.rows.length > 0) {
        return { source: 'postgresql', records: res.rows };
      }
    } catch (err) {
      console.warn('[Privacy Deletion Warning] Failed to query privacy_deletion_customers:', err.message);
    }
  }
  return { source: 'sample_fallback', records: JSON.parse(JSON.stringify(DELETION_SAMPLE_CUSTOMERS)) };
}

/**
 * Permanently delete a customer record from privacy_deletion_customers table.
 * Uses parameterized SQL query: DELETE FROM privacy_deletion_customers WHERE id = $1
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
      console.error('[Privacy Deletion Error] Failed to delete record:', err.message);
      throw err;
    }
  }

  // Fallback in-memory mode
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

/**
 * Anonymize customer personal data in-place in privacy_deletion_customers table.
 * Uses parameterized SQL query: UPDATE privacy_deletion_customers SET first_name = $1, last_name = $2, email = $3 WHERE id = $4
 */
async function anonymizePrivacyCustomer(id) {
  const customerId = parseInt(id, 10);
  if (isNaN(customerId) || customerId <= 0) {
    throw new Error('Invalid customer ID');
  }

  const anonFirstName = 'Anonymous';
  const anonLastName = 'User';
  const anonEmail = `anonymized_${customerId}@privacy.invalid`;

  if (db.isConfigured()) {
    try {
      const checkRes = await db.query('SELECT id, email FROM privacy_deletion_customers WHERE id = $1;', [customerId]);
      if (!checkRes || !checkRes.rows || checkRes.rows.length === 0) {
        return { success: false, notFound: true, message: 'Customer not found' };
      }

      await db.query(
        'UPDATE privacy_deletion_customers SET first_name = $1, last_name = $2, email = $3 WHERE id = $4;',
        [anonFirstName, anonLastName, anonEmail, customerId]
      );

      try {
        await auditService.logOperation({
          jobId: `ANON_PRIV_${customerId}`,
          originalFileName: 'privacy_deletion_customers',
          fileFormat: 'postgresql_table',
          operation: 'anonymization',
          status: 'SUCCESS',
          processedCount: 1,
          detectedCount: 3,
          riskLevel: 'MEDIUM',
          outputFileName: `anonymized_customer_${customerId}`,
        });
      } catch { /* ignore audit error */ }

      return {
        success: true,
        message: 'Customer personal data anonymized successfully',
        anonymizedId: customerId,
        anonymizedEmail: anonEmail,
      };
    } catch (err) {
      console.error('[Privacy Anonymize Error] Failed to anonymize record:', err.message);
      throw err;
    }
  }

  // Fallback in-memory mode
  const item = DELETION_SAMPLE_CUSTOMERS.find(c => c.id === customerId);
  if (!item) {
    return { success: false, notFound: true, message: 'Customer not found' };
  }

  item.first_name = anonFirstName;
  item.last_name = anonLastName;
  item.email = anonEmail;

  return {
    success: true,
    message: 'Customer personal data anonymized successfully',
    anonymizedId: customerId,
    anonymizedEmail: anonEmail,
  };
}

module.exports = {
  getPrivacyDeletionCustomers,
  deletePrivacyCustomer,
  anonymizePrivacyCustomer,
};
