'use strict';

/**
 * Hashing Service
 * Uses @noble/hashes — pure JS, no native addons.
 * Supported algorithms: sha256, sha3-256, blake3
 */

const { sha256 } = require('@noble/hashes/sha256');
const { sha3_256 } = require('@noble/hashes/sha3');
const { blake3 } = require('@noble/hashes/blake3');
const { bytesToHex } = require('@noble/hashes/utils');

const SUPPORTED_ALGORITHMS = ['sha256', 'sha3-256', 'blake3'];

/**
 * Hash a string value using the specified algorithm.
 * @param {string} value
 * @param {'sha256'|'sha3-256'|'blake3'} algorithm
 * @returns {string}  hex-encoded hash
 */
function hash(value, algorithm = 'sha256') {
  const normalized = (algorithm || 'sha256').toLowerCase().trim();
  const input = typeof value === 'string' ? value : String(value);
  const bytes = Buffer.from(input, 'utf8');

  switch (normalized) {
    case 'sha256':
      return bytesToHex(sha256(bytes));
    case 'sha3-256':
    case 'sha3_256':
      return bytesToHex(sha3_256(bytes));
    case 'blake3':
      return bytesToHex(blake3(bytes));
    default:
      throw new Error(`Unsupported hashing algorithm: ${algorithm}. Choose from: ${SUPPORTED_ALGORITHMS.join(', ')}`);
  }
}

/**
 * Hash a raw Buffer (for binary files).
 * @param {Buffer} buffer
 * @param {'sha256'|'sha3-256'|'blake3'} algorithm
 * @returns {string}  hex-encoded hash
 */
function hashBuffer(buffer, algorithm = 'sha256') {
  const normalized = (algorithm || 'sha256').toLowerCase().trim();
  switch (normalized) {
    case 'sha256':
      return bytesToHex(sha256(buffer));
    case 'sha3-256':
    case 'sha3_256':
      return bytesToHex(sha3_256(buffer));
    case 'blake3':
      return bytesToHex(blake3(buffer));
    default:
      throw new Error(`Unsupported hashing algorithm: ${algorithm}`);
  }
}

module.exports = { hash, hashBuffer, SUPPORTED_ALGORITHMS };
