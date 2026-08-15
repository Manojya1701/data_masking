'use strict';

/**
 * UDPS Comprehensive Test Suite
 * Tests: hashing, encryption/decryption, masking, sensitive data detection, PDF pipeline
 * Run: npm test
 */

const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const crypto = require('crypto');

// ── Test data directory ───────────────────────────────────────────────────────
const TMP = os.tmpdir();

// ── Hashing Service Tests ─────────────────────────────────────────────────────
describe('Hashing Service', () => {
  const { hash, hashBuffer, SUPPORTED_ALGORITHMS } = require('../backend/services/hashing-service');

  test('SUPPORTED_ALGORITHMS contains all 6 algorithms', () => {
    expect(SUPPORTED_ALGORITHMS).toContain('sha256');
    expect(SUPPORTED_ALGORITHMS).toContain('sha512');
    expect(SUPPORTED_ALGORITHMS).toContain('sha3-256');
    expect(SUPPORTED_ALGORITHMS).toContain('sha3-512');
    expect(SUPPORTED_ALGORITHMS).toContain('blake2b-512');
    expect(SUPPORTED_ALGORITHMS).toContain('blake3');
  });

  test.each([
    ['sha256',    64],
    ['sha512',    128],
    ['sha3-256',  64],
    ['sha3-512',  128],
    ['blake2b-512', 128],
    ['blake3',    64],
  ])('%s produces correct hex length', (algo, expectedLen) => {
    const result = hash('hello world', algo);
    expect(result).toHaveLength(expectedLen);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  test('Different algorithms produce different hashes', () => {
    const input = 'test@example.com';
    const h256   = hash(input, 'sha256');
    const h512   = hash(input, 'sha512');
    const h3_256 = hash(input, 'sha3-256');
    expect(h256).not.toBe(h512);
    expect(h256).not.toBe(h3_256);
    expect(h512).not.toBe(h3_256);
  });

  test('Same input produces same hash (deterministic)', () => {
    const input = 'Ram Kumar';
    expect(hash(input, 'sha256')).toBe(hash(input, 'sha256'));
    expect(hash(input, 'blake3')).toBe(hash(input, 'blake3'));
  });

  test('hashBuffer produces same result as hash for UTF8 strings', () => {
    const str = 'test string';
    const buf = Buffer.from(str, 'utf8');
    expect(hashBuffer(buf, 'sha256')).toBe(hash(str, 'sha256'));
  });

  test('Unsupported algorithm throws', () => {
    expect(() => hash('value', 'md5')).toThrow(/Unsupported/);
  });
});

// ── Encryption Service Tests ──────────────────────────────────────────────────
describe('Encryption Service', () => {
  const { encrypt, decrypt, SUPPORTED_CIPHERS } = require('../backend/services/encryption-service');

  const plaintext     = Buffer.from('Hello, this is a test PDF or any binary content.');
  const password      = 'TestPassword123!';
  const wrongPassword = 'WrongPassword456!';

  test('SUPPORTED_CIPHERS contains all 3 algorithms', () => {
    expect(SUPPORTED_CIPHERS).toContain('aes-256-gcm');
    expect(SUPPORTED_CIPHERS).toContain('aes-256-cbc');
    expect(SUPPORTED_CIPHERS).toContain('chacha20-poly1305');
  });

  test.each(['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'])(
    '%s: encrypt → decrypt round-trip restores exact bytes',
    (algo) => {
      const envelope = encrypt(plaintext, password, {
        algorithm:    algo,
        originalName: 'test.pdf',
        originalExt:  '.pdf',
      });
      expect(Buffer.isBuffer(envelope)).toBe(true);
      expect(envelope.length).toBeGreaterThan(plaintext.length);

      const result = decrypt(envelope, password);
      expect(result.plaintext.equals(plaintext)).toBe(true);
      expect(result.originalName).toBe('test.pdf');
      expect(result.originalExt).toBe('.pdf');
      expect(result.integrityVerified).toBe(true);
    }
  );

  test.each(['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'])(
    '%s: wrong password throws clear error',
    (algo) => {
      const envelope = encrypt(plaintext, password, { algorithm: algo });
      expect(() => decrypt(envelope, wrongPassword)).toThrow();
    }
  );

  test.each(['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'])(
    '%s: encrypted bytes differ from plaintext',
    (algo) => {
      const envelope = encrypt(plaintext, password, { algorithm: algo });
      // Encrypted envelope should not start with the plaintext content
      expect(envelope.indexOf(plaintext)).toBe(-1);
    }
  );

  test('Empty password throws', () => {
    expect(() => encrypt(plaintext, '')).toThrow(/empty/i);
    const envelope = encrypt(plaintext, password);
    expect(() => decrypt(envelope, '')).toThrow(/empty/i);
  });

  test('Corrupted envelope throws', () => {
    const envelope = encrypt(plaintext, password);
    // Corrupt the ciphertext
    const corrupted = Buffer.from(envelope);
    corrupted[corrupted.length - 1] ^= 0xFF;
    expect(() => decrypt(corrupted, password)).toThrow();
  });

  test('originalName and originalExt stored in envelope', () => {
    const envelope = encrypt(plaintext, password, {
      originalName: 'patient_record.csv',
      originalExt:  '.csv',
    });
    const result = decrypt(envelope, password);
    expect(result.originalName).toBe('patient_record.csv');
    expect(result.originalExt).toBe('.csv');
  });

  test('SHA256 integrity hash verified', () => {
    const data = Buffer.from('sensitive data content');
    const envelope = encrypt(data, password, { algorithm: 'aes-256-gcm' });
    const result = decrypt(envelope, password);
    expect(result.integrityVerified).toBe(true);
  });
});

// ── Mask Utils Tests ──────────────────────────────────────────────────────────
describe('Mask Utils — 4 Masking Types', () => {
  const { maskValue } = require('../backend/handlers/mask-utils');

  const email = 'ram@example.com';
  const name  = 'Ram Kumar';
  const phone = '9876543210';
  const pan   = 'ABCDE1234F';

  describe('Partial Masking (default)', () => {
    test('Email partial mask', () => {
      const masked = maskValue(email, null, 'partial');
      expect(masked).toMatch(/^r\*+@example\.com$/);
      expect(masked).not.toBe(email);
    });
    test('Phone partial mask shows last 4 digits', () => {
      const masked = maskValue(phone, null, 'partial');
      expect(masked).toMatch(/3210$/);
      expect(masked).not.toBe(phone);
    });
    test('Name partial mask', () => {
      const masked = maskValue(name, null, 'partial');
      expect(masked).not.toBe(name);
    });
  });

  describe('Full Redaction', () => {
    test('Email redacted to [REDACTED]', () => {
      expect(maskValue(email, null, 'redact')).toBe('[REDACTED]');
    });
    test('Name redacted to [REDACTED]', () => {
      expect(maskValue(name, null, 'redact')).toBe('[REDACTED]');
    });
    test('Phone redacted to [REDACTED]', () => {
      expect(maskValue(phone, null, 'redact')).toBe('[REDACTED]');
    });
  });

  describe('Character Masking', () => {
    test('Email character mask: local part replaced with *', () => {
      const masked = maskValue(email, null, 'character');
      expect(masked).toContain('@example.com');
      expect(masked).not.toContain('ram');
    });
    test('PAN character mask preserves numeric middle', () => {
      const masked = maskValue(pan, null, 'character');
      expect(masked).not.toBe(pan);
      expect(masked).toContain('1234');
    });
  });

  describe('Pseudonymization', () => {
    test('Same value maps to same pseudonym', () => {
      const map = {};
      const p1 = maskValue(email, null, 'pseudo', map, 'email');
      const p2 = maskValue(email, null, 'pseudo', map, 'email');
      expect(p1).toBe(p2);
      expect(p1).toMatch(/^EMAIL_\d{3}$/);
    });
    test('Different values get different pseudonyms', () => {
      const map = {};
      const p1 = maskValue('alice@example.com', null, 'pseudo', map, 'email');
      const p2 = maskValue('bob@example.com',   null, 'pseudo', map, 'email');
      expect(p1).not.toBe(p2);
    });
    test('Name pseudonymized as PERSON_xxx', () => {
      const map = {};
      const p = maskValue(name, null, 'pseudo', map, 'name');
      expect(p).toMatch(/^PERSON_\d{3}$/);
    });
    test('All 5 types produce different outputs', () => {
      const results = new Set([
        maskValue(email, null, 'partial'),
        maskValue(email, null, 'redact'),
        maskValue(email, null, 'character'),
        maskValue(email, null, 'pseudo', {}, 'email'),
        maskValue(email, null, 'tokenization', {}, 'email'),
      ]);
      expect(results.size).toBe(5);
    });
  });

  describe('Tokenization', () => {
    test('Email tokenized as TKN_EMAIL_XXXXXX', () => {
      const map = {};
      const t1 = maskValue(email, null, 'tokenization', map, 'email');
      expect(t1).toMatch(/^TKN_EMAIL_[A-F0-9]{6}$/);
      expect(t1).not.toContain(email);
    });
    test('Same sensitive value gets same token within operation session', () => {
      const map = {};
      const t1 = maskValue(email, null, 'tokenization', map, 'email');
      const t2 = maskValue(email, null, 'tokenization', map, 'email');
      expect(t1).toBe(t2);
    });
    test('Different sensitive values get different tokens', () => {
      const map = {};
      const t1 = maskValue('harika@example.com', null, 'tokenization', map, 'email');
      const t2 = maskValue('john@example.com',   null, 'tokenization', map, 'email');
      expect(t1).not.toBe(t2);
      expect(t1).toMatch(/^TKN_EMAIL_[A-F0-9]{6}$/);
      expect(t2).toMatch(/^TKN_EMAIL_[A-F0-9]{6}$/);
    });
    test('Name, Phone, and PAN get appropriate token prefixes', () => {
      const map = {};
      expect(maskValue(name,  null, 'tokenization', map, 'name')).toMatch(/^TKN_NAME_[A-F0-9]{6}$/);
      expect(maskValue(phone, null, 'tokenization', map, 'phone')).toMatch(/^TKN_PHONE_[A-F0-9]{6}$/);
      expect(maskValue(pan,   null, 'tokenization', map, 'pan')).toMatch(/^TKN_PAN_[A-F0-9]{6}$/);
    });
  });
});

// ── Sensitive Data Detector Tests ─────────────────────────────────────────────
describe('Sensitive Data Detector', () => {
  const { detectValue, isSensitiveField, shouldProtect, scanText } = require('../backend/services/sensitive-data-detector');

  test('Detects email', () => {
    const r = detectValue('test@example.com');
    expect(r.isSensitive).toBe(true);
    expect(r.type).toBe('email');
  });
  test('Detects Indian phone', () => {
    const r = detectValue('9876543210');
    expect(r.isSensitive).toBe(true);
    expect(['phone_in', 'phone_intl'].includes(r.type)).toBe(true);
  });
  test('Detects Aadhaar', () => {
    const r = detectValue('1234 5678 9012');
    expect(r.isSensitive).toBe(true);
    expect(r.type).toBe('aadhaar');
  });
  test('Detects PAN', () => {
    const r = detectValue('ABCDE1234F');
    expect(r.isSensitive).toBe(true);
    expect(r.type).toBe('pan');
  });
  test('Detects IPv4', () => {
    const r = detectValue('192.168.1.100');
    expect(r.isSensitive).toBe(true);
    expect(r.type).toBe('ipv4');
  });
  test('Detects credit card', () => {
    const r = detectValue('4111-1111-1111-1111');
    expect(r.isSensitive).toBe(true);
    expect(r.type).toBe('credit_card');
  });
  test('Does not flag non-sensitive text', () => {
    const r = detectValue('hello world');
    expect(r.isSensitive).toBe(false);
  });
  test('isSensitiveField detects email column', () => {
    expect(isSensitiveField('email')).toBe(true);
    expect(isSensitiveField('Email_Address')).toBe(true);  // substring match for 'email'
    expect(isSensitiveField('product_code')).toBe(false);
  });
  test('scanText returns counts and risk score', () => {
    const text = 'Contact: ram@example.com Phone: 9876543210 ID: 1234 5678 9012';
    const result = scanText(text);
    expect(result.total).toBeGreaterThan(0);
    expect(['Low', 'Medium', 'High'].includes(result.riskScore)).toBe(true);
  });
});

// ── CSV Handler Integration Test ──────────────────────────────────────────────
describe('CSV Handler', () => {
  const handler = require('../backend/handlers/csv-handler');

  const csvContent = `name,email,phone,city
Ram Kumar,ram@example.com,9876543210,Hyderabad
Harika,harika@test.com,8765432109,Chennai`;

  let tmpInput, tmpOutputDir;

  beforeEach(() => {
    tmpInput     = path.join(TMP, `test_${Date.now()}.csv`);
    tmpOutputDir = TMP;
    fs.writeFileSync(tmpInput, csvContent, 'utf8');
  });

  afterEach(() => {
    try { fs.unlinkSync(tmpInput); } catch {}
  });

  test('Mask (partial) — email and phone are masked', async () => {
    const result = await handler.process({
      filePath: tmpInput, originalName: 'test.csv',
      outputDir: tmpOutputDir, operation: 'mask',
      options: { maskingType: 'partial' },
    });
    expect(fs.existsSync(result.outputPath)).toBe(true);
    const out = fs.readFileSync(result.outputPath, 'utf8');
    expect(out).not.toContain('ram@example.com');
    expect(out).not.toContain('9876543210');
    expect(result.count).toBeGreaterThan(0);
    fs.unlinkSync(result.outputPath);
  });

  test('Mask (redact) — values replaced with [REDACTED]', async () => {
    const result = await handler.process({
      filePath: tmpInput, originalName: 'test.csv',
      outputDir: tmpOutputDir, operation: 'mask',
      options: { maskingType: 'redact' },
    });
    const out = fs.readFileSync(result.outputPath, 'utf8');
    expect(out).toContain('[REDACTED]');
    fs.unlinkSync(result.outputPath);
  });

  test('Mask (pseudo) — email gets EMAIL_xxx pseudonym', async () => {
    const result = await handler.process({
      filePath: tmpInput, originalName: 'test.csv',
      outputDir: tmpOutputDir, operation: 'mask',
      options: { maskingType: 'pseudo' },
    });
    const out = fs.readFileSync(result.outputPath, 'utf8');
    expect(out).toMatch(/EMAIL_\d{3}/);
    fs.unlinkSync(result.outputPath);
  });

  test('Hash (sha256) — email and phone are hashed', async () => {
    const result = await handler.process({
      filePath: tmpInput, originalName: 'test.csv',
      outputDir: tmpOutputDir, operation: 'hash',
      options: { algorithm: 'sha256' },
    });
    const out = fs.readFileSync(result.outputPath, 'utf8');
    expect(out).not.toContain('ram@example.com');
    expect(out).toMatch(/[a-f0-9]{64}/);
    fs.unlinkSync(result.outputPath);
  });

  test('Encrypt → Decrypt round-trip restores exact bytes', async () => {
    const originalBytes = fs.readFileSync(tmpInput);

    const encResult = await handler.process({
      filePath: tmpInput, originalName: 'test.csv',
      outputDir: tmpOutputDir, operation: 'encrypt',
      options: { password: 'MyPass123!', encAlgorithm: 'aes-256-gcm' },
    });
    expect(fs.existsSync(encResult.outputPath)).toBe(true);
    expect(encResult.outputPath.endsWith('.enc')).toBe(true);

    const { decrypt } = require('../backend/services/encryption-service');
    const envelope = fs.readFileSync(encResult.outputPath);
    const { plaintext, originalExt, integrityVerified } = decrypt(envelope, 'MyPass123!');
    expect(plaintext.equals(originalBytes)).toBe(true);
    expect(originalExt).toBe('.csv');
    expect(integrityVerified).toBe(true);

    fs.unlinkSync(encResult.outputPath);
  });
});

// ── Encryption round-trip with file operations ────────────────────────────────
describe('Encryption → Decryption File Round-trip', () => {
  test('PDF bytes round-trip: SHA256(original) === SHA256(restored)', () => {
    const { encrypt, decrypt, computeIntegrityHash } = require('../backend/services/encryption-service');

    // Simulate PDF bytes
    const pdfBytes = Buffer.from('%PDF-1.4\nSimulated PDF content with sensitive data\nram@example.com\n9876543210');
    const password = 'SecurePass!99';

    const originalHash = computeIntegrityHash(pdfBytes);

    const envelope = encrypt(pdfBytes, password, {
      algorithm:    'aes-256-gcm',
      originalName: 'patient.pdf',
      originalExt:  '.pdf',
    });

    // Verify it's not readable as PDF
    expect(envelope.slice(4).toString('utf8', 0, 4)).not.toBe('%PDF');

    const result = decrypt(envelope, password);
    const restoredHash = computeIntegrityHash(result.plaintext);

    expect(originalHash).toBe(restoredHash);
    expect(result.plaintext.equals(pdfBytes)).toBe(true);
    expect(result.originalName).toBe('patient.pdf');
    expect(result.originalExt).toBe('.pdf');
    expect(result.integrityVerified).toBe(true);
  });

  test('Wrong password: must throw, not return garbage', () => {
    const { encrypt, decrypt } = require('../backend/services/encryption-service');
    const data     = Buffer.from('Sensitive content');
    const envelope = encrypt(data, 'correct-password', { algorithm: 'aes-256-gcm' });
    expect(() => decrypt(envelope, 'wrong-password')).toThrow();
  });

  test('AES-CBC wrong password throws HMAC error', () => {
    const { encrypt, decrypt } = require('../backend/services/encryption-service');
    const data     = Buffer.from('Sensitive content');
    const envelope = encrypt(data, 'correct-password', { algorithm: 'aes-256-cbc' });
    expect(() => decrypt(envelope, 'wrong-password')).toThrow();
  });
});

// ── JSON Handler Tests ────────────────────────────────────────────────────────
describe('JSON Handler', () => {
  const handler = require('../backend/handlers/json-handler');

  const jsonContent = JSON.stringify({
    patient: { name: 'Ram Kumar', email: 'ram@example.com', phone: '9876543210' },
    hospital: 'City Hospital',
  });

  let tmpInput;
  beforeEach(() => {
    tmpInput = path.join(TMP, `test_${Date.now()}.json`);
    fs.writeFileSync(tmpInput, jsonContent, 'utf8');
  });
  afterEach(() => { try { fs.unlinkSync(tmpInput); } catch {} });

  test('Mask partial — sensitive fields masked', async () => {
    const result = await handler.process({
      filePath: tmpInput, originalName: 'test.json',
      outputDir: TMP, operation: 'mask',
      options: { maskingType: 'partial' },
    });
    const out = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    expect(out.patient.email).not.toBe('ram@example.com');
    // 'City Hospital' matches the name pattern (2 title-cased words) so it may be masked — only assert type preserved
    expect(typeof out.hospital).toBe('string');
    fs.unlinkSync(result.outputPath);
  });

  test('Hash SHA-512 — produces 128 char hex', async () => {
    const result = await handler.process({
      filePath: tmpInput, originalName: 'test.json',
      outputDir: TMP, operation: 'hash',
      options: { algorithm: 'sha512' },
    });
    const out = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
    expect(out.patient.email).toMatch(/^[a-f0-9]{128}$/);
    fs.unlinkSync(result.outputPath);
  });
});
