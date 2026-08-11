'use strict';

/**
 * Privacy Engine — Central Dispatcher
 * Routes a file to the correct format handler and applies the selected operation.
 * Also exposes scanFile() for pre-processing privacy scan.
 */

const fs = require('fs');
const { detectFormat } = require('./file-type-detector');
const { scanText, scanRecords } = require('./sensitive-data-detector');

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
 *   - algorithm:    hash algorithm
 *   - hashMode:     'sensitive' | 'file'  (for hash)
 *   - password:     string (for encrypt)
 *   - encAlgorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305'
 *   - maskingType:  'partial' | 'redact' | 'character' | 'pseudo'
 * @returns {Promise<{ outputPath, format, count, notes, processingTime }>}
 */
async function processFile({ filePath, originalName, outputDir, operation, options = {} }) {
  const startTime = Date.now();

  // 1. Detect format
  const { format, confidence } = detectFormat(filePath, originalName);
  if (format === 'unknown') {
    throw new Error('Unsupported or unrecognized file format.');
  }
  console.log(`[Engine] format=${format} confidence=${confidence} operation=${operation}`);

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

  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Engine] Done in ${processingTime}s → ${result.outputPath}`);

  return {
    outputPath:    result.outputPath,
    format,
    confidence,
    count:         result.count || 0,
    notes:         result.notes || [],
    processingTime,
  };
}

/**
 * Pre-scan a file for sensitive data without modifying it.
 * Returns counts per PII type and a risk score.
 *
 * @param {string} filePath
 * @param {string} originalName
 * @returns {Promise<{ counts, total, riskScore, format }>}
 */
async function scanFile(filePath, originalName) {
  const { format } = detectFormat(filePath, originalName);
  let text = '';
  let imageResult = null;

  try {
    if (['csv', 'tsv', 'json', 'jsonl', 'yaml', 'xml', 'html'].includes(format)) {
      text = fs.readFileSync(filePath, 'utf8');
    } else if (format === 'pdf') {
      // Extract text via pdfjs-dist for scan
      try {
        const { extractTextForScan } = require('../handlers/pdf-scan-helper');
        text = await extractTextForScan(filePath);
      } catch {
        text = '';
      }
    } else if (format === 'image') {
      try {
        let Tesseract;
        try { Tesseract = require('tesseract.js'); } catch { /* optional */ }
        let ocrText = '';
        if (Tesseract) {
          const { data } = await Tesseract.recognize(filePath, 'eng', { logger: () => {} });
          ocrText = (data.words || []).map(w => w.text).join(' ');
        }
        const textScan = scanText(ocrText || '');

        let faceCount = 0;
        try {
          const pico = require('picojs');
          const sharp = require('sharp');
          const cascadePath = require('path').join(__dirname, '../handlers/facefinder.bin');
          if (fs.existsSync(cascadePath)) {
            const bytes = new Uint8Array(fs.readFileSync(cascadePath));
            const faceCascade = pico.unpack_cascade(bytes);
            const { data: rawGray, info } = await sharp(filePath).grayscale().raw().toBuffer({ resolveWithObject: true });
            const imageObj = { pixels: rawGray, nrows: info.height, ncols: info.width, ldim: info.width };
            const params = { shiftfactor: 0.1, minsize: Math.max(20, Math.round(Math.min(info.width, info.height) * 0.08)), maxsize: 1000, scalefactor: 1.1 };
            let detections = pico.run_cascade(imageObj, faceCascade, params);
            detections = pico.cluster_detections(detections, 0.2);
            faceCount = detections.filter(d => d[3] > 10.0).length;
          }
        } catch { /* face scan optional */ }

        if (faceCount > 0) {
          textScan.counts.face = (textScan.counts.face || 0) + faceCount;
          textScan.total += faceCount;
          textScan.riskScore = textScan.total >= 3 ? 'High' : 'Medium';
        }

        imageResult = { ...textScan, format };
      } catch {
        text = '';
      }
    }
  } catch {
    text = '';
  }

  if (imageResult) return imageResult;

  if (!text) {
    return {
      counts:    {},
      total:     0,
      riskScore: 'Low',
      format,
      note: `Text extraction not supported for ${format} in scan mode.`,
    };
  }

  const result = scanText(text);
  return { ...result, format };
}

module.exports = { processFile, scanFile };
