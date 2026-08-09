'use strict';

const fs = require('fs');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

/**
 * Recursively traverse a JSON value, protecting sensitive strings.
 */
function traverse(node, operation, options, stats) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    const { protect } = shouldProtect(node);
    if (protect && node.trim() !== '') {
      stats.count++;
      if (operation === 'hash')  return hash(node, options.algorithm);
      if (operation === 'mask')  return maskValue(node);
    }
    return node;
  }
  if (typeof node === 'number' || typeof node === 'boolean') return node;
  if (Array.isArray(node)) {
    return node.map(item => traverse(item, operation, options, stats));
  }
  if (typeof node === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(node)) {
      if (typeof val === 'string') {
        const { protect } = shouldProtect(val, key);
        if (protect && val.trim() !== '') {
          stats.count++;
          if (operation === 'hash') result[key] = hash(val, options.algorithm);
          else if (operation === 'mask') result[key] = maskValue(val, key);
          else result[key] = val;
          continue;
        }
      }
      result[key] = traverse(val, operation, options, stats);
    }
    return result;
  }
  return node;
}

async function process({ filePath, originalName, outputDir, operation, options }) {
  const raw = fs.readFileSync(filePath, 'utf8');

  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const encrypted = encrypt(plaintext, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  const stats = { count: 0 };
  const result = traverse(data, operation, options, stats);
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  return { outputPath: outPath, count: stats.count };
}

module.exports = { process };
