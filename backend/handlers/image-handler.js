'use strict';

/**
 * Image Handler (JPEG/PNG)
 *
 * - encrypt: AES-256-GCM (or selected cipher) on raw image bytes.
 * - hash:    Whole-file hash of raw image bytes → returns a .txt report.
 * - mask:    OCR with tesseract.js → bounding boxes → draw black rectangles over sensitive regions with sharp.
 *            Falls back gracefully if OCR fails — reports limitation honestly.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { encrypt } = require('../services/encryption-service');
const { hashBuffer } = require('../services/hashing-service');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { makeOutputPath } = require('./handler-utils');

async function process({ filePath, originalName, outputDir, operation, options }) {
  const rawBytes = fs.readFileSync(filePath);

  if (operation === 'encrypt') {
    const ext = path.extname(originalName) || '.jpg';
    const encrypted = encrypt(rawBytes, options.password, {
      algorithm:    options.encAlgorithm || 'aes-256-gcm',
      originalName: path.basename(originalName),
      originalExt:  ext,
    });
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  if (operation === 'hash') {
    const algo = options.algorithm || 'sha256';
    const hexHash = hashBuffer(rawBytes, algo);
    const report = JSON.stringify({
      file:      originalName,
      algorithm: algo.toUpperCase(),
      digest:    hexHash,
      generatedAt: new Date().toISOString(),
      note: 'Whole-file integrity hash of the image. The original image is unchanged.',
    }, null, 2);
    // Output as JSON report
    const outPath = makeOutputPath(outputDir, originalName, 'hash').replace(/\.[^.]+$/, '') + '_hash.json';
    fs.writeFileSync(outPath, report, 'utf8');
    return {
      outputPath: outPath,
      count: 1,
      notes: [
        `Image whole-file hash (${algo.toUpperCase()}) written to JSON report.`,
        'Original image is NOT modified.',
        `Digest: ${hexHash.slice(0, 24)}…`,
      ],
    };
  }

  // mask: OCR + region blackout
  const notes = [];
  let count = 0;

  try {
    let Tesseract;
    try {
      Tesseract = require('tesseract.js');
    } catch {
      throw { code: 'MODULE_NOT_FOUND' };
    }

    const { data } = await Tesseract.recognize(filePath, 'eng', { logger: () => {} });
    const meta = await sharp(filePath).metadata();
    const imgWidth = meta.width;
    const imgHeight = meta.height;

    const redactRegions = [];
    for (const word of (data.words || [])) {
      const text = word.text.trim();
      if (!text) continue;
      const { protect } = shouldProtect(text);
      if (protect) {
        count++;
        const b = word.bbox;
        redactRegions.push({
          left:   Math.max(0, b.x0 - 2),
          top:    Math.max(0, b.y0 - 2),
          width:  Math.min(imgWidth  - b.x0, b.x1 - b.x0 + 4),
          height: Math.min(imgHeight - b.y0, b.y1 - b.y0 + 4),
        });
      }
    }

    if (redactRegions.length === 0) {
      notes.push('No sensitive text detected in image via OCR.');
      const outPath = makeOutputPath(outputDir, originalName, operation);
      await sharp(filePath).toFile(outPath);
      return { outputPath: outPath, count: 0, notes };
    }

    const overlays = redactRegions.map(r => ({
      input: {
        create: {
          width:    Math.max(1, r.width),
          height:   Math.max(1, r.height),
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 255 },
        },
      },
      left: r.left,
      top:  r.top,
    }));

    const outPath = makeOutputPath(outputDir, originalName, operation);
    await sharp(filePath).composite(overlays).toFile(outPath);

    notes.push(`OCR detected ${count} sensitive text region(s) and covered them with black boxes.`);
    return { outputPath: outPath, count, notes };

  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      notes.push(
        'tesseract.js is not available — image masking requires OCR. ' +
        'Run: npm install tesseract.js to enable image text masking.'
      );
      notes.push('Image is returned unmodified. Encrypt and Hash operations still work normally.');
    } else {
      notes.push(`OCR masking failed: ${e.message}. Image copied unmodified.`);
    }
    // Return original image with a clear note — do not claim success silently
    const outPath = makeOutputPath(outputDir, originalName, operation);
    fs.copyFileSync(filePath, outPath);
    return { outputPath: outPath, count: 0, notes };
  }
}

module.exports = { process };
