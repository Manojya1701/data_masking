'use strict';

/**
 * Database Module (PostgreSQL / Local File Database)
 * Supports PostgreSQL connection pooling via `pg` package when DATABASE_URL is set,
 * or falls back automatically to Local SQL File Engine (local-db.js) for local & Render offline mode.
 */

const { Pool } = require('pg');
const localDb = require('./local-db');

const connectionString = process.env.DATABASE_URL || '';

function isPostgresConfigured() {
  return typeof connectionString === 'string' && connectionString.trim().length > 0;
}

function isConfigured() {
  return true; // Always configured (PostgreSQL if URL exists, or Local File Database)
}

let pool = null;

if (isPostgresConfigured()) {
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
    console.error('[PostgreSQL Pool Error]', err.message);
  });
  console.log('[Database] Connected to PostgreSQL instance.');
} else {
  console.log('[Database] PostgreSQL DATABASE_URL not provided. Active mode: Local SQL Database (udps_local_db.json).');
}

/**
 * Execute a parameterized query using PostgreSQL pool or Local SQL File Database.
 */
async function query(text, params = []) {
  if (pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.warn('[PostgreSQL Query Error, falling back to Local DB]:', err.message);
    }
  }
  return localDb.query(text, params);
}

/**
 * Health check endpoint reporting active database engine.
 */
async function healthCheck() {
  if (pool) {
    try {
      const res = await pool.query('SELECT 1 AS alive');
      if (res && res.rows && res.rows[0] && res.rows[0].alive === 1) {
        return { success: true, database: 'postgresql', mode: 'PostgreSQL Online' };
      }
    } catch (err) {
      console.warn('[PostgreSQL HealthCheck Warning]:', err.message);
    }
  }

  const localRes = await localDb.query('SELECT 1 AS alive');
  return {
    success: true,
    database: 'local_db',
    mode: 'Local SQL Database Active (udps_local_db.json)',
  };
}

/**
 * Close connections.
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  isConfigured,
  isPostgresConfigured,
  query,
  healthCheck,
  close,
  getPool: () => pool,
};
