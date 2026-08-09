'use strict';

/**
 * Parquet Handler
 * Uses parquetjs-lite to read/write Parquet files.
 * Only string-typed fields are modified; numeric and boolean fields are preserved.
 */

const fs = require('fs');
const parquet = require('parquetjs-lite');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const encrypted = encrypt(plaintext, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  const notes = ['Only UTF8/string-typed columns are modified. Numeric and boolean columns are preserved.'];
  let count = 0;

  const reader = await parquet.ParquetReader.openFile(filePath);
  const schema = reader.schema;
  const cursor = reader.getCursor();

  const rows = [];
  let row;
  while ((row = await cursor.next()) !== null) {
    rows.push(row);
  }
  await reader.close();

  // Determine string fields from schema — parquetjs-lite 0.8.x stores fields differently
  const fields = schema.fields || {};
  const stringFields = new Set();
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    // parquetjs-lite represents types as { type: 'UTF8' } or { originalType: 'UTF8' }
    const primitiveType = (fieldDef.primitiveType || '').toUpperCase();
    const originalType  = (fieldDef.originalType  || '').toUpperCase();
    const logicalType   = (fieldDef.name           || '').toUpperCase();
    if (
      primitiveType === 'BYTE_ARRAY' ||
      originalType  === 'UTF8'       ||
      originalType  === 'STRING'     ||
      // Fallback: if the stored value for this field is a string in the first row
      (rows.length > 0 && typeof rows[0][fieldName] === 'string')
    ) {
      stringFields.add(fieldName);
    }
  }

  const processed = rows.map(r => {
    const newRow = { ...r };
    for (const field of stringFields) {
      const val = r[field];
      if (typeof val !== 'string' || val === '') continue;
      const { protect } = shouldProtect(val, field);
      if (protect) {
        count++;
        newRow[field] = operation === 'hash' ? hash(val, options.algorithm) : maskValue(val, field);
      }
    }
    return newRow;
  });

  const outPath = makeOutputPath(outputDir, originalName, operation);
  const writer = await parquet.ParquetWriter.openFile(schema, outPath);
  for (const r of processed) {
    await writer.appendRow(r);
  }
  await writer.close();
  return { outputPath: outPath, count, notes };
}

module.exports = { process };
