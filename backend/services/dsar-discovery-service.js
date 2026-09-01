'use strict';

/**
 * DSAR Step 2: Identity Resolution & Data Discovery Service
 * Scans connected database tables and file history logs to find all matching PII
 * records belonging to a data subject, generating a linked Identity Data Map.
 */

const db = require('../database/db');
const dsarService = require('./dsar-service');

const FALLBACK_DISCOVERY_MAPS = {};

/**
 * Execute Identity Resolution & Cross-System PII Data Discovery Scan.
 * @param {string} requestId - Tracking ID (e.g. DSAR-2026-000123)
 */
async function performIdentityDiscovery(requestId) {
  if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
    return { success: false, message: 'Valid DSAR Tracking ID is required' };
  }

  const cleanReqId = requestId.trim();
  const requestRes = await dsarService.getDsarRequestById(cleanReqId);

  if (!requestRes.success || !requestRes.record) {
    return { success: false, message: `DSAR Request with Tracking ID ${cleanReqId} not found` };
  }

  const reqData = requestRes.record;
  const targetEmail = (reqData.email || '').trim().toLowerCase();
  const targetName = (reqData.full_name || '').trim();
  const targetPhone = (reqData.phone || '').trim();
  const targetCustomerId = (reqData.customer_id || '').trim();

  const discoveredTables = [];
  let totalPiiRecordsFound = 0;

  // ── 1. SCAN SYSTEM TABLE: customers ──────────────────────────────────────
  try {
    const custRes = await db.query('SELECT * FROM customers;');
    const allCustomers = custRes?.rows || [];
    const matchedCusts = allCustomers.filter(c => {
      if (!c) return false;
      const cEmail = (c.email || '').toLowerCase();
      const cPhone = (c.phone || '').toString().replace(/\D/g, '');
      const cName = (c.name || '').toLowerCase();
      const searchPhone = targetPhone.replace(/\D/g, '');

      const emailMatch = targetEmail && cEmail && cEmail.includes(targetEmail);
      const phoneMatch = searchPhone && cPhone && (cPhone.includes(searchPhone) || searchPhone.includes(cPhone));
      const nameMatch = targetName && cName && cName.includes(targetName.toLowerCase());

      return emailMatch || phoneMatch || nameMatch;
    });

    if (matchedCusts.length > 0) {
      const rowIds = matchedCusts.map(c => c.id);
      const matchedFields = new Set();
      matchedCusts.forEach(c => {
        if ((c.email || '').toLowerCase().includes(targetEmail)) matchedFields.add('email');
        if (targetName && (c.name || '').toLowerCase().includes(targetName.toLowerCase())) matchedFields.add('name');
        if (targetPhone && (c.phone || '').includes(targetPhone)) matchedFields.add('phone');
        if (c.aadhaar) matchedFields.add('aadhaar');
        if (c.pan) matchedFields.add('pan');
      });

      discoveredTables.push({
        systemName: 'PostgreSQL Database: customers',
        tableName: 'customers',
        matchedFields: Array.from(matchedFields),
        recordCount: matchedCusts.length,
        matchedRowIds: rowIds,
        status: 'DISCOVERED',
        sampleMatches: matchedCusts.slice(0, 3).map(c => ({ id: c.id, name: c.name, email: c.email }))
      });

      totalPiiRecordsFound += matchedCusts.length;
    } else {
      discoveredTables.push({
        systemName: 'PostgreSQL Database: customers',
        tableName: 'customers',
        matchedFields: [],
        recordCount: 0,
        matchedRowIds: [],
        status: 'NO_PII_FOUND'
      });
    }
  } catch (err) {
    console.warn('[DSAR Discovery] Failed to scan customers table:', err.message);
  }

  // ── 2. SCAN SYSTEM TABLE: privacy_deletion_customers ─────────────────────
  try {
    const delCustRes = await db.query('SELECT * FROM privacy_deletion_customers;');
    const allDelCusts = delCustRes?.rows || [];
    const matchedDelCusts = allDelCusts.filter(c => {
      if (!c) return false;
      const cEmail = (c.email || '').toLowerCase();
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase();
      const emailMatch = targetEmail && cEmail && cEmail.includes(targetEmail);
      const nameMatch = targetName && fullName && fullName.includes(targetName.toLowerCase());
      return emailMatch || nameMatch;
    });

    if (matchedDelCusts.length > 0) {
      const rowIds = matchedDelCusts.map(c => c.id);
      discoveredTables.push({
        systemName: 'PostgreSQL Database: privacy_deletion_customers',
        tableName: 'privacy_deletion_customers',
        matchedFields: ['email', 'first_name', 'last_name'],
        recordCount: matchedDelCusts.length,
        matchedRowIds: rowIds,
        status: 'DISCOVERED',
        sampleMatches: matchedDelCusts.slice(0, 3).map(c => ({ id: c.id, email: c.email, name: `${c.first_name} ${c.last_name}` }))
      });
      totalPiiRecordsFound += matchedDelCusts.length;
    } else {
      discoveredTables.push({
        systemName: 'PostgreSQL Database: privacy_deletion_customers',
        tableName: 'privacy_deletion_customers',
        matchedFields: [],
        recordCount: 0,
        matchedRowIds: [],
        status: 'NO_PII_FOUND'
      });
    }
  } catch (err) {
    console.warn('[DSAR Discovery] Failed to scan privacy_deletion_customers table:', err.message);
  }

  // ── 3. SCAN SYSTEM TABLE: protected_customer_data ────────────────────────
  try {
    const protRes = await db.query('SELECT * FROM protected_customer_data;');
    const allProt = protRes?.rows || [];
    const matchedProt = allProt.filter(p => {
      if (!p) return false;
      const pEmail = (p.email || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const emailMatch = targetEmail && pEmail && pEmail.includes(targetEmail);
      const nameMatch = targetName && pName && pName.includes(targetName.toLowerCase());
      return emailMatch || nameMatch;
    });

    if (matchedProt.length > 0) {
      const rowIds = matchedProt.map(p => p.id);
      discoveredTables.push({
        systemName: 'PostgreSQL Database: protected_customer_data',
        tableName: 'protected_customer_data',
        matchedFields: ['email', 'name', 'operation'],
        recordCount: matchedProt.length,
        matchedRowIds: rowIds,
        status: 'DISCOVERED',
        sampleMatches: matchedProt.slice(0, 3).map(p => ({ id: p.id, name: p.name, email: p.email, operation: p.operation }))
      });
      totalPiiRecordsFound += matchedProt.length;
    } else {
      discoveredTables.push({
        systemName: 'PostgreSQL Database: protected_customer_data',
        tableName: 'protected_customer_data',
        matchedFields: [],
        recordCount: 0,
        matchedRowIds: [],
        status: 'NO_PII_FOUND'
      });
    }
  } catch (err) {
    console.warn('[DSAR Discovery] Failed to scan protected_customer_data table:', err.message);
  }

  // ── 4. SCAN FILE STORAGE & AUDIT LOGS: processing_history ─────────────────
  try {
    const histRes = await db.query('SELECT * FROM processing_history;');
    const allHist = histRes?.rows || [];
    const matchedHist = allHist.filter(h => {
      if (!h) return false;
      const file = (h.original_file_name || '').toLowerCase();
      const out = (h.output_file_name || '').toLowerCase();
      return file.includes(targetEmail) || out.includes(targetEmail) || file.includes('customer') || out.includes('customer');
    });

    if (matchedHist.length > 0) {
      discoveredTables.push({
        systemName: 'File Storage & Audit Logs: processing_history',
        tableName: 'processing_history',
        matchedFields: ['original_file_name', 'output_file_name'],
        recordCount: matchedHist.length,
        matchedRowIds: matchedHist.map(h => h.id),
        status: 'DISCOVERED',
        sampleMatches: matchedHist.slice(0, 3).map(h => ({ id: h.id, file: h.original_file_name, operation: h.operation }))
      });
      totalPiiRecordsFound += matchedHist.length;
    } else {
      discoveredTables.push({
        systemName: 'File Storage & Audit Logs: processing_history',
        tableName: 'processing_history',
        matchedFields: [],
        recordCount: 0,
        matchedRowIds: [],
        status: 'NO_PII_FOUND'
      });
    }
  } catch (err) {
    console.warn('[DSAR Discovery] Failed to scan processing_history table:', err.message);
  }

  // Build Linked Data Map Object
  const dataMap = {
    requestId: cleanReqId,
    dataSubject: targetName,
    email: targetEmail,
    phone: targetPhone || 'N/A',
    customerId: targetCustomerId || 'N/A',
    systemsScanned: discoveredTables.length,
    totalPiiRecordsFound,
    discoveredTables,
    scannedAt: new Date().toISOString()
  };

  // Save to Database / Local DB
  try {
    const sql = `
      INSERT INTO dsar_identity_maps (
        request_id, target_email, target_name, target_phone, target_customer_id, discovered_systems_count, total_pii_records_found, data_map_json, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DISCOVERY_COMPLETED');
    `;
    await db.query(sql, [
      cleanReqId, targetEmail, targetName, targetPhone || null, targetCustomerId || null,
      discoveredTables.length, totalPiiRecordsFound, JSON.stringify(dataMap), 'DISCOVERY_COMPLETED'
    ]);

    // Update status in dsar_requests
    await db.query(`UPDATE dsar_requests SET status = 'DISCOVERY_COMPLETED' WHERE request_id = $1;`, [cleanReqId]);
  } catch (dbErr) {
    console.warn('[DSAR Discovery] Failed to save identity map to DB:', dbErr.message);
  }

  FALLBACK_DISCOVERY_MAPS[cleanReqId] = dataMap;

  return {
    success: true,
    message: `Identity Resolution & Data Discovery completed for ${cleanReqId}`,
    dataMap
  };
}

/**
 * Fetch Discovered Data Map for a DSAR Tracking ID.
 * @param {string} requestId
 */
async function getDsarDiscoveryDataMap(requestId) {
  if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
    return { success: false, message: 'Valid DSAR Tracking ID is required' };
  }

  const cleanReqId = requestId.trim();

  try {
    const res = await db.query('SELECT * FROM dsar_identity_maps WHERE request_id = $1 LIMIT 1;', [cleanReqId]);
    if (res && res.rows && res.rows.length > 0) {
      const record = res.rows[0];
      const dataMap = typeof record.data_map_json === 'string' ? JSON.parse(record.data_map_json) : record.data_map_json;
      return { success: true, record, dataMap };
    }
  } catch (err) {
    console.warn('[DSAR Discovery] Failed to fetch identity map from DB:', err.message);
  }

  if (FALLBACK_DISCOVERY_MAPS[cleanReqId]) {
    return { success: true, dataMap: FALLBACK_DISCOVERY_MAPS[cleanReqId] };
  }

  return { success: false, notFound: true, message: `No Identity Discovery map found for ${cleanReqId}` };
}

module.exports = {
  performIdentityDiscovery,
  getDsarDiscoveryDataMap
};
