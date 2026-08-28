'use strict';

/**
 * Local File Database Engine (udps_local_db)
 * Provides persistent local database table storage for offline and Render environments
 * when PostgreSQL DATABASE_URL is not configured.
 * Supports SQL query parsing for SELECT, INSERT, DELETE, COUNT, and health checks.
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'udps_local_db.json');

// Default database structure with seeded records
const DEFAULT_STORE = {
  privacy_deletion_customers: [
    { id: 1, first_name: 'Rahul', last_name: 'Kumar', email: 'rahul@gmail.com', created_at: '2026-08-15T10:00:00.000Z' },
    { id: 2, first_name: 'Priya', last_name: 'Sharma', email: 'priya@gmail.com', created_at: '2026-08-15T10:05:00.000Z' },
    { id: 3, first_name: 'Arjun', last_name: 'Reddy', email: 'arjun@gmail.com', created_at: '2026-08-15T10:10:00.000Z' }
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
  privacy_scan_history: []
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
    
    const list = currentStore[tableName] || [];
    return { rows: [{ total: String(list.length) }] };
  }

  // 3. DELETE FROM privacy_deletion_customers WHERE id = $1
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

  // 4. DELETE FROM customers WHERE id = $1
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

  // 5. SELECT FROM privacy_deletion_customers WHERE id = $1
  if (lowerSql.startsWith('select') && lowerSql.includes('from privacy_deletion_customers') && lowerSql.includes('where id =')) {
    const targetId = parseInt(params[0], 10);
    const list = currentStore.privacy_deletion_customers || [];
    const found = list.filter(c => c.id === targetId);
    return { rows: JSON.parse(JSON.stringify(found)) };
  }

  // 6. SELECT FROM privacy_deletion_customers
  if (lowerSql.startsWith('select') && lowerSql.includes('from privacy_deletion_customers')) {
    const list = currentStore.privacy_deletion_customers || [];
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 7. SELECT FROM customers WHERE id = $1
  if (lowerSql.startsWith('select') && lowerSql.includes('from customers') && lowerSql.includes('where id =')) {
    const targetId = parseInt(params[0], 10);
    const list = currentStore.customers || [];
    const found = list.filter(c => c.id === targetId);
    return { rows: JSON.parse(JSON.stringify(found)) };
  }

  // 8. SELECT FROM customers
  if (lowerSql.startsWith('select') && lowerSql.includes('from customers')) {
    const list = currentStore.customers || [];
    return { rows: JSON.parse(JSON.stringify(list)) };
  }

  // 9. SELECT FROM protected_customer_data
  if (lowerSql.startsWith('select') && lowerSql.includes('from protected_customer_data')) {
    const list = currentStore.protected_customer_data || [];
    const limitMatch = sql.match(/limit\s+\$1/i);
    const limit = limitMatch && params[0] ? parseInt(params[0], 10) : 50;
    return { rows: JSON.parse(JSON.stringify(list.slice(0, limit))) };
  }

  // 10. INSERT INTO protected_customer_data
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

  // 11. INSERT INTO privacy_deletion_customers
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

  // Default fallback for unrecognized queries
  return { rows: [] };
}

module.exports = {
  query,
  loadStore,
  saveStore,
};
