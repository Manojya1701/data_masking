'use strict';

/**
 * Privacy Data Management Service (Supports All 8 Privacy Operations)
 * Manages privacy_deletion_customers table.
 * Operations: masking, tokenization, anonymization, pseudonymization, redaction, encryption, hashing, deletion.
 * Executes parameterized SQL queries: UPDATE / DELETE FROM privacy_deletion_customers WHERE id = $1
 */

const db = require('../database/db');
const auditService = require('./audit-service');
const { maskValue } = require('../handlers/mask-utils');
const { hash } = require('./hashing-service');
const crypto = require('crypto');

// Secret key for field encryption
const FIELD_ENC_KEY = crypto.createHash('sha256').update(process.env.FIELD_ENCRYPTION_SECRET || 'udps_field_secret_key_2026').digest();

function encryptFieldVal(val) {
  if (!val) return val;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FIELD_ENC_KEY, iv);
  let encrypted = cipher.update(String(val), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `ENC_AES256_${iv.toString('hex')}:${authTag}:${encrypted.slice(0, 10)}…`;
}

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
 */
async function deletePrivacyCustomer(id) {
  return applyOperationToPrivacyCustomer(id, 'deletion');
}

/**
 * Anonymize customer personal data in-place in privacy_deletion_customers table.
 */
async function anonymizePrivacyCustomer(id) {
  return applyOperationToPrivacyCustomer(id, 'anonymization');
}

/**
 * Apply any of the 8 Privacy Operations to a customer record in privacy_deletion_customers table.
 * Operations: masking, tokenization, anonymization, pseudonymization, redaction, encryption, hashing, deletion.
 */
async function applyOperationToPrivacyCustomer(id, rawOp) {
  const customerId = parseInt(id, 10);
  if (isNaN(customerId) || customerId <= 0) {
    throw new Error('Invalid customer ID');
  }

  const op = (rawOp || 'deletion').toLowerCase().trim();
  const normalizedOp = (op === 'mask' ? 'masking' : op === 'token' ? 'tokenization' : op === 'anonymize' ? 'anonymization' : op === 'pseudo' ? 'pseudonymization' : op === 'redact' ? 'redaction' : op === 'encrypt' ? 'encryption' : op === 'hash' ? 'hashing' : op === 'delete' ? 'deletion' : op);

  const ALLOWED = new Set(['masking', 'tokenization', 'anonymization', 'pseudonymization', 'redaction', 'encryption', 'hashing', 'deletion']);
  if (!ALLOWED.has(normalizedOp)) {
    throw new Error(`Unsupported operation: "${rawOp}"`);
  }

  // Handling DELETION
  if (normalizedOp === 'deletion') {
    if (db.isConfigured()) {
      const checkRes = await db.query('SELECT id, email FROM privacy_deletion_customers WHERE id = $1;', [customerId]);
      if (!checkRes || !checkRes.rows || checkRes.rows.length === 0) {
        return { success: false, notFound: true, message: 'Customer not found' };
      }
      const targetEmail = checkRes.rows[0].email;
      await db.query('DELETE FROM privacy_deletion_customers WHERE id = $1;', [customerId]);

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
      } catch { /* ignore */ }

      return {
        success: true,
        operation: 'deletion',
        message: 'Customer personal data deleted successfully',
        deletedId: customerId,
        deletedEmail: targetEmail,
      };
    }

    const index = DELETION_SAMPLE_CUSTOMERS.findIndex(c => c.id === customerId);
    if (index === -1) {
      return { success: false, notFound: true, message: 'Customer not found' };
    }
    const deletedItem = DELETION_SAMPLE_CUSTOMERS.splice(index, 1)[0];
    return {
      success: true,
      operation: 'deletion',
      message: 'Customer personal data deleted successfully',
      deletedId: customerId,
      deletedEmail: deletedItem.email,
    };
  }

  // Fetch record for transformation operations
  let origRecord = null;
  if (db.isConfigured()) {
    const checkRes = await db.query('SELECT id, first_name, last_name, email FROM privacy_deletion_customers WHERE id = $1;', [customerId]);
    if (checkRes && checkRes.rows && checkRes.rows.length > 0) {
      origRecord = checkRes.rows[0];
    }
  } else {
    origRecord = DELETION_SAMPLE_CUSTOMERS.find(c => c.id === customerId);
  }

  if (!origRecord) {
    return { success: false, notFound: true, message: 'Customer not found' };
  }

  const { first_name: fName, last_name: lName, email: emailVal } = origRecord;
  let newFirstName = fName;
  let newLastName = lName;
  let newEmail = emailVal;

  if (normalizedOp === 'masking') {
    newFirstName = maskValue(fName, 'name');
    newLastName = maskValue(lName, 'name');
    newEmail = maskValue(emailVal, 'email');
  } else if (normalizedOp === 'tokenization') {
    const hashSnippet = crypto.createHash('sha256').update(String(fName || customerId)).digest('hex').slice(0, 6).toUpperCase();
    newFirstName = `TKN_FIRST_${hashSnippet}`;
    newLastName = `TKN_LAST_${hashSnippet}`;
    newEmail = `TKN_EMAIL_${hashSnippet}@token.invalid`;
  } else if (normalizedOp === 'anonymization') {
    newFirstName = 'Anonymous';
    newLastName = 'User';
    newEmail = `anonymized_${customerId}@privacy.invalid`;
  } else if (normalizedOp === 'pseudonymization') {
    const num = String(customerId).padStart(3, '0');
    newFirstName = `PERSON_${num}`;
    newLastName = `USER_${num}`;
    newEmail = `EMAIL_${num}@domain.invalid`;
  } else if (normalizedOp === 'redaction') {
    newFirstName = '[REDACTED]';
    newLastName = '[REDACTED]';
    newEmail = '[REDACTED]';
  } else if (normalizedOp === 'encryption') {
    newFirstName = encryptFieldVal(fName);
    newLastName = encryptFieldVal(lName);
    newEmail = encryptFieldVal(emailVal);
  } else if (normalizedOp === 'hashing') {
    newFirstName = hash(String(fName), 'sha256').slice(0, 16);
    newLastName = hash(String(lName), 'sha256').slice(0, 16);
    newEmail = hash(String(emailVal), 'sha256').slice(0, 16);
  }

  if (db.isConfigured()) {
    await db.query(
      'UPDATE privacy_deletion_customers SET first_name = $1, last_name = $2, email = $3 WHERE id = $4;',
      [newFirstName, newLastName, newEmail, customerId]
    );

    try {
      await auditService.logOperation({
        jobId: `OP_${normalizedOp.toUpperCase()}_PRIV_${customerId}`,
        originalFileName: 'privacy_deletion_customers',
        fileFormat: 'postgresql_table',
        operation: normalizedOp,
        status: 'SUCCESS',
        processedCount: 1,
        detectedCount: 3,
        riskLevel: 'MEDIUM',
        outputFileName: `${normalizedOp}_customer_${customerId}`,
      });
    } catch { /* ignore */ }
  } else {
    origRecord.first_name = newFirstName;
    origRecord.last_name = newLastName;
    origRecord.email = newEmail;
  }

  return {
    success: true,
    operation: normalizedOp,
    message: `Customer personal data updated using ${normalizedOp.toUpperCase()}`,
    updatedId: customerId,
    record: {
      id: customerId,
      first_name: newFirstName,
      last_name: newLastName,
      email: newEmail,
    }
  };
}

module.exports = {
  getPrivacyDeletionCustomers,
  deletePrivacyCustomer,
  anonymizePrivacyCustomer,
  applyOperationToPrivacyCustomer,
};
