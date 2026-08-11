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