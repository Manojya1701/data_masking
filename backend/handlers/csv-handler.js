'use strict';

/**
 * CSV Handler
 * Parses CSV, applies mask/hash/encrypt to sensitive cells, writes output.
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');
const path = require('path');

async function process({ filePath, originalName, outputDir, operation, options }) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });

  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const ext = path.extname(originalName) || '.csv';
    const encrypted = encrypt(plaintext, options.password, {
      algorithm:    options.encAlgorithm || 'aes-256-gcm',
      originalName: path.basename(originalName),
      originalExt:  ext,
    });
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0, notes: ['Entire CSV file encrypted as binary blob.'] };
  }

  let count = 0;
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const pseudoMap = {}; // shared within this file for consistent pseudonymization

  const processed = records.map(row => {
    const newRow = {};
    for (const col of headers) {
      const val = row[col];
      const strVal = String(val ?? '');
      const { protect, type } = shouldProtect(strVal, col);
      if (protect && val !== undefined && val !== null && val !== '') {
        count++;
        if (operation === 'hash') {
          newRow[col] = hash(strVal, options.algorithm);
        } else {
          newRow[col] = maskValue(strVal, col, options.maskingType, pseudoMap, type);
        }
      } else {
        newRow[col] = val;
      }
    }
    return newRow;
  });

  const outCsv = stringify(processed, { header: true, columns: headers });
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outCsv, 'utf8');
  return { outputPath: outPath, count };
}

module.exports = { process };
