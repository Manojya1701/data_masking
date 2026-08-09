'use strict';

/**
 * Avro Handler
 * Uses avsc to read/write Avro files.
 * Only string fields are modified; other types are preserved.
 */

const fs = require('fs');
const avro = require('avsc');
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

  return new Promise((resolve, reject) => {
    const records = [];
    let schemaType;
    let count = 0;

    const decoder = new avro.streams.BlockDecoder();
    const input = fs.createReadStream(filePath);

    decoder.on('metadata', (type) => { schemaType = type; });
    decoder.on('data', (record) => { records.push(record); });
    decoder.on('error', reject);
    decoder.on('end', async () => {
      try {
        if (!schemaType) return reject(new Error('Could not read Avro schema.'));

        // Find string fields
        const stringFields = new Set();
        function collectStringFields(schema, prefix = '') {
          if (!schema || !schema.fields) return;
          for (const f of schema.fields) {
            const fieldType = Array.isArray(f.type)
              ? f.type.find(t => t === 'string' || (typeof t === 'object' && t.type === 'string'))
              : f.type;
            if (fieldType === 'string' || (typeof fieldType === 'object' && fieldType.type === 'string')) {
              stringFields.add(prefix + f.name);
            }
          }
        }
        collectStringFields(schemaType);

        // Process records
        const processed = records.map(rec => {
          const newRec = { ...rec };
          for (const field of stringFields) {
            const val = newRec[field];
            if (typeof val !== 'string' || val === '') continue;
            const { protect } = shouldProtect(val, field);
            if (protect) {
              count++;
              newRec[field] = operation === 'hash' ? hash(val, options.algorithm) : maskValue(val, field);
            }
          }
          return newRec;
        });

        const outPath = makeOutputPath(outputDir, originalName, operation);
        const outStream = fs.createWriteStream(outPath);
        const encoder = new avro.streams.BlockEncoder(schemaType);
        encoder.pipe(outStream);
        for (const r of processed) encoder.write(r);
        encoder.end();
        outStream.on('finish', () => resolve({ outputPath: outPath, count, notes: ['Only string-typed Avro fields are modified.'] }));
        outStream.on('error', reject);
      } catch (e) { reject(e); }
    });

    input.pipe(decoder);
  });
}

module.exports = { process };
