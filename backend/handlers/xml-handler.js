'use strict';

const fs = require('fs');
const path = require('path');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

function traverseXml(node, operation, options, stats, pseudoMap) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    const { protect, type } = shouldProtect(node);
    if (protect && node.trim() !== '') {
      stats.count++;
      return operation === 'hash'
        ? hash(node, options.algorithm)
        : maskValue(node, null, options.maskingType, pseudoMap, type);
    }
    return node;
  }
  if (typeof node === 'number' || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(v => traverseXml(v, operation, options, stats, pseudoMap));
  if (typeof node === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('@_') || k === '#text') {
        if (k === '#text' && typeof v === 'string') {
          const { protect, type } = shouldProtect(v);
          if (protect && v.trim() !== '') {
            stats.count++;
            result[k] = operation === 'hash'
              ? hash(v, options.algorithm)
              : maskValue(v, null, options.maskingType, pseudoMap, type);
            continue;
          }
        }
        result[k] = v;
        continue;
      }
      result[k] = traverseXml(v, operation, options, stats, pseudoMap);
    }
    return result;
  }
  return node;
}

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const ext = path.extname(originalName) || '.xml';
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
  const pseudoMap = {};
  const processed = traverseXml(data, operation, options, stats, pseudoMap);

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
