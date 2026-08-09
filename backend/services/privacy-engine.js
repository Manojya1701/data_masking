'use strict';

/**
 * Privacy Engine — Central Dispatcher
 * Routes a file to the correct format handler and applies the selected operation.
 */

const { detectFormat } = require('./file-type-detector');

// Lazy-load handlers to avoid loading all deps upfront
const HANDLER_MAP = {
  csv:     () => require('../handlers/csv-handler'),
  tsv:     () => require('../handlers/tsv-handler'),
  json:    () => require('../handlers/json-handler'),
  jsonl:   () => require('../handlers/jsonl-handler'),
  yaml:    () => require('../handlers/yaml-handler'),
  xml:     () => require('../handlers/xml-handler'),
  html:    () => require('../handlers/html-handler'),
  pdf:     () => require('../handlers/pdf-handler'),
  parquet: () => require('../handlers/parquet-handler'),
  avro:    () => require('../handlers/avro-handler'),
  orc:     () => require('../handlers/orc-handler'),
  image:   () => require('../handlers/image-handler'),
};

/**
 * Process a file through the privacy pipeline.
 *
 * @param {object} opts
 * @param {string}  opts.filePath      Absolute path to the uploaded file
 * @param {string}  opts.originalName  Original filename (for extension detection)
 * @param {string}  opts.outputDir     Directory to write the protected file
 * @param {'mask'|'hash'|'encrypt'} opts.operation
 * @param {object}  opts.options       Operation-specific options:
 *   - algorithm: 'sha256' | 'sha3-256' | 'blake3'  (for hash)
 *   - password: string  (for encrypt)
 * @returns {Promise<{ outputPath: string, format: string, count: number, notes: string[] }>}
 */
async function processFile({ filePath, originalName, outputDir, operation, options = {} }) {
  // 1. Detect format
  const { format, confidence } = detectFormat(filePath, originalName);
  if (format === 'unknown') {
    throw new Error('Unsupported or unrecognized file format.');
  }

  // 2. Validate operation
  const validOps = ['mask', 'hash', 'encrypt'];
  if (!validOps.includes(operation)) {
    throw new Error(`Invalid operation: ${operation}. Must be one of: ${validOps.join(', ')}`);
  }

  // 3. Validate options
  if (operation === 'encrypt' && !options.password) {
    throw new Error('A password is required for encryption.');
  }
  if (operation === 'hash' && !options.algorithm) {
    options.algorithm = 'sha256';
  }

  // 4. Load handler
  const handlerLoader = HANDLER_MAP[format];
  if (!handlerLoader) {
    throw new Error(`No handler registered for format: ${format}`);
  }
  const handler = handlerLoader();

  // 5. Run handler
  const result = await handler.process({
    filePath,
    originalName,
    outputDir,
    operation,
    options,
    format,
  });

  return {
    outputPath: result.outputPath,
    format,
    confidence,
    count: result.count || 0,
    notes: result.notes || [],
  };
}

module.exports = { processFile };
