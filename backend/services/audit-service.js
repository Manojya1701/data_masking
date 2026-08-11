'use strict';

/**
 * Audit & History Service
 * Safely persists operation metadata and privacy scan counts to PostgreSQL.
 * NEVER stores raw file contents, PII values, passwords, or encryption keys.
 * Database failures are handled gracefully without breaking primary file operations.
 */

const db = require('../database/db');

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
    record.jobId || null,
    record.originalFileName || null,
    record.fileFormat || null,
    record.fileSize || 0,
    record.operation || 'unknown',
    record.maskingType || null,
    record.hashMode || null,
    record.hashAlgorithm || null,
    record.encryptionAlgorithm || null,
    record.detectedCount || 0,
    record.processedCount || 0,
    record.riskLevel || null,
    record.processingTimeSeconds || 0,
    record.outputFileName || null,
    record.status || 'success',
    record.errorCategory || null,
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
    return { configured: false, records: [] };
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
    const records = (res ? res.rows : []).map(row => ({
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
    return { configured: true, records: [], error: err.message };
  }
}

module.exports = {
  recordProcessingHistory,
  recordPrivacyScanHistory,
  getHistory,
};
