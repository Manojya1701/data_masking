'use strict';

/**
 * Encryption Service
 *
 * Supported algorithms:
 *   aes-256-gcm         (default, authenticated)
 *   aes-256-cbc         (with HMAC-SHA256 integrity)
 *   chacha20-poly1305   (authenticated, Node ≥18)
 *
 * Binary layout of output file:
 *   [4 bytes big-endian uint32: header length][header JSON bytes][ciphertext bytes]
 *
 * Header JSON contains:
 * {
 *   version:      2,
 *   algorithm:    "aes-256-gcm" | "aes-256-cbc" | "chacha20-poly1305",
 *   kdf:          "pbkdf2",
 *   kdfHash:      "sha256",
 *   iterations:   310000,
 *   salt:         "<hex>",
 *   iv:           "<hex>",
 *   authTag:      "<hex>" | null,
 *   hmac:         "<hex>" | null,   // for CBC only
 *   originalName: "<string>",
 *   originalExt:  "<string>",
 *   integrityHash: "<hex>",         // SHA-256 of plaintext for post-decrypt verification
 * }
 */

const crypto = require('crypto');
const { sha256 } = require('@noble/hashes/sha256');
const { bytesToHex } = require('@noble/hashes/utils');

const VERSION = 2;
const KDF = 'pbkdf2';
const KDF_HASH = 'sha256';
const ITERATIONS = 310_000;
const KEY_LEN = 32; // 256 bits
const SALT_LEN = 32;

const SUPPORTED_CIPHERS = ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'];

const IV_LENGTHS = {
  'aes-256-gcm':        12,
  'aes-256-cbc':        16,
  'chacha20-poly1305':  12,
};

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
 * Compute SHA-256 digest of a Buffer (for integrity verification).
 * @param {Buffer} data
 * @returns {string} hex string
 */
function computeIntegrityHash(data) {
  return bytesToHex(sha256(data));
}

/**
 * Encrypt a Buffer with a user-supplied password.
 *
 * @param {Buffer} plaintext
 * @param {string} password
 * @param {object} [opts]
 * @param {string} [opts.algorithm]     One of SUPPORTED_CIPHERS
 * @param {string} [opts.originalName]  Original filename to store in header
 * @param {string} [opts.originalExt]   Original extension (e.g. '.pdf') to store in header
 * @returns {Buffer}  versioned envelope
 */
function encrypt(plaintext, password, opts = {}) {
  if (!password || password.length === 0) {
    throw new Error('Password must not be empty.');
  }

  const algorithm = (opts.algorithm || 'aes-256-gcm').toLowerCase();
  if (!SUPPORTED_CIPHERS.includes(algorithm)) {
    throw new Error(
      `Unsupported cipher: "${algorithm}". Choose from: ${SUPPORTED_CIPHERS.join(', ')}`
    );
  }

  const ivLen = IV_LENGTHS[algorithm];
  const salt = crypto.randomBytes(SALT_LEN);
  const iv   = crypto.randomBytes(ivLen);
  const key  = deriveKey(password, salt);
  const integrityHash = computeIntegrityHash(plaintext);

  let ciphertext;
  let authTag = null;
  let hmac    = null;

  if (algorithm === 'aes-256-gcm') {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    authTag = cipher.getAuthTag().toString('hex');

  } else if (algorithm === 'chacha20-poly1305') {
    const cipher = crypto.createCipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 });
    ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    authTag = cipher.getAuthTag().toString('hex');

  } else if (algorithm === 'aes-256-cbc') {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    // HMAC-SHA256 over iv || ciphertext for integrity
    const mac = crypto.createHmac('sha256', key);
    mac.update(iv);
    mac.update(ciphertext);
    hmac = mac.digest('hex');
  }

  const header = JSON.stringify({
    version:       VERSION,
    algorithm,
    kdf:           KDF,
    kdfHash:       KDF_HASH,
    iterations:    ITERATIONS,
    salt:          salt.toString('hex'),
    iv:            iv.toString('hex'),
    authTag:       authTag,
    hmac:          hmac,
    originalName:  opts.originalName || '',
    originalExt:   opts.originalExt  || '',
    integrityHash,
  });

  const headerBytes = Buffer.from(header, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(headerBytes.length, 0);

  return Buffer.concat([lenBuf, headerBytes, ciphertext]);
}

/**
 * Decrypt a versioned envelope with a user-supplied password.
 * Throws a clear error if the password is wrong or the data is corrupted.
 *
 * @param {Buffer} envelope
 * @param {string} password
 * @returns {{ plaintext: Buffer, originalName: string, originalExt: string, integrityVerified: boolean }}
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

  if (header.version !== VERSION && header.version !== 1) {
    throw new Error(`Unsupported envelope version: ${header.version}`);
  }

  const algorithm = (header.algorithm || 'aes-256-gcm').toLowerCase();
  const salt      = Buffer.from(header.salt, 'hex');
  const iv        = Buffer.from(header.iv,   'hex');
  const ciphertext = envelope.slice(4 + headerLen);
  const key       = deriveKey(password, salt);

  let plaintext;

  try {
    if (algorithm === 'aes-256-gcm') {
      const authTag  = Buffer.from(header.authTag, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    } else if (algorithm === 'chacha20-poly1305') {
      const authTag  = Buffer.from(header.authTag, 'hex');
      const decipher = crypto.createDecipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 });
      decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    } else if (algorithm === 'aes-256-cbc') {
      // Verify HMAC first
      if (header.hmac) {
        const mac = crypto.createHmac('sha256', key);
        mac.update(iv);
        mac.update(ciphertext);
        const expectedHmac = mac.digest('hex');
        if (!crypto.timingSafeEqual(
          Buffer.from(header.hmac, 'hex'),
          Buffer.from(expectedHmac, 'hex')
        )) {
          throw new Error('HMAC verification failed: incorrect password or corrupted file.');
        }
      }
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    } else {
      // v1 legacy: try aes-256-gcm
      const authTag  = Buffer.from(header.authTag, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }
  } catch (err) {
    if (err.message.includes('HMAC') || err.message.includes('Unsupported')) {
      throw err;
    }
    throw new Error('Decryption failed: incorrect password or data corrupted.');
  }

  // Post-decrypt integrity check
  let integrityVerified = false;
  if (header.integrityHash) {
    const actualHash = computeIntegrityHash(plaintext);
    integrityVerified = (actualHash === header.integrityHash);
    if (!integrityVerified) {
      throw new Error('Integrity check failed: decrypted data does not match original hash.');
    }
  }

  return {
    plaintext,
    originalName: header.originalName || '',
    originalExt:  header.originalExt  || '',
    integrityVerified,
  };
}

module.exports = { encrypt, decrypt, SUPPORTED_CIPHERS, computeIntegrityHash };
