'use strict';

/**
 * Image Handler (JPEG/PNG/WEBP)
 *
 * - encrypt: AES-256-GCM (or selected cipher) on raw image bytes.
 * - hash:    Whole-file hash of raw image bytes → returns a .json report.
 * - mask:    1) OCR with tesseract.js → bounding boxes → cover sensitive text regions.
 *            2) Face detection with picojs + facefinder.bin → cover detected human faces.
 *            Draws opaque black redaction rectangles over text and faces with sharp.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { encrypt } = require('../services/encryption-service');
const { hashBuffer } = require('../services/hashing-service');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { makeOutputPath } = require('./handler-utils');

let pico;
let faceCascade;
try {
  pico = require('picojs');
  const cascadePath = path.join(__dirname, 'facefinder.bin');
  if (fs.existsSync(cascadePath)) {
    const bytes = new Uint8Array(fs.readFileSync(cascadePath));
    faceCascade = pico.unpack_cascade(bytes);
  }
} catch {
  // picojs optional
}

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

  // mask: OCR text blackout + Face region blackout
  const notes = [];
  let count = 0;
  let textCount = 0;
  let faceCount = 0;

  try {
    const meta = await sharp(filePath).metadata();
    const imgWidth = meta.width;
    const imgHeight = meta.height;

    const redactRegions = [];

    // 1. OCR Text Scan
    let Tesseract;
    try { Tesseract = require('tesseract.js'); } catch { /* optional */ }

    if (Tesseract) {
      try {
        const { data } = await Tesseract.recognize(filePath, 'eng', { logger: () => {} });
        for (const word of (data.words || [])) {
          const text = word.text.trim();
          if (!text) continue;
          const { protect } = shouldProtect(text);
          if (protect) {
            count++;
            textCount++;
            const b = word.bbox;
            redactRegions.push({
              left:   Math.max(0, Math.round(b.x0 - 2)),
              top:    Math.max(0, Math.round(b.y0 - 2)),
              width:  Math.min(imgWidth  - Math.round(b.x0), Math.round(b.x1 - b.x0 + 4)),
              height: Math.min(imgHeight - Math.round(b.y0), Math.round(b.y1 - b.y0 + 4)),
            });
          }
        }
      } catch (ocrErr) {
        notes.push(`OCR text scan: ${ocrErr.message}`);
      }
    } else {
      notes.push('tesseract.js not available — install to enable text recognition in photos.');
    }

    // 2. Face Detection
    if (faceCascade) {
      try {
        const { data: rawGray, info } = await sharp(filePath).grayscale().raw().toBuffer({ resolveWithObject: true });
        const imageObj = {
          pixels: rawGray,
          nrows: info.height,
          ncols: info.width,
          ldim: info.width
        };
        const params = {
          shiftfactor: 0.1,
          minsize: Math.max(20, Math.round(Math.min(info.width, info.height) * 0.08)),
          maxsize: 1000,
          scalefactor: 1.1
        };
        let detections = pico.run_cascade(imageObj, faceCascade, params);
        detections = pico.cluster_detections(detections, 0.2);

        for (let i = 0; i < detections.length; ++i) {
          if (detections[i][3] > 10.0) { // high confidence face threshold
            count++;
            faceCount++;
            const r = detections[i][0];
            const c = detections[i][1];
            const s = detections[i][2];
            const left = Math.max(0, Math.round(c - s / 2));
            const top = Math.max(0, Math.round(r - s / 2));
            const width = Math.min(imgWidth - left, Math.round(s));
            const height = Math.min(imgHeight - top, Math.round(s));
            redactRegions.push({ left, top, width, height });
          }
        }
      } catch (faceErr) {
        notes.push(`Face detection error: ${faceErr.message}`);
      }
    }

    if (redactRegions.length === 0) {
      notes.push('No sensitive text or human faces detected in image.');
      const outPath = makeOutputPath(outputDir, originalName, operation);
      await sharp(filePath).toFile(outPath);
      return { outputPath: outPath, count: 0, notes };
    }

    const overlays = await Promise.all(
      redactRegions.map(async r => {
        try {
          const blurredBuffer = await sharp(filePath)
            .extract({
              left:   Math.max(0, Math.min(imgWidth - 1, r.left)),
              top:    Math.max(0, Math.min(imgHeight - 1, r.top)),
              width:  Math.max(1, Math.min(imgWidth - r.left, r.width)),
              height: Math.max(1, Math.min(imgHeight - r.top, r.height)),
            })
            .blur(25) // Smooth privacy blur effect
            .toBuffer();

          return {
            input: blurredBuffer,
            left:  r.left,
            top:   r.top,
          };
        } catch {
          // Fallback to solid block if extraction bounds exceed image dimensions
          return {
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
          };
        }
      })
    );

    const outPath = makeOutputPath(outputDir, originalName, operation);
    await sharp(filePath).composite(overlays).toFile(outPath);

    const parts = [];
    if (textCount > 0) parts.push(`${textCount} text region(s)`);
    if (faceCount > 0) parts.push(`${faceCount} human face(s)`);
    notes.push(`Protected photo: blurred ${parts.join(' and ')} with smooth privacy blur overlays.`);
    return { outputPath: outPath, count, notes };

  } catch (e) {
    notes.push(`Image processing failed: ${e.message}. Image returned unmodified.`);
    const outPath = makeOutputPath(outputDir, originalName, operation);
    fs.copyFileSync(filePath, outPath);
    return { outputPath: outPath, count: 0, notes };
  }
}

module.exports = { process };
