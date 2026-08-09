'use strict';

/**
 * Process Routes
 * POST /api/process-file   — main protection endpoint
 * POST /api/restore-file   — decryption/restore endpoint
 * GET  /api/download/:token — secure file download
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { processFile }   = require('../services/privacy-engine');
const { decrypt }       = require('../services/encryption-service');
const { detectFormat, formatLabel } = require('../services/file-type-detector');
const { createToken, redeemToken, revokeToken } = require('../services/token-store');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const OUTPUT_DIR = path.join(__dirname, '../output');

// Ensure directories exist
[UPLOAD_DIR, OUTPUT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Multer configuration ──────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
  '.csv', '.tsv', '.json', '.jsonl', '.ndjson',
  '.yaml', '.yml', '.xml', '.html', '.htm',
  '.pdf', '.parquet', '.avro', '.orc',
  '.jpg', '.jpeg', '.png',
  '.enc',  // for restore
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
  return res.status(status).json({ success: false, error: message });
}

// ── POST /api/process-file ────────────────────────────────────────────────────

router.post('/process-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return jsonError(res, 400, 'No file uploaded.');
  }

  const { operation, algorithm, password } = req.body;
  const uploadedPath  = req.file.path;
  const originalName  = req.file.originalname;

  // Validate operation
  if (!['mask', 'hash', 'encrypt'].includes(operation)) {
    cleanupUpload(uploadedPath);
    return jsonError(res, 400, 'Invalid operation. Choose mask, hash, or encrypt.');
  }

  // Validate password for encrypt
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
        algorithm: algorithm || 'sha256',
        // Never log the password
        password: password || '',
      },
    });

    // Create a download token
    const ext = operation === 'encrypt' ? '.enc' : path.extname(originalName);
    const downloadName = path.basename(originalName, path.extname(originalName))
      + '_' + operation + ext;
    const token = createToken(result.outputPath, downloadName);

    cleanupUpload(uploadedPath);

    return res.json({
      success:      true,
      token,
      format:       result.format,
      formatLabel:  formatLabel(result.format),
      operation,
      algorithm:    algorithm || null,
      count:        result.count,
      notes:        result.notes || [],
      downloadName,
    });
  } catch (err) {
    cleanupUpload(uploadedPath);
    return jsonError(res, 422, err.message);
  }
});

// ── POST /api/restore-file ───────────────────────────────────────────────────

router.post('/restore-file', upload.single('file'), async (req, res) => {
  if (!req.file) return jsonError(res, 400, 'No file uploaded.');

  const { password } = req.body;
  const uploadedPath = req.file.path;

  if (!password || password.trim() === '') {
    cleanupUpload(uploadedPath);
    return jsonError(res, 400, 'A password is required to restore an encrypted file.');
  }

  try {
    const envelope  = fs.readFileSync(uploadedPath);
    const plaintext = decrypt(envelope, password);

    // Build a safe output filename
    const originalEncName = req.file.originalname;
    // Strip .enc if present to get the original extension
    const restoredName = originalEncName.replace(/_encrypted\.enc$/, '').replace(/\.enc$/, '');
    const outFileName  = uuidv4() + '_restored' + path.extname(restoredName);
    const outPath      = path.join(OUTPUT_DIR, outFileName);
    fs.writeFileSync(outPath, plaintext);

    const token = createToken(outPath, restoredName || 'restored_file');
    cleanupUpload(uploadedPath);

    return res.json({
      success:      true,
      token,
      downloadName: restoredName || 'restored_file',
    });
  } catch (err) {
    cleanupUpload(uploadedPath);
    return jsonError(res, 422, err.message);
  }
});

// ── GET /api/download/:token ──────────────────────────────────────────────────

router.get('/download/:token', (req, res) => {
  const { token } = req.params;

  // Sanitize token: only hex chars
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return jsonError(res, 400, 'Invalid download token.');
  }

  const entry = redeemToken(token);
  if (!entry) {
    return jsonError(res, 404, 'Download token not found or expired.');
  }

  const { filePath, originalName } = entry;

  // Path traversal guard: ensure file is inside OUTPUT_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(OUTPUT_DIR))) {
    return jsonError(res, 403, 'Access denied.');
  }

  if (!fs.existsSync(resolved)) {
    return jsonError(res, 404, 'Output file not found.');
  }

  res.download(resolved, originalName, (err) => {
    if (!err) {
      // Clean up after successful download
      setTimeout(() => revokeToken(token), 1000);
    }
  });
});

// ── GET /api/formats ──────────────────────────────────────────────────────────

router.get('/formats', (req, res) => {
  res.json({
    formats: [
      { key: 'csv',     label: 'CSV',              ext: ['.csv'] },
      { key: 'tsv',     label: 'TSV',              ext: ['.tsv'] },
      { key: 'json',    label: 'JSON',             ext: ['.json'] },
      { key: 'jsonl',   label: 'JSONL / NDJSON',   ext: ['.jsonl', '.ndjson'] },
      { key: 'yaml',    label: 'YAML',             ext: ['.yaml', '.yml'] },
      { key: 'xml',     label: 'XML',              ext: ['.xml'] },
      { key: 'html',    label: 'HTML',             ext: ['.html', '.htm'] },
      { key: 'pdf',     label: 'PDF',              ext: ['.pdf'] },
      { key: 'parquet', label: 'Parquet',          ext: ['.parquet'] },
      { key: 'avro',    label: 'Avro',             ext: ['.avro'] },
      { key: 'orc',     label: 'ORC',              ext: ['.orc'], note: 'Requires Python 3 + PyArrow' },
      { key: 'image',   label: 'Image (JPEG/PNG)', ext: ['.jpg', '.jpeg', '.png'] },
    ],
  });
});

module.exports = router;
