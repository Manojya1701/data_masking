'use strict';

/**
 * Token Store
 * In-memory map from secure random token → { filePath, originalName, createdAt }.
 * Tokens are single-use and expire after TOKEN_EXPIRY_MS milliseconds.
 * This keeps output file paths off the wire.
 */

const crypto = require('crypto');
const fs = require('fs');

const TOKEN_EXPIRY_MS = parseInt(process.env.TOKEN_EXPIRY_MS || '600000', 10); // 10 min
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10); // 5 min

/** @type {Map<string, { filePath: string, originalName: string, createdAt: number }>} */
const store = new Map();

/**
 * Create a download token for an output file.
 * @param {string} filePath  Absolute path to the output file
 * @param {string} originalName  Safe filename to send to the browser
 * @returns {string}  The token
 */
function createToken(filePath, originalName) {
  const token = crypto.randomBytes(32).toString('hex');
  store.set(token, { filePath, originalName, createdAt: Date.now() });
  return token;
}

/**
 * Redeem a token and get the associated file info.
 * The token is NOT consumed on read — it expires by time.
 * @param {string} token
 * @returns {{ filePath: string, originalName: string } | null}
 */
function redeemToken(token) {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TOKEN_EXPIRY_MS) {
    store.delete(token);
    return null;
  }
  return { filePath: entry.filePath, originalName: entry.originalName };
}

/**
 * Delete a token explicitly (after download).
 */
function revokeToken(token) {
  const entry = store.get(token);
  if (entry) {
    // Delete the file too
    try { fs.unlinkSync(entry.filePath); } catch { /* ignore */ }
    store.delete(token);
  }
}

/**
 * Periodic cleanup: remove expired entries and their files.
 */
function cleanup() {
  const now = Date.now();
  for (const [token, entry] of store.entries()) {
    if (now - entry.createdAt > TOKEN_EXPIRY_MS) {
      try { fs.unlinkSync(entry.filePath); } catch { /* ignore */ }
      store.delete(token);
    }
  }
}

// Start automatic cleanup
const cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
cleanupTimer.unref(); // Don't block process exit

module.exports = { createToken, redeemToken, revokeToken, cleanup };
