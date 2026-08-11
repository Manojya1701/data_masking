'use strict';

/**
 * Database Initialization Script
 * Runs schema.sql to create processing_history and privacy_scan_history tables.
 * Usage: npm run db:init
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('./db');

async function initDb() {
  if (!db.isConfigured()) {
    console.log('[DB Init] DATABASE_URL is not set in environment variables.');
    console.log('[DB Init] Please configure DATABASE_URL in .env before running db:init.');
    process.exit(0);
  }

  console.log('[DB Init] Connecting to PostgreSQL database…');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await db.query(sql);
    console.log('[DB Init] ✅ Tables initialized successfully (processing_history, privacy_scan_history).');
  } catch (err) {
    console.error('[DB Init] ❌ Schema initialization failed:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { initDb };
