'use strict';

/**
 * Image Handler (JPEG/PNG)
 *
 * - encrypt: AES-256-GCM on raw image bytes.
 * - hash:    SHA-256/3/BLAKE3 of raw image bytes → returns a text file with the hash.
 * - mask:    OCR with tesseract.js → bounding boxes → blur sensitive regions with sharp.
 *            Falls back gracefully if OCR fails.
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
    const encrypted = encrypt(rawBytes, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  if (operation === 'hash') {
    const hexHash = hashBuffer(rawBytes, options.algorithm);
    const ext = path.extname(originalName || 'image.jpg');
    const outPath = makeOutputPath(outputDir, originalName, 'hash').replace(/\.[^.]+$/, '.txt');
    const algo = options.algorithm || 'sha256';
    fs.writeFileSync(outPath,
      `File: ${originalName}\nAlgorithm: ${algo}\nHash: ${hexHash}\n`,
      'utf8'
    );
    return {
      outputPath: outPath,
      count: 1,
      notes: [`Image hash (${algo}) written to text file. Original image not modified.`],
    };
  }

  // mask: OCR + region blur
  const notes = [];
  let count = 0;

  try {
    // Lazy-load tesseract to avoid loading it unless needed
    const Tesseract = require('tesseract.js');
    const { data } = await Tesseract.recognize(filePath, 'eng', { logger: () => {} });

    const ext = path.extname(originalName || 'image.jpg').toLowerCase();
    const meta = await sharp(filePath).metadata();
    const imgWidth = meta.width;
    const imgHeight = meta.height;

    // Collect bounding boxes of sensitive words
    const redactRegions = [];
    for (const word of (data.words || [])) {
      const { protect } = shouldProtect(word.text.trim());
      if (protect && word.text.trim().length > 0) {
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
      fs.copyFileSync(filePath, outPath);
      return { outputPath: outPath, count: 0, notes };
    }

    // Build sharp composite overlays (black rectangles)
    const overlays = redactRegions.map(r => ({
      input: {
        create: {
          width:   Math.max(1, r.width),
          height:  Math.max(1, r.height),
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
      },
      left:  r.left,
      top:   r.top,
    }));

    const outPath = makeOutputPath(outputDir, originalName, operation);
    await sharp(filePath)
      .composite(overlays)
      .toFile(outPath);

    notes.push(`OCR detected ${count} sensitive text region(s) and redacted them with black boxes.`);
    return { outputPath: outPath, count, notes };
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      notes.push('tesseract.js not available — image copied without OCR masking. Install tesseract.js to enable image text masking.');
    } else {
      notes.push(`OCR masking failed: ${e.message}. Image copied unmodified.`);
    }
    const outPath = makeOutputPath(outputDir, originalName, operation);
    fs.copyFileSync(filePath, outPath);
    return { outputPath: outPath, count: 0, notes };
  }
}

module.exports = { process };
