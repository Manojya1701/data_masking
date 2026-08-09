'use strict';

/**
 * TSV Handler — same as CSV but TAB-delimited.
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

async function process({ filePath, originalName, outputDir, operation, options }) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const records = parse(raw, { columns: true, delimiter: '\t', skip_empty_lines: true, relax_column_count: true });

  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const encrypted = encrypt(plaintext, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0, notes: ['Entire TSV file encrypted as binary blob.'] };
  }

  let count = 0;
  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  const processed = records.map(row => {
    const newRow = {};
    for (const col of headers) {
      const val = row[col];
      const { protect } = shouldProtect(String(val ?? ''), col);
      if (protect && val !== undefined && val !== null && val !== '') {
        count++;
        newRow[col] = operation === 'hash' ? hash(String(val), options.algorithm) : maskValue(String(val), col);
      } else {
        newRow[col] = val;
      }
    }
    return newRow;
  });

  const outTsv = stringify(processed, { header: true, columns: headers, delimiter: '\t' });
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outTsv, 'utf8');
  return { outputPath: outPath, count };
}

module.exports = { process };
