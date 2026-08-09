'use strict';

/**
 * generate-test-files.js
 * Generates sample test files for all supported UDPS formats.
 * Run: node scripts/generate-test-files.js
 * Output: test-data/ directory
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../test-data');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── CSV ───────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'sample.csv'),
`id,name,email,phone,aadhaar,pan,amount
1,Ram Sharma,ram@example.com,9876543210,1234 5678 9012,ABCDE1234F,5000
2,Priya Singh,priya.singh@test.in,+919812345678,2345 6789 0123,FGHIJ5678K,12000
3,John Doe,john.doe@company.com,8765432109,3456 7890 1234,KLMNO9012P,3500
4,Anita Patel,anita@startup.io,7654321098,4567 8901 2345,QRSTU3456Q,8000
5,Bob Martin,bob.martin@email.net,6543210987,5678 9012 3456,VWXYZ7890R,25000
`);
console.log('✓ sample.csv');

// ── TSV ───────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'sample.tsv'),
`id\tname\temail\tphone\tamount
1\tRam Sharma\tram@example.com\t9876543210\t5000
2\tPriya Singh\tpriya.singh@test.in\t9812345678\t12000
3\tJohn Doe\tjohn.doe@company.com\t8765432109\t3500
`);
console.log('✓ sample.tsv');

// ── JSON ──────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'sample.json'),
JSON.stringify({
  company: 'Acme Corp',
  employees: [
    { id: 1, name: 'Ram Sharma', email: 'ram@example.com', phone: '9876543210', aadhaar: '1234 5678 9012', pan: 'ABCDE1234F' },
    { id: 2, name: 'Priya Singh', email: 'priya.singh@test.in', phone: '+919812345678' },
    { id: 3, name: 'John Doe', email: 'john.doe@company.com', department: 'Engineering' },
  ],
  metadata: { created: '2024-01-01', version: '1.0' }
}, null, 2));
console.log('✓ sample.json');

// ── JSONL ─────────────────────────────────────────────────────────────────────
const jsonlLines = [
  { id: 1, name: 'Ram Sharma',  email: 'ram@example.com',        phone: '9876543210' },
  { id: 2, name: 'Priya Singh', email: 'priya.singh@test.in',    phone: '9812345678' },
  { id: 3, name: 'John Doe',    email: 'john.doe@company.com',   event: 'login' },
].map(o => JSON.stringify(o)).join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'sample.jsonl'), jsonlLines);
console.log('✓ sample.jsonl');

// ── YAML ──────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'sample.yaml'),
`company: Acme Corp
contacts:
  - id: 1
    name: Ram Sharma
    email: ram@example.com
    phone: "9876543210"
    aadhaar: "1234 5678 9012"
    pan: ABCDE1234F
  - id: 2
    name: Priya Singh
    email: priya.singh@test.in
    phone: "+919812345678"
settings:
  environment: production
  debug: false
`);
console.log('✓ sample.yaml');

// ── XML ───────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'sample.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<employees>
  <employee id="1">
    <name>Ram Sharma</name>
    <email>ram@example.com</email>
    <phone>9876543210</phone>
    <aadhaar>1234 5678 9012</aadhaar>
    <pan>ABCDE1234F</pan>
    <department>Engineering</department>
  </employee>
  <employee id="2">
    <name>Priya Singh</name>
    <email>priya.singh@test.in</email>
    <phone>+919812345678</phone>
    <department>Marketing</department>
  </employee>
</employees>
`);
console.log('✓ sample.xml');

// ── HTML ──────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT_DIR, 'sample.html'),
`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Employee Directory</title></head>
<body>
  <h1>Employee Directory</h1>
  <table>
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
    <tbody>
      <tr><td>Ram Sharma</td><td>ram@example.com</td><td>9876543210</td></tr>
      <tr><td>Priya Singh</td><td>priya.singh@test.in</td><td>9812345678</td></tr>
      <tr><td>John Doe</td><td>john.doe@company.com</td><td>8765432109</td></tr>
    </tbody>
  </table>
  <script>console.log('This script should NOT be modified');</script>
</body>
</html>
`);
console.log('✓ sample.html');

// ── PDF (placeholder text — real PDF needs pdf-lib in test context) ────────────
// For PDF testing, copy any real PDF file into test-data/ and rename it sample.pdf
// Or generate with pdf-lib:
try {
  const { PDFDocument } = require('pdf-lib');
  (async () => {
    const doc  = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    page.drawText('Name: Ram Sharma\nEmail: ram@example.com\nPhone: 9876543210\nAadhaar: 1234 5678 9012', {
      x: 50, y: 700, size: 14,
    });
    const bytes = await doc.save();
    fs.writeFileSync(path.join(OUT_DIR, 'sample.pdf'), bytes);
    console.log('✓ sample.pdf');
  })().catch(e => console.warn('⚠ sample.pdf skipped:', e.message));
} catch {
  console.warn('⚠ sample.pdf skipped (pdf-lib not installed yet)');
}

// ── PNG (simple 100x100 pixel gradient — requires sharp) ─────────────────────
try {
  const sharp = require('sharp');
  sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 30, g: 30, b: 60 } }
  }).png().toFile(path.join(OUT_DIR, 'sample.png'))
    .then(() => console.log('✓ sample.png'))
    .catch(e => console.warn('⚠ sample.png skipped:', e.message));
} catch {
  console.warn('⚠ sample.png skipped (sharp not installed yet)');
}

console.log(`\n✅ Test files generated in: ${OUT_DIR}`);
console.log('   PDF and PNG require npm packages — run this script AFTER npm install.');
