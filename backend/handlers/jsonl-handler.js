'use strict';

const fs = require('fs');
const path = require('path');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

function traverseObject(obj, operation, options, stats, pseudoMap) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => traverseObject(v, operation, options, stats, pseudoMap));
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      const { protect, type } = shouldProtect(v, k);
      if (protect && v.trim() !== '') {
        stats.count++;
        result[k] = operation === 'hash'
          ? hash(v, options.algorithm)
          : maskValue(v, k, options.maskingType, pseudoMap, type);
        continue;
      }
    }
    result[k] = traverseObject(v, operation, options, stats, pseudoMap);
  }
  return result;
}

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const ext = path.extname(originalName) || '.jsonl';
    const encrypted = encrypt(plaintext, options.password, {
      algorithm: options.encAlgorithm || 'aes-256-gcm',
      originalName: path.basename(originalName),
      originalExt: ext,
    });
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const stats = { count: 0 };
  const pseudoMap = {};
  const outLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { outLines.push(''); continue; }
    try {
      const obj = JSON.parse(trimmed);
      const processed = traverseObject(obj, operation, options, stats, pseudoMap);
      outLines.push(JSON.stringify(processed));
    } catch {
      outLines.push(line);
    }
  }

  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  return { outputPath: outPath, count: stats.count };
}

module.exports = { process };
