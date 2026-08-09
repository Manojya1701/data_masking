'use strict';

/**
 * Encryption Service
 * AES-256-GCM + PBKDF2 key derivation.
 * Produces a versioned JSON envelope so decryption has all metadata it needs.
 *
 * Envelope format (JSON, prepended as a length-prefixed header):
 * {
 *   version:   1,
 *   algorithm: "aes-256-gcm",
 *   kdf:       "pbkdf2",
 *   kdfHash:   "sha256",
 *   iterations: 310000,
 *   salt:      "<hex>",
 *   iv:        "<hex>",
 *   authTag:   "<hex>",
 * }
 *
 * Binary layout of output file:
 *   [4 bytes big-endian uint32: header length][header JSON bytes][ciphertext bytes]
 */

const crypto = require('crypto');

const VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const KDF = 'pbkdf2';
const KDF_HASH = 'sha256';
const ITERATIONS = 310_000;
const KEY_LEN = 32; // 256 bits
const SALT_LEN = 32;
const IV_LEN = 12; // 96-bit nonce recommended for GCM

/**
 * Derive a 256-bit key from a password using PBKDF2.
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    salt,
    ITERATIONS,
    KEY_LEN,
    KDF_HASH
  );
}

/**
 * Encrypt a Buffer with a user-supplied password.
 * @param {Buffer} plaintext
 * @param {string} password
 * @returns {Buffer}  versioned envelope
 */
function encrypt(plaintext, password) {
  if (!password || password.length === 0) {
    throw new Error('Password must not be empty.');
  }

  const salt = crypto.randomBytes(SALT_LEN);
  const iv   = crypto.randomBytes(IV_LEN);
  const key  = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const header = JSON.stringify({
    version:    VERSION,
    algorithm:  ALGORITHM,
    kdf:        KDF,
    kdfHash:    KDF_HASH,
    iterations: ITERATIONS,
    salt:       salt.toString('hex'),
    iv:         iv.toString('hex'),
    authTag:    authTag.toString('hex'),
  });

  const headerBytes = Buffer.from(header, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(headerBytes.length, 0);

  return Buffer.concat([lenBuf, headerBytes, ciphertext]);
}

/**
 * Decrypt a versioned envelope with a user-supplied password.
 * Throws a clear error if the password is wrong or the data is corrupted.
 * @param {Buffer} envelope
 * @param {string} password
 * @returns {Buffer}  original plaintext
 */
function decrypt(envelope, password) {
  if (!password || password.length === 0) {
    throw new Error('Password must not be empty.');
  }
  if (envelope.length < 4) {
    throw new Error('Invalid encrypted file: too short.');
  }

  const headerLen = envelope.readUInt32BE(0);
  if (envelope.length < 4 + headerLen) {
    throw new Error('Invalid encrypted file: header truncated.');
  }

  let header;
  try {
    header = JSON.parse(envelope.slice(4, 4 + headerLen).toString('utf8'));
  } catch {
    throw new Error('Invalid encrypted file: header corrupt.');
  }

  if (header.version !== VERSION) {
    throw new Error(`Unsupported envelope version: ${header.version}`);
  }

  const salt      = Buffer.from(header.salt,    'hex');
  const iv        = Buffer.from(header.iv,      'hex');
  const authTag   = Buffer.from(header.authTag, 'hex');
  const ciphertext = envelope.slice(4 + headerLen);

  const key = deriveKey(password, salt);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Decryption failed: incorrect password or data corrupted.');
  }
}

module.exports = { encrypt, decrypt };
