/**
 * pdf-extractor.mjs  —  ESM child-process helper for pdfjs-dist v4
 *
 * Called by pdf-handler.js via child_process.execFile().
 * Receives raw PDF bytes on stdin, writes JSON text-item array to stdout.
 *
 * Because this is a real .mjs file, pdfjs-dist loads cleanly as ESM and the
 * worker file URL resolves correctly — no GlobalWorkerOptions hacks needed.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { pathToFileURL }   from 'url';
import { createRequire }   from 'module';
import { existsSync }      from 'fs';
import { dirname, join }   from 'path';

// Resolve pdfjs worker path
const require  = createRequire(import.meta.url);
const pkgDir   = dirname(require.resolve('pdfjs-dist/package.json'));
const workerCandidates = [
  join(pkgDir, 'build',          'pdf.worker.mjs'),
  join(pkgDir, 'legacy', 'build','pdf.worker.mjs'),
];
const workerFile = workerCandidates.find(p => existsSync(p));
if (!workerFile) throw new Error('pdfjs worker not found');

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerFile).href;

// pdfjs writes "Warning: Please use the legacy build..." to stdout via console.warn.
// Redirect console.warn/log to stderr so only our JSON goes to stdout.
const _warn = console.warn;
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

// Extract text with coordinates from every page
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
