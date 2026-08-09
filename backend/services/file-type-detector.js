'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Maps file extensions to normalized format keys.
 */
const EXT_MAP = {
  '.csv':     'csv',
  '.tsv':     'tsv',
  '.json':    'json',
  '.jsonl':   'jsonl',
  '.ndjson':  'jsonl',
  '.yaml':    'yaml',
  '.yml':     'yaml',
  '.xml':     'xml',
  '.html':    'html',
  '.htm':     'html',
  '.pdf':     'pdf',
  '.parquet': 'parquet',
  '.avro':    'avro',
  '.orc':     'orc',
  '.jpg':     'image',
  '.jpeg':    'image',
  '.png':     'image',
};

/**
 * Magic byte signatures for binary formats.
 * Each entry: { format, offset, bytes (hex string) }
 */
const MAGIC_BYTES = [
  { format: 'pdf',     offset: 0, hex: '25504446' },          // %PDF
  { format: 'parquet', offset: 0, hex: '504152314d454d30' }, // PAR1MEM0 — actually PAR1
  { format: 'parquet', offset: 0, hex: '50415231' },          // PAR1
  { format: 'avro',    offset: 0, hex: '4f626a01' },          // Obj\x01
  { format: 'image',   offset: 0, hex: 'ffd8ff' },            // JPEG
  { format: 'image',   offset: 0, hex: '89504e47' },          // PNG
];

/**
 * Reads the first N bytes of a file as a hex string.
 */
function readMagicHex(filePath, n = 8) {
  const buf = Buffer.alloc(n);
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, n, 0);
    return buf.slice(0, bytesRead).toString('hex');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Detect file format from extension, then magic bytes as fallback.
 * @param {string} filePath  Absolute path to the uploaded file
 * @param {string} [originalName]  Original filename from the client
 * @returns {{ format: string, confidence: 'extension'|'magic'|'unknown' }}
 */
function detectFormat(filePath, originalName) {
  const nameToCheck = originalName || filePath;
  const ext = path.extname(nameToCheck).toLowerCase();

  if (EXT_MAP[ext]) {
    return { format: EXT_MAP[ext], confidence: 'extension' };
  }

  // Fallback: magic bytes
  const hex = readMagicHex(filePath, 8);
  for (const sig of MAGIC_BYTES) {
    if (hex.startsWith(sig.hex)) {
      return { format: sig.format, confidence: 'magic' };
    }
  }

  return { format: 'unknown', confidence: 'unknown' };
}

/**
 * Returns a human-readable label for a format key.
 */
const FORMAT_LABELS = {
  csv:     'CSV',
  tsv:     'TSV',
  json:    'JSON',
  jsonl:   'JSONL / NDJSON',
  yaml:    'YAML',
  xml:     'XML',
  html:    'HTML',
  pdf:     'PDF',
  parquet: 'Parquet',
  avro:    'Avro',
  orc:     'ORC',
  image:   'Image (JPEG/PNG)',
  unknown: 'Unknown',
};

function formatLabel(format) {
  return FORMAT_LABELS[format] || format.toUpperCase();
}

module.exports = { detectFormat, formatLabel, EXT_MAP };
