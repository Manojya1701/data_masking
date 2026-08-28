'use strict';

/**
 * Global Database Email Search Service
 * Searches for an email address across all database tables in UDPS.
 * Returns match counts per table, total matches, and matching record details.
 * Supports PostgreSQL and Local File Database Engine.
 */

const db = require('../database/db');

// Registry of database tables containing email fields (easily extensible for future tables)
const DB_TABLE_REGISTRY = [
  {
    tableName: 'privacy_deletion_customers',
    displayName: 'Privacy Data Deletion Table',
    emailColumn: 'email',
    columnsToSelect: ['id', 'first_name', 'last_name', 'email', 'created_at']
  },
  {
    tableName: 'customers',
    displayName: 'Customer Operations Table',
    emailColumn: 'email',
    columnsToSelect: ['id', 'name', 'email', 'phone', 'aadhaar', 'pan', 'address', 'created_at']
  },
  {
    tableName: 'protected_customer_data',
    displayName: 'Saved Protected Customer Data Table',
    emailColumn: 'email',
    columnsToSelect: ['id', 'source_customer_id', 'operation', 'name', 'email', 'phone', 'aadhaar', 'pan', 'created_at']
  }
];

/**
 * Search for an email address across all registered database tables.
 * @param {string} rawEmail - Email query string
 * @returns {Promise<Object>} Search result aggregation
 */
async function searchEmailInDatabase(rawEmail) {
  const query = (rawEmail || '').trim().toLowerCase();
  if (!query) {
    throw new Error('Email query parameter is required');
  }

  const tableResults = [];
  let totalMatches = 0;
  let tableMatchesCount = 0;

  for (const tableConfig of DB_TABLE_REGISTRY) {
    const { tableName, displayName, emailColumn, columnsToSelect } = tableConfig;
    let records = [];

    try {
      if (db.isPostgresConfigured()) {
        const cols = columnsToSelect.join(', ');
        const sql = `SELECT ${cols} FROM ${tableName} WHERE LOWER(${emailColumn}) LIKE $1 ORDER BY id ASC;`;
        const res = await db.query(sql, [`%${query}%`]);
        if (res && res.rows) {
          records = res.rows;
        }
      } else {
        // Use local DB engine / fallback query
        const sql = `SELECT * FROM ${tableName};`;
        const res = await db.query(sql);
        if (res && res.rows) {
          records = res.rows.filter(row => {
            const val = (row[emailColumn] || '').toLowerCase();
            return val.includes(query);
          });
        }
      }
    } catch (err) {
      console.warn(`[Email Search Warning] Failed to query table ${tableName}:`, err.message);
    }

    if (records.length > 0) {
      tableMatchesCount++;
      totalMatches += records.length;
      tableResults.push({
        tableName,
        displayName,
        matchCount: records.length,
        records
      });
    }
  }

  return {
    success: true,
    email: query,
    found: totalMatches > 0,
    totalMatches,
    tablesSearched: DB_TABLE_REGISTRY.length,
    tableMatchesCount,
    matches: tableResults
  };
}

module.exports = {
  searchEmailInDatabase,
  DB_TABLE_REGISTRY
};
