'use strict';

/**
 * PDF Scan Helper — extracts plain text from a PDF for privacy scanning.
 * Uses pdf-extractor.mjs via child process spawn.
 */

const fs   = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EXTRACTOR = path.join(__dirname, 'pdf-extractor.mjs');

async function extractTextForScan(filePath) {
  const rawBytes = fs.readFileSync(filePath);

  return new Promise((resolve, reject) => {
    const nodeBin = process.execPath || 'node';
    const child   = spawn(nodeBin, [EXTRACTOR]);

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('error', err => {
      reject(new Error(`PDF scan extractor error: ${err.message}`));
    });

    child.on('close', code => {
      const stdoutStr = Buffer.concat(stdoutChunks).toString('utf8');
      const stderrStr = Buffer.concat(stderrChunks).toString('utf8').trim();

      if (code !== 0) {
        return reject(new Error(`PDF scan extractor failed: ${stderrStr || 'unknown error'}`));
      }

      try {
        const jsonStart = Math.min(
          stdoutStr.indexOf('[') >= 0 ? stdoutStr.indexOf('[') : Infinity,
          stdoutStr.indexOf('{') >= 0 ? stdoutStr.indexOf('{') : Infinity
        );
        if (jsonStart === Infinity) resolve('');

        const pages = JSON.parse(stdoutStr.slice(jsonStart));
        const lines = [];
        for (const page of pages) {
          for (const item of page.items || []) {
            if (item.str && item.str.trim()) {
              lines.push(item.str.trim());
            }
          }
        }
        resolve(lines.join('\n'));
      } catch (parseErr) {
        reject(new Error(`PDF scan extractor parse error: ${parseErr.message}`));
      }
    });

    child.stdin.write(rawBytes);
    child.stdin.end();
  });
}

module.exports = { extractTextForScan };
