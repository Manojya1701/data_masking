'use strict';

/**
 * email-hash.test.js — Automated Tests for Email SHA-256 Hashing,
 * Candidate Recovery, and Base64 Verification Module
 */

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const emailHashService = require('../backend/services/email-hash-service');
const emailHashRoutes = require('../backend/routes/email-hash.routes');

describe('Email SHA-256 Hashing, Candidate Recovery & Base64 Module', () => {

  // ── 1. Email Validation Tests ──────────────────────────────────────────────
  describe('Point 1: Email Input Validation', () => {
    test('accepts valid RFC 5322 synthetic emails', () => {
      const validEmails = [
        'alice.smith@segmento.io',
        'test.user+tag@domain.co.uk',
        'compliance_officer@privacy-gateway.org',
        'dev123@sub.segmento.test',
      ];
      validEmails.forEach((email) => {
        const result = emailHashService.validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(email);
      });
    });

    test('rejects empty, null, or undefined email input', () => {
      expect(emailHashService.validateEmail('').valid).toBe(false);
      expect(emailHashService.validateEmail('   ').valid).toBe(false);
      expect(emailHashService.validateEmail(null).valid).toBe(false);
      expect(emailHashService.validateEmail(undefined).valid).toBe(false);
    });

    test('rejects malformed email formats', () => {
      const invalidEmails = [
        'plainaddress',
        '@missinglocal.com',
        'missingdomain@',
        'two@@atmarks.com',
        'spaces in@email.com',
        'missing-tld@domain',
      ];
      invalidEmails.forEach((email) => {
        const result = emailHashService.validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  // ── 2. SHA-256 Hashing & Normalization Tests ──────────────────────────────
  describe('Point 2: SHA-256 Hashing & Policy Normalization', () => {
    test('correctness against standard cryptographic test vectors', () => {
      const testEmail = 'test@example.com';
      const expectedHex = crypto.createHash('sha256').update(testEmail, 'utf8').digest('hex');
      const hashResult = emailHashService.hashEmail(testEmail, { policy: 'standard' });

      expect(hashResult.hashes.hex).toBe(expectedHex);
      expect(hashResult.hashes.hex.length).toBe(64);
      expect(hashResult.algorithm).toBe('SHA-256');
      expect(hashResult.cryptographicNotice.isOneWay).toBe(true);
      expect(hashResult.cryptographicNotice.isEncryption).toBe(false);
    });

    test('identical inputs produce identical hashes under the same policy', () => {
      const email = 'Security.Officer@Segmento.IO';
      const hash1 = emailHashService.hashEmail(email, { policy: 'standard' });
      const hash2 = emailHashService.hashEmail(email, { policy: 'standard' });

      expect(hash1.hashes.hex).toBe(hash2.hashes.hex);
      expect(hash1.hashes.rawBytesBase64).toBe(hash2.hashes.rawBytesBase64);
    });

    test('different inputs produce completely different hashes (avalanche effect)', () => {
      const hash1 = emailHashService.hashEmail('user1@segmento.io');
      const hash2 = emailHashService.hashEmail('user2@segmento.io');

      expect(hash1.hashes.hex).not.toBe(hash2.hashes.hex);
    });

    test('respects explicit normalization policies without silent modification', () => {
      const rawWithSpacesAndCaps = '  Alice.Smith@Segmento.IO  ';

      // Standard policy: trim + lowercase
      const standardRes = emailHashService.hashEmail(rawWithSpacesAndCaps, { policy: 'standard' });
      const expectedStandard = crypto.createHash('sha256').update('alice.smith@segmento.io', 'utf8').digest('hex');
      expect(standardRes.hashes.hex).toBe(expectedStandard);

      // Trim only policy: trim whitespace, preserve case
      const trimOnlyRes = emailHashService.hashEmail(rawWithSpacesAndCaps, { policy: 'trim_only' });
      const expectedTrim = crypto.createHash('sha256').update('Alice.Smith@Segmento.IO', 'utf8').digest('hex');
      expect(trimOnlyRes.hashes.hex).toBe(expectedTrim);

      // Exact policy: no change
      const exactRes = emailHashService.hashEmail('Alice.Smith@Segmento.IO', { policy: 'exact' });
      const expectedExact = crypto.createHash('sha256').update('Alice.Smith@Segmento.IO', 'utf8').digest('hex');
      expect(exactRes.hashes.hex).toBe(expectedExact);

      // Verify trimOnly and standard produce different hashes due to case difference
      expect(standardRes.hashes.hex).not.toBe(trimOnlyRes.hashes.hex);
    });
  });

  // ── 3. Candidate Recovery & Verification Tests ─────────────────────────────
  describe('Point 3: Candidate Recovery & External Lookup Research', () => {
    test('reports match when candidate is in candidate list', () => {
      const targetEmail = 'audit.lead@segmento.test';
      const hashResult = emailHashService.hashEmail(targetEmail, { policy: 'standard' });
      const candidates = [
        'finance.user@segmento.test',
        'audit.lead@segmento.test',
        'dpo@segmento.test',
      ];

      const verification = emailHashService.verifyCandidates(hashResult.hashes.hex, candidates, 'standard');

      expect(verification.matchFound).toBe(true);
      expect(verification.matchedCandidate).toBe('audit.lead@segmento.test');
      expect(verification.candidates[1].isMatch).toBe(true);
      expect(verification.candidates[0].isMatch).toBe(false);
      expect(verification.explanation).toContain('dictionary verification match, NOT a reversal');
    });

    test('reports no match when target hash is not in candidate list', () => {
      const targetEmail = 'novel.private.identity@segmento.internal';
      const hashResult = emailHashService.hashEmail(targetEmail, { policy: 'standard' });
      const candidates = [
        'common.user1@example.com',
        'common.user2@example.com',
        'guest@example.com',
      ];

      const verification = emailHashService.verifyCandidates(hashResult.hashes.hex, candidates, 'standard');

      expect(verification.matchFound).toBe(false);
      expect(verification.matchedCandidate).toBeNull();
      expect(verification.totalCandidatesTested).toBe(3);
    });

    test('external lookup requires explicit user consent and enforces privacy boundaries', () => {
      const testHash = '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b';

      // Without consent
      const withoutConsent = emailHashService.checkExternalLookup(testHash, { userConsent: false });
      expect(withoutConsent.status).toBe('CONSENT_REQUIRED');
      expect(withoutConsent.executed).toBe(false);

      // Documented research findings are present
      expect(withoutConsent.research.technologiesEvaluated.length).toBeGreaterThanOrEqual(4);
      expect(withoutConsent.research.scientificConclusion).toBeDefined();
    });
  });

  // ── 4. Base64 Encoding & Decoding Tests ────────────────────────────────────
  describe('Point 4: Base64 Encoding and Decoding', () => {
    test('Mode A: Original email to Base64 round-trip verification', () => {
      const email = 'alice.smith+compliance@segmento.io';
      const result = emailHashService.testBase64Email(email);

      expect(result.originalInput).toBe(email);
      expect(result.roundTripVerified).toBe(true);
      expect(result.decodedOutput).toBe(email);
      expect(result.base64Encoded).toBe(Buffer.from(email, 'utf8').toString('base64'));
    });

    test('Mode B: Raw 32-byte SHA-256 hash bytes to Base64 round-trip verification', () => {
      const email = 'developer@segmento.test';
      const result = emailHashService.testBase64HashBytes(email);

      expect(result.rawHashBytesLength).toBe(32);
      expect(result.rawBytesBase64Length).toBe(44); // 32 bytes in Base64 = 44 characters
      expect(result.roundTripVerified).toBe(true);
      expect(result.decodedBytesHex).toBe(result.hexHash);
      expect(result.representationComparison.rawBytesInBase64.length).toBe(44);
      expect(result.representationComparison.hexStringInBase64.length).toBe(88);
    });

    test('handles invalid Base64 input gracefully with descriptive error', () => {
      const invalidBase64 = 'NotValidBase64!!!';
      const result = emailHashService.decodeBase64String(invalidBase64);

      expect(result.validBase64).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.decodedText).toBeNull();
    });

    test('decodes valid custom Base64 string correctly', () => {
      const original = 'Hello Segmento Privacy';
      const validBase64 = Buffer.from(original, 'utf8').toString('base64');
      const result = emailHashService.decodeBase64String(validBase64);

      expect(result.validBase64).toBe(true);
      expect(result.decodedText).toBe(original);
    });
  });

  // ── 5. Comparison Matrix & Full Lifecycle Tests ───────────────────────────
  describe('Point 5: Verification Results & Comparison Matrix', () => {
    test('comparison matrix includes SHA-256, Base64, and AES-256-GCM', () => {
      const comparison = emailHashService.getComparisonTable();
      expect(comparison.comparisonTable).toHaveLength(3);

      const [sha, b64, aes] = comparison.comparisonTable;
      expect(sha.method).toBe('SHA-256');
      expect(sha.reversible).toBe('No direct reversal');
      expect(sha.purpose).toBe('One-way hashing');

      expect(b64.method).toBe('Base64');
      expect(b64.reversible).toBe('Yes');
      expect(b64.purpose).toBe('Data encoding');

      expect(aes.method).toBe('AES-256-GCM');
      expect(aes.reversible).toBe('Yes, with the required key and parameters');
      expect(aes.purpose).toBe('Authenticated encryption');

      expect(comparison.securityNote).toContain('A successful candidate match in a dictionary test does NOT mean SHA-256 was reversed');
    });

    test('processEmailVerification returns complete end-to-end payload', () => {
      const result = emailHashService.processEmailVerification('dpo@segmento.io', {
        policy: 'standard',
        candidates: ['dpo@segmento.io', 'ceo@segmento.io'],
      });

      expect(result.success).toBe(true);
      expect(result.hashing.hashes.hex).toBeDefined();
      expect(result.candidateRecovery.matchFound).toBe(true);
      expect(result.base64Testing.modeA.roundTripVerified).toBe(true);
      expect(result.base64Testing.modeB.roundTripVerified).toBe(true);
      expect(result.cryptographicComparison.comparisonTable).toBeDefined();
    });
  });

  // ── 6. API Route Integration Tests via Native HTTP Server ──────────────────
  describe('API Endpoints via HTTP Server', () => {
    let server;
    let baseUrl;

    beforeAll((done) => {
      const app = express();
      app.use(express.json());
      app.use('/api/email-hash', emailHashRoutes);

      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/email-hash`;
        done();
      });
    });

    afterAll((done) => {
      if (server) {
        server.close(done);
      } else {
        done();
      }
    });

    test('POST /api/email-hash/process successfully processes valid email', async () => {
      const res = await fetch(`${baseUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'qa.engineer@segmento.io',
          policy: 'standard',
          candidates: ['qa.engineer@segmento.io'],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.hashing.hashes.hex).toHaveLength(64);
      expect(body.candidateRecovery.matchFound).toBe(true);
    });

    test('POST /api/email-hash/process returns 400 for invalid email', async () => {
      const res = await fetch(`${baseUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email-no-at' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('missing "@"');
    });

    test('POST /api/email-hash/hash returns SHA-256 hexadecimal and Base64', async () => {
      const res = await fetch(`${baseUrl}/hash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.user@segmento.io', policy: 'standard' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.hashes.hex).toHaveLength(64);
      expect(body.data.hashes.rawBytesBase64).toHaveLength(44);
    });

    test('POST /api/email-hash/verify-candidates evaluates candidates', async () => {
      const targetHash = crypto.createHash('sha256').update('target@example.com').digest('hex');
      const res = await fetch(`${baseUrl}/verify-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHash,
          candidates: ['wrong@example.com', 'target@example.com'],
          policy: 'standard',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.matchFound).toBe(true);
      expect(body.data.matchedCandidate).toBe('target@example.com');
    });

    test('POST /api/email-hash/base64-test executes Mode A and Mode B', async () => {
      const resA = await fetch(`${baseUrl}/base64-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'MODE_A_EMAIL', email: 'modeA@segmento.io' }),
      });
      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.data.roundTripVerified).toBe(true);

      const resB = await fetch(`${baseUrl}/base64-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'MODE_B_HASH_BYTES', email: 'modeB@segmento.io' }),
      });
      expect(resB.status).toBe(200);
      const bodyB = await resB.json();
      expect(bodyB.data.roundTripVerified).toBe(true);
    });

    test('GET /api/email-hash/research returns documented research', async () => {
      const res = await fetch(`${baseUrl}/research`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data.technologiesEvaluated)).toBe(true);
    });

    test('GET /api/email-hash/comparison returns comparison table', async () => {
      const res = await fetch(`${baseUrl}/comparison`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.comparisonTable).toHaveLength(3);
    });
  });
});
