'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

function traverseNode(node, operation, options, stats) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    const { protect } = shouldProtect(node);
    if (protect && node.trim() !== '') {
      stats.count++;
      return operation === 'hash' ? hash(node, options.algorithm) : maskValue(node);
    }
    return node;
  }
  if (typeof node === 'number' || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(v => traverseNode(v, operation, options, stats));
  if (typeof node === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') {
        const { protect } = shouldProtect(v, k);
        if (protect && v.trim() !== '') {
          stats.count++;
          result[k] = operation === 'hash' ? hash(v, options.algorithm) : maskValue(v, k);
          continue;
        }
      }
      result[k] = traverseNode(v, operation, options, stats);
    }
    return result;
  }
  return node;
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
  let data;
  try {
    data = yaml.load(raw, { schema: yaml.FAILSAFE_SCHEMA });
  } catch (e) {
    throw new Error(`Invalid YAML: ${e.message}`);
  }

  const stats = { count: 0 };
  const processed = traverseNode(data, operation, options, stats);
  const outYaml = yaml.dump(processed, { lineWidth: -1 });
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outYaml, 'utf8');
  return { outputPath: outPath, count: stats.count };
}

module.exports = { process };
