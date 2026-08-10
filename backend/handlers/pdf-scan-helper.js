'use strict';

/**
 * PDF Scan Helper — extracts plain text from a PDF for privacy scanning.
 * Uses pdfjs-dist in legacy mode (no worker).
 */

const fs = require('fs');

async function extractTextForScan(filePath) {
  const rawBytes = fs.readFileSync(filePath);
  let pdfjsLib;
  try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  } catch {
    pdfjsLib = require('pdfjs-dist');
  }

  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }

  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(rawBytes), verbosity: 0 }).promise;
  const textLines = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item.str && item.str.trim()) {
        textLines.push(item.str.trim());
      }
    }
  }

  return textLines.join(' ');
}

module.exports = { extractTextForScan };
