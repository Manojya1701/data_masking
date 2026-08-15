'use strict';

/**
 * Shared utilities for all handlers.
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Build a safe output file path.
 * @param {string} outputDir
 * @param {string} originalName  Original filename
 * @param {string} suffix  e.g. 'mask', 'hash', 'enc'
 * @returns {string}
 */
function makeOutputPath(outputDir, originalName, suffix) {
  const ext  = path.extname(originalName || 'file') || '';
  const base = path.basename(originalName || 'file', ext)
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 64);
  const uid  = uuidv4().replace(/-/g, '').slice(0, 8);
  const fileName = suffix === 'enc'
    ? `${base}_${uid}_encrypted.enc`
    : `${base}_${suffix}_${uid}${ext}`;
  return path.join(outputDir, fileName);
}

module.exports = { makeOutputPath };
