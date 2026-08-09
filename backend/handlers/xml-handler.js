'use strict';

const fs = require('fs');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

function traverseXml(node, operation, options, stats) {
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
  if (Array.isArray(node)) return node.map(v => traverseXml(v, operation, options, stats));
  if (typeof node === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(node)) {
      // Skip XML attributes (they start with @_) and special keys
      if (k.startsWith('@_') || k === '#text') {
        if (k === '#text' && typeof v === 'string') {
          const { protect } = shouldProtect(v);
          if (protect && v.trim() !== '') {
            stats.count++;
            result[k] = operation === 'hash' ? hash(v, options.algorithm) : maskValue(v);
            continue;
          }
        }
        result[k] = v;
        continue;
      }
      result[k] = traverseXml(v, operation, options, stats);
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
  const parserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
  };
  const parser = new XMLParser(parserOptions);
  let data;
  try {
    data = parser.parse(raw);
  } catch (e) {
    throw new Error(`Invalid XML: ${e.message}`);
  }

  const stats = { count: 0 };
  const processed = traverseXml(data, operation, options, stats);

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    format: true,
  });
  const outXml = builder.build(processed);
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outXml, 'utf8');
  return { outputPath: outPath, count: stats.count };
}

module.exports = { process };
