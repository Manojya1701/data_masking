'use strict';

/**
 * Database Module (PostgreSQL)
 * Manages connection pooling via `pg` package.
 * Reads DATABASE_URL from environment variables.
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || '';

function isConfigured() {
  return typeof connectionString === 'string' && connectionString.trim().length > 0;
}

let pool = null;

if (isConfigured()) {
  const requiresSSL =
    connectionString.includes('sslmode=require') ||
    process.env.DATABASE_SSL === 'true' ||
    process.env.NODE_ENV === 'production';

  pool = new Pool({
    connectionString,
    ssl: requiresSSL ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[Database Pool Error]', err.message);
  });
} else {
  console.log('[Database] DATABASE_URL not provided. Database logging is disabled (offline mode).');
}

/**
 * Execute a parameterized query using pool.
 * Returns query result or null if DB is unconfigured/offline.
 */
async function query(text, params = []) {
  if (!pool) return null;
  return pool.query(text, params);
}

/**
 * Execute a SELECT 1 health check.
 * Returns { success: true, database: 'connected' } or { success: false, database: 'disconnected', error }
 */
async function healthCheck() {
  if (!pool) {
    return {
      success: false,
      database: 'disconnected',
      error: 'DATABASE_URL not configured',
    };
  }

  try {
    const res = await pool.query('SELECT 1 AS alive');
    if (res && res.rows && res.rows[0] && res.rows[0].alive === 1) {
      return { success: true, database: 'connected' };
    }
    return { success: false, database: 'disconnected', error: 'Unexpected response' };
  } catch (err) {
    return {
      success: false,
      database: 'disconnected',
      error: err.message || 'Connection failed',
    };
  }
}

/**
 * Close pool connection (for graceful shutdown or tests).
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  isConfigured,
  query,
  healthCheck,
  close,
  getPool: () => pool,
};
