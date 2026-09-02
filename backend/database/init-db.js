'use strict';

/**
 * Database Initialization
 * Creates required tables using schema.sql.
 *
 * CLI:
 *   npm run db:init
 *
 * Server startup:
 *   const { initializeSchema } = require('./database/init-db');
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../../.env')
});

const db = require('./db');


/* =========================================================
   REUSABLE SCHEMA INITIALIZER
========================================================= */

async function initializeSchema() {

  if (!db.isConfigured()) {

    console.log(
      '[DB Init] DATABASE_URL is not configured. Skipping database initialization.'
    );

    return false;
  }


  const schemaPath =
    path.join(
      __dirname,
      'schema.sql'
    );


  const sql =
    fs.readFileSync(
      schemaPath,
      'utf8'
    );


  console.log(
    '[DB Init] Checking PostgreSQL schema…'
  );


  await db.query(sql);

  // Check if customers table is empty and seed 5 sample records
  try {
    const countRes = await db.query('SELECT COUNT(*) AS total FROM customers;');
    const total = parseInt(countRes?.rows?.[0]?.total || '0', 10);
    if (total === 0) {
      console.log('[DB Init] Seeding sample customer records for operations…');
      await db.query(`
        INSERT INTO customers (name, email, phone, aadhaar, pan, address) VALUES
        ('Harika', 'harika@example.com', '9876543210', '1234 5678 9012', 'ABCDE1234F', 'Visakhapatnam'),
        ('Ravi Kumar', 'ravi.k@example.com', '9123456789', '2345 6789 0123', 'BCDEF2345G', 'Hyderabad'),
        ('Ananya Sharma', 'ananya@example.com', '9988776655', '3456 7890 1234', 'CDEFG3456H', 'Bengaluru'),
        ('Vikram Patel', 'vikram.p@example.com', '9876501234', '4567 8901 2345', 'DEFGH4567I', 'Mumbai'),
        ('Priya Das', 'priya.das@example.com', '9765432109', '5678 9012 3456', 'EFGHI5678J', 'Chennai');
      `);
      console.log('[DB Init] ✅ Seeded 5 sample customer records.');
    }
  } catch (seedErr) {
    console.warn('[DB Init] Seeding warning:', seedErr.message);
  }

  // Seed sample privacy deletion records into PostgreSQL ONLY IF table is completely empty (delTotal === 0)
  try {
    const delCountRes = await db.query('SELECT COUNT(*) AS total FROM privacy_deletion_customers;');
    const delTotal = parseInt(delCountRes?.rows?.[0]?.total || '0', 10);
    if (delTotal === 0) {
      console.log('[DB Init] Table empty. Seeding 8 initial sample privacy deletion records…');
      await db.query(`
        INSERT INTO privacy_deletion_customers (first_name, last_name, email) VALUES
        ('Rahul', 'Kumar', 'rahul@gmail.com'),
        ('Priya', 'Sharma', 'priya@gmail.com'),
        ('Arjun', 'Reddy', 'arjun@gmail.com'),
        ('Sneha', 'Patel', 'sneha.p@gmail.com'),
        ('Vikram', 'Verma', 'vikram.v@example.com'),
        ('Ananya', 'Roy', 'ananya.roy@example.com'),
        ('Karthik', 'Nair', 'karthik.n@gmail.com'),
        ('Divya', 'Das', 'divya.das@example.com');
      `);
      console.log('[DB Init] ✅ Seeded 8 sample privacy deletion customer records into PostgreSQL.');
    }
  } catch (delSeedErr) {
    console.warn('[DB Init] Privacy deletion seeding warning:', delSeedErr.message);
  }

  // Seed initial sample DSAR requests into dsar_requests table
  try {
    console.log('[DB Init] Ensuring demo DSAR intake requests are seeded…');
    await db.query(`
      INSERT INTO dsar_requests (
        request_id, full_name, email, phone, customer_id, request_type, subject_category, verification_evidence, status
      ) VALUES 
        ('DSAR-2026-000123', 'John Doe', 'john.doe@example.com', '+91 98765 43210', 'CUST-8842', 'full_erasure', 'customer', 'Government ID Verified (#ID-892)', 'RECEIVED'),
        ('DSAR-2026-000456', 'Alice Smith (Low Risk Demo)', 'alice.smith@example.com', '+91 91234 56789', 'CUST-9011', 'full_erasure', 'former_customer', 'Email OTP Verified (#OTP-334)', 'RECEIVED'),
        ('DSAR-2026-000789', 'Vikram Malhotra (High Risk Demo)', 'vikram.legal@company.com', '+91 99887 76655', 'CUST-1044', 'restrict_processing', 'customer', 'Court Subpoena & Legal Compliance Lock (#LEGAL-990)', 'RECEIVED')
      ON CONFLICT (request_id) DO NOTHING;
    `);
    console.log('[DB Init] ✅ Seeded sample DSAR intake requests.');
  } catch (dsarErr) {
    console.warn('[DB Init] DSAR requests seeding warning:', dsarErr.message);
  }

  console.log(
    '[DB Init] ✅ Database tables ready.'
  );

  return true;
}


/* =========================================================
   CLI VERSION
========================================================= */

async function initDb() {

  try {

    const initialized =
      await initializeSchema();


    if (!initialized) {

      console.log(
        '[DB Init] Nothing to initialize.'
      );

      return;
    }


    console.log(
      '[DB Init] ✅ processing_history and privacy_scan_history initialized.'
    );

  } catch (err) {

    console.error(
      '[DB Init] ❌ Schema initialization failed:',
      err.message
    );

    process.exitCode = 1;

  } finally {

    /*
      Close the pool ONLY when this file
      is executed as a standalone CLI script.
    */

    await db.close();

  }
}


/* =========================================================
   RUN FROM COMMAND LINE
========================================================= */

if (require.main === module) {

  initDb();

}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  initDb,
  initializeSchema
};