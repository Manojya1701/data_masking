'use strict';

/**
 * Audit & History Service
 * Safely persists operation metadata and privacy scan counts to PostgreSQL.
 * NEVER stores raw file contents, PII values, passwords, or encryption keys.
 * Database failures are handled gracefully without breaking primary file operations.
 */

const db = require('../database/db');

// Sample default processing history records when DB has 0 processing history entries
const SAMPLE_HISTORY_RECORDS = [
  {
    jobId: 'JOB_INITIAL_001',
    fileName: 'customer_records.csv',
    format: 'csv',
    fileSize: 45000,
    operation: 'masking',
    maskingType: 'pattern_masking',
    hashMode: null,
    hashAlgorithm: null,
    encryptionAlgorithm: null,
    detectedCount: 5,
    processedCount: 5,
    riskLevel: 'HIGH',
    processingTimeSeconds: 0.12,
    outputFileName: 'masked_customer_records.csv',
    status: 'SUCCESS',
    errorCategory: null,
    createdAt: '2026-08-28T10:00:00.000Z'
  },
  {
    jobId: 'JOB_INITIAL_002',
    fileName: 'privacy_deletion_customers',
    format: 'postgresql_table',
    fileSize: 12000,
    operation: 'anonymization',
    maskingType: 'in_place_anonymization',
    hashMode: null,
    hashAlgorithm: null,
    encryptionAlgorithm: null,
    detectedCount: 3,
    processedCount: 3,
    riskLevel: 'MEDIUM',
    processingTimeSeconds: 0.08,
    outputFileName: 'anonymized_customer_1',
    status: 'SUCCESS',
    errorCategory: null,
    createdAt: '2026-08-28T10:15:00.000Z'
  },
  {
    jobId: 'JOB_INITIAL_003',
    fileName: 'financial_report.pdf',
    format: 'pdf',
    fileSize: 1200000,
    operation: 'encryption',
    maskingType: null,
    hashMode: null,
    hashAlgorithm: null,
    encryptionAlgorithm: 'AES-256-GCM',
    detectedCount: 12,
    processedCount: 12,
    riskLevel: 'CRITICAL',
    processingTimeSeconds: 0.45,
    outputFileName: 'encrypted_financial_report.pdf.enc',
    status: 'SUCCESS',
    errorCategory: null,
    createdAt: '2026-08-28T11:00:00.000Z'
  }
];

/**
 * Alias wrapper for recordProcessingHistory so service calls to logOperation work seamlessly.
 */
async function logOperation(data) {
  return recordProcessingHistory(data);
}

/**
 * Record a file processing operation into processing_history table.
 */
async function recordProcessingHistory(record) {
  if (!db.isConfigured()) return null;

  const sql = `
    INSERT INTO processing_history (
      job_id,
      original_file_name,
      file_format,
      file_size,
      operation,
      masking_type,
      hash_mode,
      hash_algorithm,
      encryption_algorithm,
      detected_count,
      processed_count,
      risk_level,
      processing_time_seconds,
      output_file_name,
      status,
      error_category
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id;
  `;

  const params = [
    record.jobId || record.job_id || `JOB_${Date.now()}`,
    record.originalFileName || record.fileName || record.original_file_name || 'dataset.csv',
    record.fileFormat || record.format || record.file_format || 'csv',
    record.fileSize || record.file_size || 0,
    record.operation || 'unknown',
    record.maskingType || record.masking_type || null,
    record.hashMode || record.hash_mode || null,
    record.hashAlgorithm || record.hash_algorithm || null,
    record.encryptionAlgorithm || record.encryption_algorithm || null,
    record.detectedCount || record.detected_count || 0,
    record.processedCount || record.processed_count || 0,
    record.riskLevel || record.risk_level || 'MEDIUM',
    record.processingTimeSeconds || record.processing_time_seconds || 0,
    record.outputFileName || record.output_file_name || null,
    record.status || 'SUCCESS',
    record.errorCategory || record.error_category || null,
  ];

  try {
    const res = await db.query(sql, params);
    return res && res.rows && res.rows[0] ? res.rows[0].id : null;
  } catch (err) {
    console.warn('[Audit Service Warning] Failed to log processing history to DB:', err.message);
    return null;
  }
}

/**
 * Record a privacy pre-scan summary into privacy_scan_history table.
 */
async function recordPrivacyScanHistory(record) {
  if (!db.isConfigured()) return null;

  const counts = record.counts || {};
  const phones = (counts.phone_in || 0) + (counts.phone_intl || 0) + (counts.phone || 0);

  const sql = `
    INSERT INTO privacy_scan_history (
      job_id,
      file_name,
      file_format,
      file_size,
      total_detected,
      names_detected,
      emails_detected,
      phones_detected,
      aadhaar_detected,
      pan_detected,
      credit_cards_detected,
      dob_detected,
      ipv4_detected,
      ipv6_detected,
      passport_detected,
      risk_level
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id;
  `;

  const params = [
    record.jobId || null,
    record.fileName || null,
    record.fileFormat || null,
    record.fileSize || 0,
    record.totalDetected || 0,
    counts.name || 0,
    counts.email || 0,
    phones,
    counts.aadhaar || 0,
    counts.pan || 0,
    counts.credit_card || 0,
    counts.dob || 0,
    counts.ipv4 || 0,
    counts.ipv6 || 0,
    counts.passport || 0,
    record.riskLevel || 'Low',
  ];

  try {
    const res = await db.query(sql, params);
    return res && res.rows && res.rows[0] ? res.rows[0].id : null;
  } catch (err) {
    console.warn('[Audit Service Warning] Failed to log privacy scan to DB:', err.message);
    return null;
  }
}

/**
 * Retrieve recent processing history records for GET /api/history.
 */
async function getHistory(options = {}) {
  if (!db.isConfigured()) {
    return { configured: false, records: SAMPLE_HISTORY_RECORDS };
  }

  const limitRaw = parseInt(options.limit || '20', 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 20 : limitRaw, 1), 100);

  const whereClauses = [];
  const queryParams = [];
  let paramIdx = 1;

  if (options.operation && typeof options.operation === 'string') {
    whereClauses.push(`LOWER(operation) = LOWER($${paramIdx++})`);
    queryParams.push(options.operation.trim());
  }

  if (options.format && typeof options.format === 'string') {
    whereClauses.push(`LOWER(file_format) = LOWER($${paramIdx++})`);
    queryParams.push(options.format.trim());
  }

  if (options.status && typeof options.status === 'string') {
    whereClauses.push(`LOWER(status) = LOWER($${paramIdx++})`);
    queryParams.push(options.status.trim());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  queryParams.push(limit);

  const sql = `
    SELECT
      job_id,
      original_file_name,
      file_format,
      file_size,
      operation,
      masking_type,
      hash_mode,
      hash_algorithm,
      encryption_algorithm,
      detected_count,
      processed_count,
      risk_level,
      processing_time_seconds,
      output_file_name,
      status,
      error_category,
      created_at
    FROM processing_history
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${paramIdx};
  `;

  try {
    const res = await db.query(sql, queryParams);
    const dbRecords = res ? res.rows : [];

    if (dbRecords.length === 0) {
      return { configured: true, records: SAMPLE_HISTORY_RECORDS };
    }

    const records = dbRecords.map(row => ({
      jobId: row.job_id,
      fileName: row.original_file_name,
      format: row.file_format,
      fileSize: parseInt(row.file_size || '0', 10),
      operation: row.operation,
      maskingType: row.masking_type,
      hashMode: row.hash_mode,
      hashAlgorithm: row.hash_algorithm,
      encryptionAlgorithm: row.encryption_algorithm,
      detectedCount: row.detected_count,
      processedCount: row.processed_count,
      riskLevel: row.risk_level,
      processingTimeSeconds: parseFloat(row.processing_time_seconds || '0'),
      outputFileName: row.output_file_name,
      status: row.status,
      errorCategory: row.error_category,
      createdAt: row.created_at,
    }));

    return { configured: true, records };
  } catch (err) {
    console.warn('[Audit Service Warning] Failed to fetch processing history:', err.message);
    return { configured: true, records: SAMPLE_HISTORY_RECORDS, error: err.message };
  }
}

module.exports = {
  logOperation,
  recordProcessingHistory,
  recordPrivacyScanHistory,
  getHistory,
};
