'use strict';

/**
 * Unit tests for UDPS backend services.
 * Run: npm test
 * Requires: jest (devDependency)
 */

// ── sensitive-data-detector ───────────────────────────────────────────────────
describe('sensitive-data-detector', () => {
  const { detectValue, isSensitiveField, shouldProtect } = require('../backend/services/sensitive-data-detector');

  describe('detectValue', () => {
    test('detects email', () => {
      expect(detectValue('ram@example.com').isSensitive).toBe(true);
      expect(detectValue('ram@example.com').type).toBe('email');
    });
    test('detects Indian phone number', () => {
      expect(detectValue('9876543210').isSensitive).toBe(true);
    });
    test('detects Aadhaar', () => {
      expect(detectValue('1234 5678 9012').isSensitive).toBe(true);
      expect(detectValue('1234 5678 9012').type).toBe('aadhaar');
    });
    test('detects PAN', () => {
      expect(detectValue('ABCDE1234F').isSensitive).toBe(true);
      expect(detectValue('ABCDE1234F').type).toBe('pan');
    });
    test('does not flag plain number', () => {
      expect(detectValue('12345').isSensitive).toBe(false);
    });
    test('does not flag empty string', () => {
      expect(detectValue('').isSensitive).toBe(false);
    });
    test('does not flag generic text', () => {
      expect(detectValue('hello world').isSensitive).toBe(false);
    });
  });

  describe('isSensitiveField', () => {
    test('detects email field', () => expect(isSensitiveField('email')).toBe(true));
    test('detects name field', () => expect(isSensitiveField('fullname')).toBe(true));
    test('detects phone field', () => expect(isSensitiveField('mobile')).toBe(true));
    test('does not flag amount field', () => expect(isSensitiveField('amount')).toBe(false));
    test('does not flag id field', () => expect(isSensitiveField('id')).toBe(false));
  });

  describe('shouldProtect', () => {
    test('protects by field name even if value is generic', () => {
      const r = shouldProtect('John Doe Ramos', 'name');
      expect(r.protect).toBe(true);
    });
    test('protects email by value', () => {
      const r = shouldProtect('ram@example.com', 'contact_info');
      expect(r.protect).toBe(true);
    });
    test('does not protect generic value in generic field', () => {
      const r = shouldProtect('Engineering', 'department');
      expect(r.protect).toBe(false);
    });
  });
});

// ── hashing-service ───────────────────────────────────────────────────────────
describe('hashing-service', () => {
  const { hash, hashBuffer, SUPPORTED_ALGORITHMS } = require('../backend/services/hashing-service');

  test('sha256 produces 64-char hex', () => {
    const h = hash('hello', 'sha256');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  test('sha3-256 produces 64-char hex', () => {
    const h = hash('hello', 'sha3-256');
    expect(h).toHaveLength(64);
  });

  test('blake3 produces 64-char hex', () => {
    const h = hash('hello', 'blake3');
    expect(h).toHaveLength(64);
  });

  test('same input same output (deterministic)', () => {
    expect(hash('test', 'sha256')).toBe(hash('test', 'sha256'));
  });

  test('different inputs produce different hashes', () => {
    expect(hash('hello', 'sha256')).not.toBe(hash('world', 'sha256'));
  });

  test('hashBuffer works on Buffer', () => {
    const buf = Buffer.from('hello', 'utf8');
    const h = hashBuffer(buf, 'sha256');
    expect(h).toHaveLength(64);
  });

  test('throws on unsupported algorithm', () => {
    expect(() => hash('x', 'md5')).toThrow();
  });

  test('SUPPORTED_ALGORITHMS exported', () => {
    expect(SUPPORTED_ALGORITHMS).toContain('sha256');
    expect(SUPPORTED_ALGORITHMS).toContain('sha3-256');
    expect(SUPPORTED_ALGORITHMS).toContain('blake3');
  });
});

// ── encryption-service ────────────────────────────────────────────────────────
describe('encryption-service', () => {
  const { encrypt, decrypt } = require('../backend/services/encryption-service');

  const plaintext = Buffer.from('Hello, sensitive world! 😄', 'utf8');
  const password  = 'correcthorsebatterystaple';

  test('encrypt returns a Buffer', () => {
    const enc = encrypt(plaintext, password);
    expect(Buffer.isBuffer(enc)).toBe(true);
    expect(enc.length).toBeGreaterThan(4);
  });

  test('decrypt restores original plaintext', () => {
    const enc = encrypt(plaintext, password);
    const dec = decrypt(enc, password);
    expect(dec.equals(plaintext)).toBe(true);
  });

  test('decrypt fails with wrong password', () => {
    const enc = encrypt(plaintext, password);
    expect(() => decrypt(enc, 'wrongpassword')).toThrow(/Decryption failed/);
  });

  test('each encryption produces different ciphertext (random IV/salt)', () => {
    const enc1 = encrypt(plaintext, password);
    const enc2 = encrypt(plaintext, password);
    expect(enc1.equals(enc2)).toBe(false);
  });

  test('throws on empty password', () => {
    expect(() => encrypt(plaintext, '')).toThrow(/Password/);
    const enc = encrypt(plaintext, password);
    expect(() => decrypt(enc, '')).toThrow(/Password/);
  });

  test('throws on truncated envelope', () => {
    const enc = encrypt(plaintext, password);
    expect(() => decrypt(enc.slice(0, 2), password)).toThrow();
  });

  test('encrypts empty buffer', () => {
    const emptyBuf = Buffer.alloc(0);
    const enc = encrypt(emptyBuf, password);
    const dec = decrypt(enc, password);
    expect(dec.length).toBe(0);
  });

  test('encrypts large buffer', () => {
    const large = Buffer.alloc(1024 * 1024, 0x41); // 1 MB of 'A'
    const enc = encrypt(large, password);
    const dec = decrypt(enc, password);
    expect(dec.equals(large)).toBe(true);
  });
});

// ── mask-utils ────────────────────────────────────────────────────────────────
describe('mask-utils', () => {
  const { maskValue } = require('../backend/handlers/mask-utils');

  test('masks email — preserves first char and domain', () => {
    const masked = maskValue('ram@example.com', 'email');
    expect(masked).toMatch(/^r\*+@example\.com$/);
  });

  test('masks phone — preserves last 4 digits', () => {
    const masked = maskValue('9876543210', 'phone');
    expect(masked).toMatch(/\*{6}3210/);
  });

  test('masks Aadhaar — shows XXXX XXXX LAST4', () => {
    const masked = maskValue('1234 5678 9012');
    expect(masked).toMatch(/XXXX XXXX 9012/);
  });

  test('masks PAN — shows first 2 and last char', () => {
    const masked = maskValue('ABCDE1234F');
    expect(masked[0]).toBe('A');
    expect(masked[1]).toBe('B');
    expect(masked[masked.length - 1]).toBe('F');
  });

  test('masks generic value — preserves first char', () => {
    const masked = maskValue('JohnSmith');
    expect(masked[0]).toBe('J');
    expect(masked.slice(1)).toMatch(/^\*+$/);
  });

  test('handles single char', () => {
    expect(maskValue('A')).toBe('*');
  });

  test('handles empty string', () => {
    expect(maskValue('')).toBe('');
  });
});
