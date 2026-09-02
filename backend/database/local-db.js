'use strict';

/**
 * Local File Database Engine (udps_local_db)
 * Provides persistent local database table storage for offline and Render environments.
 * Supports SQL query parsing for SELECT, INSERT, UPDATE, DELETE, COUNT, and health checks.
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'udps_local_db.json');

// Default database structure with seeded records
const DEFAULT_STORE = {
  privacy_deletion_customers: [
    { id: 1, first_name: 'Rahul', last_name: 'Kumar', email: 'rahul@gmail.com', created_at: '2026-08-15T10:00:00.000Z' },
    { id: 2, first_name: 'Priya', last_name: 'Sharma', email: 'priya@gmail.com', created_at: '2026-08-15T10:05:00.000Z' },
    { id: 3, first_name: 'Arjun', last_name: 'Reddy', email: 'arjun@gmail.com', created_at: '2026-08-15T10:10:00.000Z' },
    { id: 4, first_name: 'Sneha', last_name: 'Patel', email: 'sneha.p@gmail.com', created_at: '2026-08-15T10:15:00.000Z' },
    { id: 5, first_name: 'Vikram', last_name: 'Verma', email: 'vikram.v@example.com', created_at: '2026-08-15T10:20:00.000Z' },
    { id: 6, first_name: 'Ananya', last_name: 'Roy', email: 'ananya.roy@example.com', created_at: '2026-08-15T10:25:00.000Z' },
    { id: 7, first_name: 'Karthik', last_name: 'Nair', email: 'karthik.n@gmail.com', created_at: '2026-08-15T10:30:00.000Z' },
    { id: 8, first_name: 'Divya', last_name: 'Das', email: 'divya.das@example.com', created_at: '2026-08-15T10:35:00.000Z' }
  ],
  customers: [
    { id: 1, name: 'Harika', email: 'harika@example.com', phone: '9876543210', aadhaar: '1234 5678 9012', pan: 'ABCDE1234F', address: 'Visakhapatnam', created_at: '2026-08-12T10:00:00.000Z' },
    { id: 2, name: 'Ravi Kumar', email: 'ravi.k@example.com', phone: '9123456789', aadhaar: '2345 6789 0123', pan: 'BCDEF2345G', address: 'Hyderabad', created_at: '2026-08-12T10:05:00.000Z' },
    { id: 3, name: 'Ananya Sharma', email: 'ananya@example.com', phone: '9988776655', aadhaar: '3456 7890 1234', pan: 'CDEFG3456H', address: 'Bengaluru', created_at: '2026-08-12T10:10:00.000Z' },
    { id: 4, name: 'Vikram Patel', email: 'vikram.p@example.com', phone: '9876501234', aadhaar: '4567 8901 2345', pan: 'DEFGH4567I', address: 'Mumbai', created_at: '2026-08-12T10:15:00.000Z' },
    { id: 5, name: 'Priya Das', email: 'priya.das@example.com', phone: '9765432109', aadhaar: '5678 9012 3456', pan: 'EFGHI5678J', address: 'Chennai', created_at: '2026-08-12T10:20:00.000Z' }
  ],
  protected_customer_data: [],
  processing_history: [],
  privacy_scan_history: [],
  dsar_requests: [
    {
      id: 1,
      request_id: 'DSAR-2026-000123',
      full_name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+91 98765 43210',
      customer_id: 'CUST-8842',
      request_type: 'full_erasure',
      subject_category: 'customer',
      verification_evidence: 'Government ID Verified (#ID-892)',
      status: 'RECEIVED',
      created_at: '2026-08-30T10:00:00.000Z'
    },
    {
      id: 2,
      request_id: 'DSAR-2026-000456',
      full_name: 'Alice Smith',
      email: 'alice.smith@example.com',
      phone: '+91 91234 56789',
      customer_id: 'CUST-9011',
      request_type: 'full_erasure',
      subject_category: 'former_customer',
      verification_evidence: 'Email OTP Verified (#OTP-334)',
      status: 'RECEIVED',
      created_at: '2026-08-30T10:15:00.000Z'
    },
    {
      id: 3,
      request_id: 'DSAR-2026-000789',
      full_name: 'Vikram Malhotra (Legal Hold Demo)',
      email: 'vikram.legal@company.com',
      phone: '+91 99887 76655',
      customer_id: 'CUST-1044',
      request_type: 'restrict_processing',
      subject_category: 'customer',
      verification_evidence: 'Court Subpoena & Legal Compliance Lock (#LEGAL-990)',
      status: 'RECEIVED',
      created_at: '2026-08-30T10:30:00.000Z'
    }
  ]
};

let store = null;

function loadStore() {
  if (store) return store;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      store = JSON.parse(raw);
    } else {
      store = JSON.parse(JSON.stringify(DEFAULT_STORE));
      saveStore();
    }
  } catch (err) {
    console.warn('[Local DB Warning] Error loading file, using default store:', err.message);
    store = JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
  return store;
}

function saveStore() {
  if (!store) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('[Local DB Error] Failed to persist data to disk:', err.message);
  }
}

/**
 * Execute SQL-style queries against local persistent JSON table store.
 */
async function query(text, params = []) {
  const currentStore = loadStore();
  const sql = (text || '').trim();
  const lowerSql = sql.toLowerCase();

  // 1. SELECT 1 AS alive (Health check)
  if (lowerSql.includes('select 1')) {
    return { rows: [{ alive: 1 }] };
  }

  // 2. COUNT queries
  if (lowerSql.includes('select count(*)')) {
    let tableName = 'customers';
    if (lowerSql.includes('privacy_deletion_customers')) tableName = 'privacy_deletion_customers';
    else if (lowerSql.includes('protected_customer_data')) tableName = 'protected_customer_data';
    else if (lowerSql.includes('dsar_requests')) tableName = 'dsar_requests';
    
    const list = currentStore[tableName] || [];
    return { rows: [{ total: String(list.length) }] };
  }

  // 3. UPDATE privacy_deletion_customers SET first_name = $1, last_name = $2, email = $3 WHERE id = $4
  if (lowerSql.startsWith('update privacy_deletion_customers')) {
    const fName = params[0] || 'Anonymous';
    const lName = params[1] || 'User';
    const emailVal = params[2] || 'anonymized@privacy.invalid';
    const targetId = parseInt(params[3], 10);

    const list = currentStore.privacy_deletion_customers || [];
    const item = list.find(c => c.id === targetId);
    if (item) {
      item.first_name = fName;
      item.last_name = lName;
      item.email = emailVal;
      saveStore();
      return { rowCount: 1 };
    }
    return { rowCount: 0 };
  }

  // 4. DELETE FROM privacy_deletion_customers WHERE id = $1
  if (lowerSql.startsWith('delete from privacy_deletion_customers')) {
    const targetId = parseInt(params[0], 10);
    const list = currentStore.privacy_deletion_customers || [];
    const index = list.findIndex(c => c.id === targetId);
    if (index !== -1) {
      list.splice(index, 1);
      saveStore();
      return { rowCount: 1 };
    }
    return { rowCount: 0 };
  }

  // 5. DELETE FROM customers WHERE id = $1
  if (lowerSql.startsWith('delete from customers')) {
    const targetId = parseInt(params[0], 10);
    const list = currentStore.customers || [];
    const index = list.findIndex(c => c.id === targetId);
    if (index !== -1) {
      list.splice(index, 1);
      saveStore();
      return { rowCount: 1 };
    }
    return { rowCount: 0 };
  }

  // 6. SELECT FROM privacy_deletion_customers WHERE id = $1
  if (lowerSql.startsWith('select') && lowerSql.includes('from privacy_deletion_customers') && lowerSql.includes('where id =')) {
    const targetId = parseInt(params[0], 10);
    const list = currentStore.privacy_deletion_customers || [];
    const found = list.filter(c => c.id === targetId);
    return { rows: JSON.parse(JSON.stringify(found)) };
  }

  // 7. SELECT FROM privacy_deletion_customers
  if (lowerSql.startsWith('select') && lowerSql.includes('from privacy_deletion_customers')) {
    const list = currentStore.privacy_deletion_customers || [];
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 8. SELECT FROM customers WHERE id = $1
  if (lowerSql.startsWith('select') && lowerSql.includes('from customers') && lowerSql.includes('where id =')) {
    const targetId = parseInt(params[0], 10);
    const list = currentStore.customers || [];
    const found = list.filter(c => c.id === targetId);
    return { rows: JSON.parse(JSON.stringify(found)) };
  }

  // 9. SELECT FROM customers
  if (lowerSql.startsWith('select') && lowerSql.includes('from customers')) {
    const list = currentStore.customers || [];
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 10. SELECT FROM protected_customer_data
  if (lowerSql.startsWith('select') && lowerSql.includes('from protected_customer_data')) {
    const list = currentStore.protected_customer_data || [];
    const limitMatch = sql.match(/limit\s+\$1/i);
    const limit = limitMatch && params[0] ? parseInt(params[0], 10) : 50;
    return { rows: JSON.parse(JSON.stringify(list.slice(0, limit))) };
  }

  // 11. INSERT INTO protected_customer_data
  if (lowerSql.startsWith('insert into protected_customer_data')) {
    const list = currentStore.protected_customer_data || [];
    const newRecord = {
      id: list.length + 1,
      source_customer_id: params[0] || null,
      operation: params[1] || 'masking',
      name: params[2] || null,
      email: params[3] || null,
      phone: params[4] || null,
      aadhaar: params[5] || null,
      pan: params[6] || null,
      address: params[7] || null,
      created_at: new Date().toISOString()
    };
    list.unshift(newRecord);
    saveStore();
    return { rowCount: 1 };
  }

  // 12. INSERT INTO privacy_deletion_customers
  if (lowerSql.startsWith('insert into privacy_deletion_customers')) {
    const list = currentStore.privacy_deletion_customers || [];
    const newRecord = {
      id: list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1,
      first_name: params[0] || 'New',
      last_name: params[1] || 'Customer',
      email: params[2] || `user_${Date.now()}@example.com`,
      created_at: new Date().toISOString()
    };
    list.push(newRecord);
    saveStore();
    return { rowCount: 1 };
  }

  // 13. SELECT FROM processing_history
  if (lowerSql.startsWith('select') && lowerSql.includes('from processing_history')) {
    const list = currentStore.processing_history || [];
    const limit = params.length > 0 ? parseInt(params[params.length - 1], 10) || 20 : 20;
    return { rows: JSON.parse(JSON.stringify(list.slice(0, limit))) };
  }

  // 14. INSERT INTO processing_history
  if (lowerSql.startsWith('insert into processing_history')) {
    const list = currentStore.processing_history || [];
    const newRecord = {
      id: list.length + 1,
      job_id: params[0] || `JOB_${Date.now()}`,
      original_file_name: params[1] || 'dataset.csv',
      file_format: params[2] || 'csv',
      file_size: params[3] || 0,
      operation: params[4] || 'masking',
      masking_type: params[5] || null,
      hash_mode: params[6] || null,
      hash_algorithm: params[7] || null,
      encryption_algorithm: params[8] || null,
      detected_count: params[9] || 0,
      processed_count: params[10] || 0,
      risk_level: params[11] || 'MEDIUM',
      processing_time_seconds: params[12] || 0,
      output_file_name: params[13] || null,
      status: params[14] || 'SUCCESS',
      error_category: params[15] || null,
      created_at: new Date().toISOString()
    };
    list.unshift(newRecord);
    saveStore();
    return { rows: [{ id: newRecord.id }], rowCount: 1 };
  }

  // 15. SELECT FROM dsar_requests
  if (lowerSql.startsWith('select') && lowerSql.includes('from dsar_requests')) {
    const list = currentStore.dsar_requests || [];
    if (lowerSql.includes('where')) {
      const targetId = params && params[0] ? String(params[0]).trim().toLowerCase() : '';
      const match = list.find(r => r && String(r.request_id || '').trim().toLowerCase() === targetId);
      return { rows: match ? [JSON.parse(JSON.stringify(match))] : [] };
    }
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 16. INSERT INTO dsar_requests
  if (lowerSql.startsWith('insert into dsar_requests')) {
    const list = currentStore.dsar_requests || [];
    const newRecord = {
      id: list.length > 0 ? Math.max(...list.map(r => r.id || 0)) + 1 : 1,
      request_id: params[0] || `DSAR-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      full_name: params[1] || 'Unknown',
      email: params[2] || 'unknown@example.com',
      phone: params[3] || null,
      customer_id: params[4] || null,
      request_type: params[5] || 'full_erasure',
      subject_category: params[6] || 'customer',
      verification_evidence: params[7] || null,
      status: params[8] || 'RECEIVED',
      created_at: new Date().toISOString()
    };
    list.unshift(newRecord);
    saveStore();
    return { rows: [{ id: newRecord.id, request_id: newRecord.request_id }], rowCount: 1 };
  }

  // 17. UPDATE dsar_requests SET status = $1 WHERE request_id = $2
  if (lowerSql.startsWith('update dsar_requests')) {
    const list = currentStore.dsar_requests || [];
    const newStatus = params[0];
    const reqId = params[1];
    const match = list.find(r => r && String(r.request_id || '').trim().toLowerCase() === String(reqId || '').trim().toLowerCase());
    if (match) {
      match.status = newStatus;
      saveStore();
      return { rowCount: 1 };
    }
    return { rowCount: 0 };
  }

  // 18. SELECT FROM dsar_identity_maps
  if (lowerSql.startsWith('select') && lowerSql.includes('from dsar_identity_maps')) {
    const list = currentStore.dsar_identity_maps || [];
    if (lowerSql.includes('where')) {
      const targetId = params && params[0] ? String(params[0]).trim().toLowerCase() : '';
      const match = list.find(m => m && String(m.request_id || '').trim().toLowerCase() === targetId);
      return { rows: match ? [JSON.parse(JSON.stringify(match))] : [] };
    }
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 19. INSERT INTO dsar_identity_maps
  if (lowerSql.startsWith('insert into dsar_identity_maps')) {
    if (!currentStore.dsar_identity_maps) currentStore.dsar_identity_maps = [];
    const list = currentStore.dsar_identity_maps;
    const newRecord = {
      id: list.length > 0 ? Math.max(...list.map(r => r.id || 0)) + 1 : 1,
      request_id: params[0],
      target_email: params[1],
      target_name: params[2] || null,
      target_phone: params[3] || null,
      target_customer_id: params[4] || null,
      discovered_systems_count: params[5] || 0,
      total_pii_records_found: params[6] || 0,
      data_map_json: typeof params[7] === 'string' ? JSON.parse(params[7]) : (params[7] || {}),
      status: params[8] || 'DISCOVERY_COMPLETED',
      scanned_at: new Date().toISOString()
    };
    // Remove old map if exists for re-scan
    const existingIdx = list.findIndex(m => m && String(m.request_id).trim().toLowerCase() === String(newRecord.request_id).trim().toLowerCase());
    if (existingIdx !== -1) {
      list.splice(existingIdx, 1);
    }
    list.unshift(newRecord);
    saveStore();
    return { rows: [{ id: newRecord.id, request_id: newRecord.request_id }], rowCount: 1 };
  }

  // 20. SELECT FROM dsar_impact_reports
  if (lowerSql.startsWith('select') && lowerSql.includes('from dsar_impact_reports')) {
    const list = currentStore.dsar_impact_reports || [];
    if (lowerSql.includes('where')) {
      const targetId = params && params[0] ? String(params[0]).trim().toLowerCase() : '';
      const match = list.find(m => m && String(m.request_id || '').trim().toLowerCase() === targetId);
      return { rows: match ? [JSON.parse(JSON.stringify(match))] : [] };
    }
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 21. INSERT INTO dsar_impact_reports
  if (lowerSql.startsWith('insert into dsar_impact_reports')) {
    if (!currentStore.dsar_impact_reports) currentStore.dsar_impact_reports = [];
    const list = currentStore.dsar_impact_reports;
    const newRecord = {
      id: list.length > 0 ? Math.max(...list.map(r => r.id || 0)) + 1 : 1,
      request_id: params[0],
      risk_level: params[1] || 'LOW',
      risk_score: params[2] || 0,
      recommended_action: params[3] || 'IN_PLACE_ANONYMIZATION',
      dependencies_found_count: params[4] || 0,
      impact_report_json: typeof params[5] === 'string' ? JSON.parse(params[5]) : (params[5] || {}),
      status: params[6] || 'IMPACT_ANALYSIS_COMPLETED',
      analyzed_at: new Date().toISOString()
    };
    // Remove old report if exists for re-analysis
    const existingIdx = list.findIndex(m => m && String(m.request_id).trim().toLowerCase() === String(newRecord.request_id).trim().toLowerCase());
    if (existingIdx !== -1) {
      list.splice(existingIdx, 1);
    }
    list.unshift(newRecord);
    saveStore();
    return { rows: [{ id: newRecord.id, request_id: newRecord.request_id }], rowCount: 1 };
  }

  return { rows: [] };
}

module.exports = {
  query,
  loadStore,
  saveStore,
};
