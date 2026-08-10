'use strict';

/**
 * PDF Handler — coordinate-based redaction + encryption
 *
 * Text extraction is delegated to pdf-extractor.mjs (a real ESM file)
 * via child_process.execFile(). This avoids ALL pdfjs worker issues in
 * the CJS server: the child process is a fresh Node.js instance where
 * pdfjs-dist loads as native ESM with no GlobalWorkerOptions conflicts.
 *
 * masking  → extractor gives text+coords → pdf-lib draws black boxes
 * hash     → same extraction → pdf-lib draws short hash tokens
 * encrypt  → AES-256-GCM / ChaCha20 / AES-CBC on raw PDF bytes
 * file hash→ digest report JSON (whole-file integrity)
 */

const fs   = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { encrypt }      = require('../services/encryption-service');
const { hash, hashBuffer } = require('../services/hashing-service');
const { maskValue }    = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');
const { extractSensitiveTokens } = require('../services/sensitive-data-detector');

// Absolute path to the ESM extraction helper
const EXTRACTOR = path.join(__dirname, 'pdf-extractor.mjs');

// ── Text extraction via child process ────────────────────────────────────────

/**
 * Run pdf-extractor.mjs in a child process.
 * Pipes pdfBytes → stdin, reads JSON page-array from stdout.
 *
 * @param {Buffer} pdfBytes
 * @returns {Promise<Array>}  [{pageIndex, pageWidth, pageHeight, items:[{str,x,y,w,h}]}]
 */
function extractTextItems(pdfBytes) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,          // same node binary
      [EXTRACTOR],
      {
        encoding:  'buffer',
        maxBuffer: 64 * 1024 * 1024,   // 64 MB — enough for large PDFs
        timeout:   60_000,             // 60-second hard timeout
      },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr && stderr.toString().trim()) || err.message;
          return reject(new Error(`PDF extractor: ${msg}`));
        }
        try {
          resolve(JSON.parse(stdout.toString('utf8')));
        } catch (parseErr) {
          reject(new Error(`PDF extractor returned invalid JSON: ${parseErr.message}`));
        }
      }
    );

    // Send PDF bytes on stdin then close it
    child.stdin.write(pdfBytes);
    child.stdin.end();
  });
}

// ── Annotation ────────────────────────────────────────────────────────────────

function annotateSensitiveItems(items, operation, options) {
  const pseudoMap = options.pseudoMap || {};
  return items.map(item => {
    // pdfjs often returns full lines ("Email: foo@bar.com") — tokenise to find PII
    const tokens = extractSensitiveTokens(item.str);
    if (tokens.length === 0) return { ...item, sensitive: false, replacement: null };

    const type = tokens[0].type;
    let replacement = null;

    if (operation === 'mask') {
      let masked = item.str;
      for (const t of tokens) {
        masked = masked.replace(t.token, maskValue(t.token, null, options.maskingType || 'partial', pseudoMap, t.type));
      }
      replacement = masked;
    } else if (operation === 'hash') {
      let hashed = item.str;
      for (const t of tokens) {
        const digest = hash(t.token, options.algorithm || 'sha256');
        hashed = hashed.replace(t.token, '[' + digest.slice(0, 8) + '\u2026]');
      }
      replacement = hashed;
    }

    return { ...item, sensitive: true, piiType: type, tokens, replacement };
  });
}

// ── PDF rendering ─────────────────────────────────────────────────────────────

async function drawRedactions(rawPdfBytes, annotatedPages) {
  const pdfDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
  const pages  = pdfDoc.getPages();

  let font;
  try { font = await pdfDoc.embedFont(StandardFonts.Helvetica); } catch { font = null; }

  for (const pageData of annotatedPages) {
    const page = pages[pageData.pageIndex];
    if (!page) continue;

    const { width: pW, height: pH } = page.getSize();
    const scaleX = pW / (pageData.pageWidth  || pW);
    const scaleY = pH / (pageData.pageHeight || pH);

    for (const item of pageData.items) {
      if (!item.sensitive) continue;

      const x  = item.x * scaleX;
      const y  = item.y * scaleY;
      const w  = Math.max((item.w || 0) * scaleX, 24);
      const h  = Math.max((item.h || 0) * scaleY, 10);

      const pad = 2;
      const rX  = Math.max(0, x - pad);
      const rY  = Math.max(0, y - pad);
      const rW  = Math.min(w + pad * 2, pW - rX);
      const rH  = Math.min(h + pad * 2, pH - rY);

      // Solid black box
      page.drawRectangle({ x: rX, y: rY, width: rW, height: rH, color: rgb(0, 0, 0), opacity: 1 });

      // White replacement text on top
      if (item.replacement && font) {
        const fontSize = Math.max(Math.min(rH * 0.72, 9), 5);
        try {
          page.drawText(item.replacement.slice(0, 40), {
            x: rX + 2, y: rY + 2, size: fontSize, font,
            color: rgb(1, 1, 1), maxWidth: rW - 4,
          });
        } catch { /* ignore oversized text */ }
      }
    }
  }

  return pdfDoc.save();
}

// ── Main entry point ──────────────────────────────────────────────────────────

async function process({ filePath, originalName, outputDir, operation, options }) {
  console.log(`[PDF] op=${operation} file="${originalName}"`);
  const rawBytes = fs.readFileSync(filePath);

  // ── ENCRYPT ────────────────────────────────────────────────────────────────
  if (operation === 'encrypt') {
    const ext       = path.extname(originalName) || '.pdf';
    const encrypted = encrypt(rawBytes, options.password, {
      algorithm:    options.encAlgorithm || 'aes-256-gcm',
      originalName: path.basename(originalName),
      originalExt:  ext,
    });
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    console.log(`[PDF] Encrypted → ${path.basename(outPath)}`);
    return {
      outputPath: outPath,
      count: 0,
      notes: [
        `PDF encrypted with ${(options.encAlgorithm || 'aes-256-gcm').toUpperCase()}.`,
        'Original filename is stored in the encrypted envelope.',
        'Use the Restore section to decrypt and recover the original PDF.',
      ],
    };
  }

  // ── HASH (whole-file mode) ─────────────────────────────────────────────────
  if (operation === 'hash' && options.hashMode === 'file') {
    const algo   = options.algorithm || 'sha256';
    const digest = hashBuffer(rawBytes, algo);
    const report = JSON.stringify({
      file:          originalName,
      algorithm:     algo.toUpperCase(),
      digest,
      fileSizeBytes: rawBytes.length,
      generatedAt:   new Date().toISOString(),
      note:          'Whole-file integrity hash. The original PDF is NOT modified.',
    }, null, 2);

    const base    = path.basename(originalName, '.pdf');
    const outPath = path.join(outputDir, `${base}_integrity_${Date.now()}.json`);
    fs.writeFileSync(outPath, report, 'utf8');
    console.log(`[PDF] File hash (${algo}) → ${path.basename(outPath)}`);
    return {
      outputPath: outPath,
      count: 1,
      notes: [
        `Whole-file ${algo.toUpperCase()} integrity hash written to JSON report.`,
        `Hash: ${digest.slice(0, 32)}…`,
        'Original PDF is unchanged in file-hash mode.',
      ],
    };
  }

  // ── MASK / HASH (sensitive-field mode) ────────────────────────────────────

  let rawPages = null;
  let extractionError = null;

  try {
    console.log('[PDF] Extracting text via pdf-extractor.mjs child process…');
    rawPages = await extractTextItems(rawBytes);
    const total = rawPages.reduce((s, p) => s + p.items.length, 0);
    console.log(`[PDF] Extracted ${total} text items across ${rawPages.length} page(s)`);
  } catch (err) {
    extractionError = err.message;
    console.error('[PDF] Extraction failed:', err.message);
  }

  if (extractionError || !rawPages) {
    const outPath = makeOutputPath(outputDir, originalName, operation);
    fs.copyFileSync(filePath, outPath);
    return {
      outputPath: outPath,
      count: 0,
      notes: [
        `⚠ PDF text extraction failed: ${extractionError || 'unknown error'}.`,
        'The PDF has been returned unchanged. Please check server logs.',
      ],
    };
  }

  // Annotate pages
  const annotatedPages = rawPages.map(pd => ({
    ...pd,
    items: annotateSensitiveItems(pd.items, operation, options),
  }));

  const totalSensitive = annotatedPages.reduce(
    (s, p) => s + p.items.filter(i => i.sensitive).length, 0
  );
  console.log(`[PDF] Found ${totalSensitive} sensitive item(s)`);

  if (totalSensitive === 0) {
    const outPath = makeOutputPath(outputDir, originalName, operation);
    fs.copyFileSync(filePath, outPath);
    return {
      outputPath: outPath,
      count: 0,
      notes: [
        'No sensitive text patterns detected in this PDF.',
        'If the PDF contains scanned images, OCR would be needed to detect text.',
        'The original PDF is returned unchanged.',
      ],
    };
  }

  // Draw redactions
  try {
    console.log('[PDF] Drawing redaction overlays via pdf-lib…');
    const modified = await drawRedactions(rawBytes, annotatedPages);
    const outPath  = makeOutputPath(outputDir, originalName, operation);
    fs.writeFileSync(outPath, modified);
    console.log(`[PDF] Done → ${path.basename(outPath)} (${modified.length} bytes)`);

    const notes = [
      `${totalSensitive} sensitive text item(s) covered with opaque black overlays.`,
    ];
    if (operation === 'mask') {
      notes.push(`Masking type: ${options.maskingType || 'partial'}. Replacement text drawn in white over each box.`);
    } else {
      notes.push(`Hash algorithm: ${(options.algorithm || 'sha256').toUpperCase()}. Short hash token drawn over each item.`);
    }
    notes.push(
      'Visual overlays only. For legally-binding redaction, use a certified PDF redaction tool.'
    );

    return { outputPath: outPath, count: totalSensitive, notes };
  } catch (err) {
    throw new Error(`PDF rendering failed: ${err.message}`);
  }
}

module.exports = { process };
