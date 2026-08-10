'use strict';

/**
 * JSON Handler
 * Recursively traverses JSON, applying mask/hash/encrypt to sensitive strings.
 */

const fs = require('fs');
const path = require('path');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

/**
 * Recursively traverse a JSON value, protecting sensitive strings.
 */
function traverse(node, operation, options, stats, pseudoMap) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    const { protect, type } = shouldProtect(node);
    if (protect && node.trim() !== '') {
      stats.count++;
      if (operation === 'hash') return hash(node, options.algorithm);
      if (operation === 'mask') return maskValue(node, null, options.maskingType, pseudoMap, type);
    }
    return node;
  }
  if (typeof node === 'number' || typeof node === 'boolean') return node;
  if (Array.isArray(node)) {
    return node.map(item => traverse(item, operation, options, stats, pseudoMap));
  }
  if (typeof node === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(node)) {
      if (typeof val === 'string') {
        const { protect, type } = shouldProtect(val, key);
        if (protect && val.trim() !== '') {
          stats.count++;
          if (operation === 'hash') {
            result[key] = hash(val, options.algorithm);
          } else if (operation === 'mask') {
            result[key] = maskValue(val, key, options.maskingType, pseudoMap, type);
          } else {
            result[key] = val;
          }
          continue;
        }
      }
      result[key] = traverse(val, operation, options, stats, pseudoMap);
    }
    return result;
  }
  return node;
}

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const ext = path.extname(originalName) || '.json';
    const encrypted = encrypt(plaintext, options.password, {
      algorithm:    options.encAlgorithm || 'aes-256-gcm',
      originalName: path.basename(originalName),
      originalExt:  ext,
    });
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  const stats = { count: 0 };
  const pseudoMap = {};
  const result = traverse(data, operation, options, stats, pseudoMap);
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  return { outputPath: outPath, count: stats.count };
}

module.exports = { process };
