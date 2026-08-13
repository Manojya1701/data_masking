'use strict';

/**
 * Database Protection Service
 * Performs privacy operations directly on PostgreSQL table records in-memory.
 * Returns protected preview records without destructively altering PostgreSQL table rows.
 */

const db = require('../database/db');
const { maskValue } = require('../handlers/mask-utils');
const { hash } = require('./hashing-service');
const auditService = require('./audit-service');
const crypto = require('crypto');

// Configurable list of sensitive columns for demonstration
const SENSITIVE_COLUMNS = ['name', 'email', 'phone', 'aadhaar', 'pan', 'address'];

// Sample fallback records for demonstration when PostgreSQL is unconfigured / offline
const SAMPLE_CUSTOMERS = [
  {
    id: 1,
    name: 'Harika',
    email: 'harika@example.com',
    phone: '9876543210',
    aadhaar: '1234 5678 9012',
    pan: 'ABCDE1234F',
    address: 'Visakhapatnam',
    created_at: '2026-08-12T10:00:00.000Z'
  },
  {
    id: 2,
    name: 'Ravi Kumar',
    email: 'ravi.k@example.com',
    phone: '9123456789',
    aadhaar: '2345 6789 0123',
    pan: 'BCDEF2345G',
    address: 'Hyderabad',
    created_at: '2026-08-12T10:05:00.000Z'
  },
  {
    id: 3,
    name: 'Ananya Sharma',
    email: 'ananya@example.com',
    phone: '9988776655',
    aadhaar: '3456 7890 1234',
    pan: 'CDEFG3456H',
    address: 'Bengaluru',
    created_at: '2026-08-12T10:10:00.000Z'
  },
  {
    id: 4,
    name: 'Vikram Patel',
    email: 'vikram.p@example.com',
    phone: '9876501234',
    aadhaar: '4567 8901 2345',
    pan: 'DEFGH4567I',
    address: 'Mumbai',
    created_at: '2026-08-12T10:15:00.000Z'
  },
  {
    id: 5,
    name: 'Priya Das',
    email: 'priya.das@example.com',
    phone: '9765432109',
    aadhaar: '5678 9012 3456',
    pan: 'EFGHI5678J',
    address: 'Chennai',
    created_at: '2026-08-12T10:20:00.000Z'
  }
];

// System secret key for AES-256-GCM field-level encryption (never exposed to client)
const FIELD_ENC_KEY = crypto.createHash('sha256').update(process.env.FIELD_ENCRYPTION_SECRET || 'udps_field_secret_key_2026').digest();

/**
 * Encrypt a field value using AES-256-GCM
 */
function encryptField(val) {
  if (val === null || val === undefined || val === '') return val;
  const str = String(val);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FIELD_ENC_KEY, iv);
  let encrypted = cipher.update(str, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `ENC_AES256_${iv.toString('hex')}:${authTag}:${encrypted.slice(0, 16)}…`;
}

/**
 * Anonymize a field value using generalized non-identifying replacements according to type/column.
 */
function anonymizeField(val, colName) {
  if (val === null || val === undefined || val === '') return val;
  const col = (colName || '').toLowerCase();
  if (col === 'email') return 'anonymous@example.invalid';
  if (col === 'phone') return '0000000000';
  if (col === 'aadhaar') return '0000 0000 0000';
  if (col === 'pan') return 'XXXXX0000X';
  if (col === 'name') return 'Anonymous';
  if (col === 'address') return '[Anonymized Location]';
  return '[Anonymized]';
}

/**
 * Fetch customer records from PostgreSQL (or sample fallback if unconfigured).
 */
async function getCustomers() {
  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT id, name, email, phone, aadhaar, pan, address, created_at FROM customers ORDER BY id ASC;');
      if (res && res.rows && res.rows.length > 0) {
        return { source: 'postgresql', records: res.rows };
      }
    } catch (err) {
      console.warn('[DB Protection Warning] Failed to query PostgreSQL customers:', err.message);
    }
  }
  return { source: 'sample_fallback', records: JSON.parse(JSON.stringify(SAMPLE_CUSTOMERS)) };
}

/**
 * Supported privacy operations allowlist.
 */
const ALLOWED_OPERATIONS = new Set([
  'masking', 'mask',
  'tokenization', 'token',
  'anonymization', 'anonymize',
  'pseudonymization', 'pseudo',
  'redaction', 'redact',
  'encryption', 'encrypt',
  'hashing', 'hash',
]);

/**
 * Apply selected privacy operation to all sensitive columns of customer records in-memory.
 */
async function protectCustomers(opRequested) {
  const op = (opRequested || '').toLowerCase().trim();
  if (!ALLOWED_OPERATIONS.has(op)) {
    throw new Error(`Unsupported operation: "${opRequested}". Supported operations: masking, tokenization, anonymization, pseudonymization, redaction, encryption, hashing.`);
  }

  const { source, records } = await getCustomers();
  const tokenMap = {};
  const pseudoMap = {};

  // Standardize operation name for reporting
  let normalizedOp = 'masking';
  if (op.startsWith('token')) normalizedOp = 'tokenization';
  else if (op.startsWith('anon')) normalizedOp = 'anonymization';
  else if (op.startsWith('pseudo')) normalizedOp = 'pseudonymization';
  else if (op.startsWith('redact')) normalizedOp = 'redaction';
  else if (op.startsWith('enc')) normalizedOp = 'encryption';
  else if (op.startsWith('hash')) normalizedOp = 'hashing';

  const protectedRecords = records.map(row => {
    const newRow = { ...row };
    for (const col of SENSITIVE_COLUMNS) {
      if (newRow[col] !== undefined && newRow[col] !== null) {
        const val = String(newRow[col]);
        switch (normalizedOp) {
          case 'masking':
            newRow[col] = maskValue(val, col, 'partial');
            break;
          case 'tokenization':
            newRow[col] = maskValue(val, col, 'tokenization', tokenMap, col);
            break;
          case 'anonymization':
            newRow[col] = anonymizeField(val, col);
            break;
          case 'pseudonymization':
            newRow[col] = maskValue(val, col, 'pseudo', pseudoMap, col);
            break;
          case 'redaction':
            newRow[col] = maskValue(val, col, 'redact');
            break;
          case 'encryption':
            newRow[col] = encryptField(val);
            break;
          case 'hashing':
            newRow[col] = hash(val, 'sha256');
            break;
        }
      }
    }
    return newRow;
  });

  // Safely record audit history entry for database protection (metadata only, no PII)
  try {
    const { v4: uuidv4 } = require('uuid');
    auditService.recordProcessingHistory({
      jobId: uuidv4(),
      originalFileName: 'customers_table',
      fileFormat: 'db_table',
      fileSize: records.length,
      operation: 'mask',
      maskingType: normalizedOp,
      detectedCount: SENSITIVE_COLUMNS.length * records.length,
      processedCount: SENSITIVE_COLUMNS.length * records.length,
      riskLevel: 'Medium',
      processingTimeSeconds: 0.05,
      outputFileName: `customers_${normalizedOp}`,
      status: 'success',
    });
  } catch (auditErr) {
    console.warn('[DB Protection Warning] Failed to log audit history:', auditErr.message);
  }

  return {
    source,
    operation: normalizedOp,
    recordCount: protectedRecords.length,
    sensitiveFields: SENSITIVE_COLUMNS,
    records: protectedRecords,
  };
}

// In-memory array for saved protected records when PostgreSQL is offline/unconfigured
const MOCK_SAVED_PROTECTED = [];

/**
 * Save protected preview records into PostgreSQL protected_customer_data table.
 */
async function saveProtectedCustomers(operation, records) {
  const op = (operation || '').toLowerCase().trim();
  if (!ALLOWED_OPERATIONS.has(op)) {
    throw new Error(`Invalid operation: "${operation}". Must be one of the allowed 7 operations.`);
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No protected records provided to save.');
  }

  let normalizedOp = 'masking';
  if (op.startsWith('token')) normalizedOp = 'tokenization';
  else if (op.startsWith('anon')) normalizedOp = 'anonymization';
  else if (op.startsWith('pseudo')) normalizedOp = 'pseudonymization';
  else if (op.startsWith('redact')) normalizedOp = 'redaction';
  else if (op.startsWith('enc')) normalizedOp = 'encryption';
  else if (op.startsWith('hash')) normalizedOp = 'hashing';

  let savedCount = 0;

  if (db.isConfigured()) {
    try {
      for (const rec of records) {
        const sourceCustomerId = rec.id || rec.source_customer_id || null;
        const sql = `
          INSERT INTO protected_customer_data (
            source_customer_id, operation, name, email, phone, aadhaar, pan, address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `;
        const params = [
          sourceCustomerId,
          normalizedOp,
          rec.name || null,
          rec.email || null,
          rec.phone || null,
          rec.aadhaar || null,
          rec.pan || null,
          rec.address || null,
        ];
        await db.query(sql, params);
        savedCount++;
      }
      return { source: 'postgresql', savedCount, operation: normalizedOp };
    } catch (err) {
      console.warn('[DB Protection Warning] Failed to save to PostgreSQL:', err.message);
    }
  }

  // Fallback to in-memory store for offline demo
  for (const rec of records) {
    const sourceCustomerId = rec.id || rec.source_customer_id || null;
    MOCK_SAVED_PROTECTED.unshift({
      id: MOCK_SAVED_PROTECTED.length + 1,
      source_customer_id: sourceCustomerId,
      operation: normalizedOp,
      name: rec.name || null,
      email: rec.email || null,
      phone: rec.phone || null,
      aadhaar: rec.aadhaar || null,
      pan: rec.pan || null,
      address: rec.address || null,
      created_at: new Date().toISOString(),
    });
    savedCount++;
  }

  return { source: 'sample_fallback', savedCount, operation: normalizedOp };
}

/**
 * Fetch saved protected records from PostgreSQL (or mock fallback).
 */
async function getSavedProtectedCustomers(limitRaw = 50) {
  const limit = Math.min(Math.max(parseInt(limitRaw || '50', 10) || 50, 1), 100);

  if (db.isConfigured()) {
    try {
      const sql = `
        SELECT id, source_customer_id, operation, name, email, phone, aadhaar, pan, address, created_at
        FROM protected_customer_data
        ORDER BY created_at DESC
        LIMIT $1;
      `;
      const res = await db.query(sql, [limit]);
      if (res && res.rows) {
        return { source: 'postgresql', records: res.rows };
      }
    } catch (err) {
      console.warn('[DB Protection Warning] Failed to query protected_customer_data:', err.message);
    }
  }

  return { source: 'sample_fallback', records: MOCK_SAVED_PROTECTED.slice(0, limit) };
}

module.exports = {
  getCustomers,
  protectCustomers,
  saveProtectedCustomers,
  getSavedProtectedCustomers,
  SENSITIVE_COLUMNS,
  ALLOWED_OPERATIONS,
};
