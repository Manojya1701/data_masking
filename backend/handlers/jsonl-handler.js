'use strict';

const fs = require('fs');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

function traverseObject(obj, operation, options, stats) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => traverseObject(v, operation, options, stats));
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const { protect } = shouldProtect(v, k);
      if (protect && v.trim() !== '') {
        stats.count++;
        result[k] = operation === 'hash' ? hash(v, options.algorithm) : maskValue(v, k);
        continue;
      }
    }
    result[k] = traverseObject(v, operation, options, stats);
  }
  return result;
}

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const encrypted = encrypt(plaintext, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const stats = { count: 0 };
  const outLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { outLines.push(''); continue; }
    try {
      const obj = JSON.parse(trimmed);
      const processed = traverseObject(obj, operation, options, stats);
      outLines.push(JSON.stringify(processed));
    } catch {
      outLines.push(line); // preserve unparseable lines as-is
    }
  }

  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  return { outputPath: outPath, count: stats.count };
}

module.exports = { process };
