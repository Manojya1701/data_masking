'use strict';

/**
 * Hashing Service
 * Uses @noble/hashes — pure JS, no native addons.
 * Supported algorithms: sha256, sha512, sha3-256, sha3-512, blake2b-512, blake3
 */

const { sha256 } = require('@noble/hashes/sha256');
const { sha512 } = require('@noble/hashes/sha512');
const { sha3_256, sha3_512 } = require('@noble/hashes/sha3');
const { blake3 } = require('@noble/hashes/blake3');
const { blake2b } = require('@noble/hashes/blake2b');
const { bytesToHex } = require('@noble/hashes/utils');

const SUPPORTED_ALGORITHMS = [
  'sha256',
  'sha512',
  'sha3-256',
  'sha3-512',
  'blake2b-512',
  'blake3',
];

/**
 * Hash a raw Uint8Array/Buffer with the specified algorithm.
 * @param {Uint8Array|Buffer} bytes
 * @param {string} algorithm
 * @returns {string}  hex-encoded hash
 */
function hashBytes(bytes, algorithm) {
  const normalized = (algorithm || 'sha256').toLowerCase().trim();
  switch (normalized) {
    case 'sha256':
      return bytesToHex(sha256(bytes));
    case 'sha512':
      return bytesToHex(sha512(bytes));
    case 'sha3-256':
    case 'sha3_256':
      return bytesToHex(sha3_256(bytes));
    case 'sha3-512':
    case 'sha3_512':
      return bytesToHex(sha3_512(bytes));
    case 'blake2b-512':
    case 'blake2b_512':
    case 'blake2b':
      return bytesToHex(blake2b(bytes, { dkLen: 64 }));
    case 'blake3':
      return bytesToHex(blake3(bytes));
    default:
      throw new Error(
        `Unsupported hashing algorithm: "${algorithm}". ` +
        `Choose from: ${SUPPORTED_ALGORITHMS.join(', ')}`
      );
  }
}

/**
 * Hash a string value using the specified algorithm.
 * @param {string} value
 * @param {string} algorithm
 * @returns {string}  hex-encoded hash
 */
function hash(value, algorithm = 'sha256') {
  const input = typeof value === 'string' ? value : String(value);
  const bytes = Buffer.from(input, 'utf8');
  return hashBytes(bytes, algorithm);
}

/**
 * Hash a raw Buffer (for binary files / whole-file hashing).
 * @param {Buffer} buffer
 * @param {string} algorithm
 * @returns {string}  hex-encoded hash
 */
function hashBuffer(buffer, algorithm = 'sha256') {
  return hashBytes(buffer, algorithm);
}

module.exports = { hash, hashBuffer, hashBytes, SUPPORTED_ALGORITHMS };
