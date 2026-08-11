'use strict';

/**
 * Process Routes
 * POST /api/process-file    — main protection endpoint
 * POST /api/restore-file    — decryption/restore endpoint
 * POST /api/scan-file       — pre-scan for sensitive data (no file modification)
 * GET  /api/download/:token — secure file download
 * GET  /api/formats         — supported formats list
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { processFile, scanFile } = require('../services/privacy-engine');
const { decrypt }               = require('../services/encryption-service');
const { detectFormat, formatLabel } = require('../services/file-type-detector');
const { createToken, redeemToken, revokeToken } = require('../services/token-store');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const OUTPUT_DIR = path.join(__dirname, '../output');

[UPLOAD_DIR, OUTPUT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Multer configuration ──────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  '.csv', '.tsv', '.json', '.jsonl', '.ndjson',
  '.yaml', '.yml', '.xml', '.html', '.htm',
  '.pdf', '.parquet', '.avro', '.orc',
  '.jpg', '.jpeg', '.png',
  '.enc',
]);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10); // 100 MB

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const safeExt  = path.extname(file.originalname).toLowerCase();
    const safeName = uuidv4() + safeExt;
    cb(null, safeName);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported: ${ext}`), false);
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanupUpload(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

function jsonError(res, status, message) {
  console.warn(`[Routes] Error ${status}: ${message}`);
  return res.status(status).json({ success: false, error: message });
}

// ── POST /api/scan-file ───────────────────────────────────────────────────────

router.post('/scan-file', upload.single('file'), async (req, res) => {
  if (!req.file) return jsonError(res, 400, 'No file uploaded.');

  const uploadedPath = req.file.path;
  const originalName = req.file.originalname;

  try {
    const result = await scanFile(uploadedPath, originalName);
    const { format } = detectFormat(uploadedPath, originalName);
    return res.json({
      success: true,
      format,
      formatLabel: formatLabel(format),
      ...result,
    });
  } catch (err) {
    return jsonError(res, 422, err.message);
  } finally {
    cleanupUpload(uploadedPath);
  }
});

// ── POST /api/process-file ────────────────────────────────────────────────────

router.post('/process-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return jsonError(res, 400, 'No file uploaded.');
  }

  const {
    operation,
    algorithm,
    hashMode,
    password,
    encAlgorithm,
    maskingType,
  } = req.body;

  const uploadedPath  = req.file.path;
  const originalName  = req.file.originalname;

  console.log(`[Routes] process-file: op=${operation} algo=${algorithm} hashMode=${hashMode} encAlgo=${encAlgorithm} maskType=${maskingType} file=${originalName}`);

  if (!['mask', 'hash', 'encrypt'].includes(operation)) {
    cleanupUpload(uploadedPath);
    return jsonError(res, 400, 'Invalid operation. Choose mask, hash, or encrypt.');
  }

  if (operation === 'encrypt' && (!password || password.trim() === '')) {
    cleanupUpload(uploadedPath);
    return jsonError(res, 400, 'A password is required for encryption.');
  }

  try {
    const result = await processFile({
      filePath:     uploadedPath,
      originalName,
      outputDir:    OUTPUT_DIR,
      operation,
      options: {
        algorithm:    algorithm || 'sha256',
        hashMode:     hashMode  || 'sensitive',
        password:     password  || '',
        encAlgorithm: encAlgorithm || 'aes-256-gcm',
        maskingType:  maskingType  || 'partial',
      },
    });

    // Verify output file was actually written
    if (!fs.existsSync(result.outputPath)) {
      throw new Error('Output file was not created by the handler.');
    }
    const outputSize = fs.statSync(result.outputPath).size;
    console.log(`[Routes] Output: ${path.basename(result.outputPath)} (${outputSize} bytes)`);

    // Determine download extension
    let ext;
    if (operation === 'encrypt') {
      ext = '.enc';
    } else if (operation === 'hash' && (hashMode === 'file' || result.outputPath.endsWith('.json'))) {
      ext = result.outputPath.endsWith('.json') ? '.json' : path.extname(originalName);
    } else {
      ext = path.extname(originalName);
    }

    const downloadName = path.basename(originalName, path.extname(originalName))
      + '_' + operation + ext;
    const token = createToken(result.outputPath, downloadName);

    cleanupUpload(uploadedPath);

    return res.json({
      success:        true,
      token,
      format:         result.format,
      formatLabel:    formatLabel(result.format),
      operation,
      algorithm:      algorithm || null,
      hashMode:       hashMode  || 'sensitive',
      maskingType:    maskingType || 'partial',
      encAlgorithm:   encAlgorithm || 'aes-256-gcm',
      count:          result.count,
      notes:          result.notes || [],
      downloadName,
      processingTime: result.processingTime,
    });
  } catch (err) {
    cleanupUpload(uploadedPath);
    console.error('[Routes] processFile error:', err.message);
    return jsonError(res, 422, err.message);
  }
});

// ── POST /api/restore-file ────────────────────────────────────────────────────

router.post('/restore-file', upload.single('file'), async (req, res) => {
  if (!req.file) return jsonError(res, 400, 'No file uploaded.');

  const { password } = req.body;
  const uploadedPath = req.file.path;
  const encFileName  = req.file.originalname;

  if (!password || password.trim() === '') {
    cleanupUpload(uploadedPath);
    return jsonError(res, 400, 'A password is required to restore an encrypted file.');
  }

  console.log(`[Routes] restore-file: encFileName=${encFileName}`);

  try {
    const envelope = fs.readFileSync(uploadedPath);

    // decrypt() now returns { plaintext, originalName, originalExt, integrityVerified }
    const decResult = decrypt(envelope, password);
    const { plaintext, originalName: storedName, originalExt: storedExt, integrityVerified } = decResult;

    console.log(`[Routes] Decrypted: storedName=${storedName} storedExt=${storedExt} integrityVerified=${integrityVerified} size=${plaintext.length}`);

    // Determine restored filename
    let restoredName;
    if (storedName && storedExt) {
      // Use metadata from envelope (most reliable)
      restoredName = storedName;
    } else {
      // Legacy v1 envelope fallback: guess from .enc filename
      restoredName = encFileName
        .replace(/_encrypted\.enc$/i, '')
        .replace(/\.enc$/i, '');
      if (!path.extname(restoredName)) {
        restoredName += '.bin'; // unknown extension
      }
    }

    const outFileName = uuidv4() + '_restored' + (storedExt || path.extname(restoredName) || '.bin');
    const outPath = path.join(OUTPUT_DIR, outFileName);
    fs.writeFileSync(outPath, plaintext);

    // Verify file was written correctly
    const writtenSize = fs.statSync(outPath).size;
    if (writtenSize !== plaintext.length) {
      throw new Error('Restored file size mismatch — write error.');
    }

    console.log(`[Routes] Restored: ${outFileName} (${writtenSize} bytes), integrity=${integrityVerified}`);

    const token = createToken(outPath, restoredName);
    cleanupUpload(uploadedPath);

    return res.json({
      success:           true,
      token,
      downloadName:      restoredName,
      integrityVerified,
      restoredSize:      writtenSize,
    });
  } catch (err) {
    cleanupUpload(uploadedPath);
    console.error('[Routes] restore-file error:', err.message);
    // Do NOT return a corrupt file — return clear error
    return jsonError(res, 422, err.message);
  }
});

// ── GET /api/preview/:token ───────────────────────────────────────────────────

router.get('/preview/:token', (req, res) => {
  const { token } = req.params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return jsonError(res, 400, 'Invalid preview token.');
  }

  const entry = redeemToken(token);
  if (!entry) {
    return jsonError(res, 404, 'Preview token not found or expired.');
  }

  const { filePath, originalName } = entry;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(OUTPUT_DIR))) {
    return jsonError(res, 403, 'Access denied.');
  }

  if (!fs.existsSync(resolved)) {
    return jsonError(res, 404, 'Output file not found.');
  }

  const ext = path.extname(originalName || filePath).toLowerCase();
  const mimeTypes = {
    '.pdf':     'application/pdf',
    '.jpg':     'image/jpeg',
    '.jpeg':    'image/jpeg',
    '.png':     'image/png',
    '.json':    'application/json',
    '.csv':     'text/plain; charset=utf-8',
    '.tsv':     'text/plain; charset=utf-8',
    '.jsonl':   'text/plain; charset=utf-8',
    '.ndjson':  'text/plain; charset=utf-8',
    '.yaml':    'text/plain; charset=utf-8',
    '.yml':     'text/plain; charset=utf-8',
    '.xml':     'text/plain; charset=utf-8',
    '.html':    'text/plain; charset=utf-8',
    '.htm':     'text/plain; charset=utf-8',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(originalName)}"`);
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  res.sendFile(resolved, (err) => {
    if (err && !res.headersSent) {
      console.error('[Routes] preview error:', err.message);
      return jsonError(res, 500, 'Failed to stream preview.');
    }
  });
});

// ── GET /api/download/:token ──────────────────────────────────────────────────

router.get('/download/:token', (req, res) => {
  const { token } = req.params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return jsonError(res, 400, 'Invalid download token.');
  }

  const entry = redeemToken(token);
  if (!entry) {
    return jsonError(res, 404, 'Download token not found or expired.');
  }

  const { filePath, originalName } = entry;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(OUTPUT_DIR))) {
    return jsonError(res, 403, 'Access denied.');
  }

  if (!fs.existsSync(resolved)) {
    return jsonError(res, 404, 'Output file not found.');
  }

  res.download(resolved, originalName, (err) => {
    if (!err) {
      setTimeout(() => revokeToken(token), 1000);
    } else {
      console.error('[Routes] download error:', err.message);
    }
  });
});

// ── GET /api/formats ──────────────────────────────────────────────────────────

router.get('/formats', (req, res) => {
  res.json({
    formats: [
      { key: 'csv',     label: 'CSV',              category: 'Tabular',    ext: ['.csv'] },
      { key: 'tsv',     label: 'TSV',              category: 'Tabular',    ext: ['.tsv'] },
      { key: 'json',    label: 'JSON',             category: 'Structured', ext: ['.json'] },
      { key: 'jsonl',   label: 'JSONL / NDJSON',   category: 'Structured', ext: ['.jsonl', '.ndjson'] },
      { key: 'yaml',    label: 'YAML',             category: 'Structured', ext: ['.yaml', '.yml'] },
      { key: 'xml',     label: 'XML',              category: 'Structured', ext: ['.xml'] },
      { key: 'html',    label: 'HTML',             category: 'Documents',  ext: ['.html', '.htm'] },
      { key: 'pdf',     label: 'PDF',              category: 'Documents',  ext: ['.pdf'] },
      { key: 'parquet', label: 'Parquet',          category: 'Binary Data', ext: ['.parquet'] },
      { key: 'avro',    label: 'Avro',             category: 'Binary Data', ext: ['.avro'] },
      { key: 'orc',     label: 'ORC',              category: 'Binary Data', ext: ['.orc'], note: 'Requires Python 3 + PyArrow' },
      { key: 'jpeg',    label: 'JPEG',             category: 'Images',     ext: ['.jpg', '.jpeg'] },
      { key: 'png',     label: 'PNG',              category: 'Images',     ext: ['.png'] },
    ],
  });
});

module.exports = router;
