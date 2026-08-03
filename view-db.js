const db = require("./database");

const records = db.prepare(`
SELECT * FROM privacy_records
`).all();

console.table(records);