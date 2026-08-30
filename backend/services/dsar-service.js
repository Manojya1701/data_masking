'use strict';

/**
 * DSAR (Data Subject Access Request) Service
 * Manages Step 1 Intake Requests & Erasure Pipeline Tracking in UDPS.
 */

const db = require('../database/db');

// Fallback in-memory DSAR intake requests if DB query fails or unconfigured
let FALLBACK_DSAR_REQUESTS = [
  {
    id: 1,
    request_id: 'DSAR-2026-000123',
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+91 98765 43210',
    customer_id: 'CUST-8842',
    request_type: 'full_erasure',
    subject_category: 'customer',
    verification_evidence: 'Government ID Verified (Pass: #ID-892)',
    status: 'RECEIVED',
    created_at: new Date().toISOString()
  }
];

/**
 * Generate a unique compliance tracking ID formatted as DSAR-YYYY-XXXXXX
 */
function generateDsarTrackingId() {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `DSAR-${year}-${randomDigits}`;
}

/**
 * Submit a new DSAR Intake Request (Step 1).
 */
async function createDsarRequest(data = {}) {
  const fullName = (data.fullName || data.full_name || '').trim();
  const email = (data.email || '').trim().toLowerCase();
  const phone = (data.phone || '').trim();
  const customerId = (data.customerId || data.customer_id || '').trim();
  const requestType = (data.requestType || data.request_type || 'full_erasure').trim().toLowerCase();
  const subjectCategory = (data.subjectCategory || data.subject_category || 'customer').trim().toLowerCase();
  const verificationEvidence = (data.verificationEvidence || data.verification_evidence || '').trim();

  if (!fullName) {
    return { success: false, message: 'Data Subject Full Name is required' };
  }

  if (!email || !email.includes('@')) {
    return { success: false, message: 'Valid Data Subject Email is required' };
  }

  const requestId = generateDsarTrackingId();

  if (db.isConfigured()) {
    try {
      const sql = `
        INSERT INTO dsar_requests (
          request_id, full_name, email, phone, customer_id, request_type, subject_category, verification_evidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RECEIVED')
        RETURNING id, request_id, created_at;
      `;
      const res = await db.query(sql, [
        requestId, fullName, email, phone || null, customerId || null, requestType, subjectCategory, verificationEvidence || null
      ]);

      const record = {
        id: res?.rows?.[0]?.id || 1,
        request_id: requestId,
        full_name: fullName,
        email,
        phone,
        customer_id: customerId,
        request_type: requestType,
        subject_category: subjectCategory,
        verification_evidence: verificationEvidence,
        status: 'RECEIVED',
        created_at: res?.rows?.[0]?.created_at || new Date().toISOString()
      };

      return { success: true, message: 'DSAR Intake Request registered successfully', record };
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to insert DB request:', err.message);
    }
  }

  const newRecord = {
    id: FALLBACK_DSAR_REQUESTS.length + 1,
    request_id: requestId,
    full_name: fullName,
    email,
    phone,
    customer_id: customerId,
    request_type: requestType,
    subject_category: subjectCategory,
    verification_evidence: verificationEvidence,
    status: 'RECEIVED',
    created_at: new Date().toISOString()
  };

  FALLBACK_DSAR_REQUESTS.unshift(newRecord);
  return { success: true, message: 'DSAR Intake Request registered successfully', record: newRecord };
}

/**
 * Fetch all active DSAR Intake Requests.
 */
async function getDsarRequests() {
  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT * FROM dsar_requests ORDER BY created_at DESC;');
      if (res && res.rows && res.rows.length > 0) {
        return { success: true, count: res.rows.length, records: res.rows };
      }
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to fetch DB requests:', err.message);
    }
  }

  return { success: true, count: FALLBACK_DSAR_REQUESTS.length, records: JSON.parse(JSON.stringify(FALLBACK_DSAR_REQUESTS)) };
}

/**
 * Fetch a single DSAR Request by tracking ID.
 */
async function getDsarRequestById(requestId) {
  if (db.isConfigured()) {
    try {
      const res = await db.query('SELECT * FROM dsar_requests WHERE request_id = $1 LIMIT 1;', [requestId]);
      if (res && res.rows && res.rows.length > 0) {
        return { success: true, record: res.rows[0] };
      }
    } catch (err) {
      console.warn('[DSAR Service Warning] Failed to fetch request by ID:', err.message);
    }
  }

  const found = FALLBACK_DSAR_REQUESTS.find(r => r.request_id === requestId);
  if (found) return { success: true, record: JSON.parse(JSON.stringify(found)) };
  return { success: false, notFound: true, message: 'DSAR Request not found' };
}

module.exports = {
  createDsarRequest,
  getDsarRequests,
  getDsarRequestById,
  generateDsarTrackingId
};
