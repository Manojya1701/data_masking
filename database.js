const Database = require("better-sqlite3");
const path = require("path");

const databasePath = path.join(
  __dirname,
  "anonymization.db"
);

const db = new Database(databasePath);

db.exec(`
CREATE TABLE IF NOT EXISTS privacy_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    data_type TEXT NOT NULL,

    original_value TEXT NOT NULL,

    masked_value TEXT NOT NULL,

    redacted_value TEXT NOT NULL,

    salt TEXT NOT NULL,

    hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',

    salted_hash TEXT NOT NULL,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pdf_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    file_name TEXT NOT NULL,

    original_pdf_path TEXT NOT NULL,

    masked_pdf_path TEXT NOT NULL,

    original_text TEXT NOT NULL,

    masked_text TEXT NOT NULL,

    salt TEXT NOT NULL,

    hash_algorithm TEXT NOT NULL,

    salted_hash TEXT NOT NULL,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

console.log("SQLite database connected.");
console.log("privacy_records table created.");
console.log("pdf_records table created.");

module.exports = db;