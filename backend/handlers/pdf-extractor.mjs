/**
 * pdf-extractor.mjs  —  ESM child-process helper for PDF text extraction
 *
 * Uses pdfjs-dist legacy build designed specifically for Node.js.
 * Reads raw PDF bytes from stdin, outputs clean JSON text items array to stdout.
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Redirect any logs/warnings to stderr so stdout is 100% clean JSON
console.warn = (...a) => process.stderr.write(a.join(' ') + '\n');
console.log  = (...a) => process.stderr.write(a.join(' ') + '\n');

// Read all stdin bytes
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const pdfBytes = Buffer.concat(chunks);

if (!pdfBytes.length) {
  process.stderr.write('No PDF bytes received on stdin\n');
  process.exit(1);
}

try {
  const pdf = await pdfjsLib.getDocument({
    data:             new Uint8Array(pdfBytes),
    verbosity:        0,
    useWorkerFetch:   false,
    isEvalSupported:  false,
    useSystemFonts:   true,
    disableRange:     true,
    disableStream:    true,
    disableAutoFetch: true,
  }).promise;

  const result = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page     = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const tc       = await page.getTextContent();

    const items = [];
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const [,,,, tx, ty] = item.transform;
      items.push({
        str: item.str,
        x:   tx,
        y:   ty,
        w:   item.width  || 0,
        h:   item.height || 0,
      });
    }

    result.push({
      pageIndex:  i - 1,
      pageWidth:  viewport.width,
      pageHeight: viewport.height,
      items,
    });
  }

  process.stdout.write(JSON.stringify(result));
} catch (err) {
  process.stderr.write('Extractor Exception: ' + (err.stack || err.message) + '\n');
  process.exit(1);
}
