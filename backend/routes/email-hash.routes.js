'use strict';

/**
 * email-hash.routes.js — Email SHA-256 Hashing, Candidate Recovery & Base64 Testing API Routes
 * 
 * Segmento Universal Data Protection System (UDPS)
 */

const express = require('express');
const router = express.Router();
const emailHashService = require('../services/email-hash-service');

function jsonError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

/**
 * POST /api/email-hash/process
 * End-to-end processing: Email validation, SHA-256 Hashing, Candidate matching,
 * Base64 Mode A & B round-trip verification, and comparison table.
 */
router.post('/process', async (req, res) => {
  try {
    const { email, policy, candidates, externalLookupConsent } = req.body || {};

    if (!email) {
      return jsonError(res, 400, 'Email address is required in request body.');
    }

    const validation = emailHashService.validateEmail(email);
    if (!validation.valid) {
      return jsonError(res, 400, validation.error);
    }

    const result = emailHashService.processEmailVerification(email, {
      policy,
      candidates,
      externalLookupConsent,
    });

    return res.json(result);
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

/**
 * POST /api/email-hash/hash
 * Calculate SHA-256 hash in hexadecimal and Base64 representations.
 */
router.post('/hash', async (req, res) => {
  try {
    const { email, policy } = req.body || {};

    if (!email) {
      return jsonError(res, 400, 'Email address is required.');
    }

    const validation = emailHashService.validateEmail(email);
    if (!validation.valid) {
      return jsonError(res, 400, validation.error);
    }

    const hashData = emailHashService.hashEmail(email, { policy });
    return res.json({
      success: true,
      data: hashData,
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

/**
 * POST /api/email-hash/verify-candidates
 * Execute local candidate matching demonstration without attempting hash reversal.
 */
router.post('/verify-candidates', async (req, res) => {
  try {
    const { targetHash, candidates, policy } = req.body || {};

    if (!targetHash) {
      return jsonError(res, 400, 'targetHash (64-character hexadecimal SHA-256 string) is required.');
    }

    const candidateList = Array.isArray(candidates) ? candidates : [];
    if (candidateList.length === 0) {
      return jsonError(res, 400, 'candidates array with at least one candidate email is required.');
    }

    const result = emailHashService.verifyCandidates(targetHash, candidateList, policy);
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

/**
 * POST /api/email-hash/base64-test
 * Mode A: Email to Base64 roundtrip
 * Mode B: Raw SHA-256 Hash Bytes to Base64 roundtrip
 * Mode C: Arbitrary Base64 decode test
 */
router.post('/base64-test', async (req, res) => {
  try {
    const { mode, email, base64Input, policy } = req.body || {};

    if (mode === 'MODE_A_EMAIL' || mode === 'modeA') {
      if (!email) return jsonError(res, 400, 'Email input is required for Mode A testing.');
      const result = emailHashService.testBase64Email(email);
      return res.json({ success: true, data: result });
    }

    if (mode === 'MODE_B_HASH_BYTES' || mode === 'modeB') {
      if (!email) return jsonError(res, 400, 'Email input is required to generate hash bytes for Mode B.');
      const result = emailHashService.testBase64HashBytes(email, policy);
      return res.json({ success: true, data: result });
    }

    if (mode === 'DECODE_CUSTOM' || mode === 'decode') {
      if (!base64Input) return jsonError(res, 400, 'base64Input is required for decode testing.');
      const result = emailHashService.decodeBase64String(base64Input);
      return res.json({ success: true, data: result });
    }

    return jsonError(res, 400, 'Invalid mode. Supported modes: MODE_A_EMAIL, MODE_B_HASH_BYTES, DECODE_CUSTOM.');
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

/**
 * GET /api/email-hash/research
 * Returns documented research findings on external hash-lookup technologies.
 */
router.get('/research', (req, res) => {
  return res.json({
    success: true,
    data: emailHashService.EXTERNAL_RESEARCH,
  });
});

/**
 * GET /api/email-hash/comparison
 * Returns the Cryptographic Comparison Matrix (SHA-256 vs Base64 vs AES-256-GCM).
 */
router.get('/comparison', (req, res) => {
  return res.json({
    success: true,
    data: emailHashService.getComparisonTable(),
  });
});

module.exports = router;
