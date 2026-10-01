'use strict';

/**
 * Segmento Consent Management & Withdrawal REST API Routes
 * Implements:
 * - POST /api/v1/consent/withdraw       — Execute granular consent withdrawal (Scope: consent:withdraw)
 * - GET  /api/v1/consent/status/:id     — Get subject consent matrix & status (Scope: consent:read)
 * - GET  /api/v1/consent/categories     — List supported consent categories (Scope: public / consent:read)
 * - POST /api/v1/consent/grant          — Re-grant consent (Scope: consent:grant)
 * - GET  /api/v1/consent/history/:id    — Get audit trail with SHA-256 hashes (Scope: consent:read)
 * - GET  /api/v1/consent/receipt/:id    — Get cryptographic proof receipt (Scope: consent:read)
 * - GET  /api/v1/consent/ledger         — List all consent records for DPO (Scope: consent:admin)
 */

const express = require('express');
const consentService = require('../services/consent-service');
const oidcVerifier = require('../gateway/middleware/oidc-verifier');
const { requireScope } = require('../gateway/middleware/scope-guard');
const tenantGuard = require('../gateway/middleware/tenant-guard');

const router = express.Router();

// Apply Gateway OIDC Token Verification & Tenant Boundary Check
router.use(oidcVerifier());
router.use(tenantGuard());

function jsonError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message
  });
}

// ── 1. GET /api/v1/consent/categories ─────────────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    const categories = consentService.getCategories();
    return res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 2. POST /api/v1/consent/withdraw — Granular Consent Withdrawal ────────────
router.post('/withdraw', requireScope('consent:withdraw'), async (req, res) => {
  try {
    const {
      identifier,
      email,
      customerId,
      categories,
      reason,
      requestedVia,
      jurisdiction,
      notes
    } = req.body || {};

    const targetIdentifier = identifier || email || customerId;
    if (!targetIdentifier) {
      return jsonError(res, 400, 'Data subject identifier (email or customer ID) is required.');
    }

    const actor = req.auth && req.auth.user ? req.auth.user.email : (req.auth ? req.auth.clientId : 'data_subject');
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const result = await consentService.withdrawConsent({
      identifier: targetIdentifier,
      categories: categories || 'ALL',
      reason,
      requestedVia: requestedVia || 'DSAR_PORTAL',
      actor,
      ipAddress,
      jurisdiction,
      notes
    });

    return res.status(201).json(result);
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 3. GET /api/v1/consent/status/:identifier — Lookup Consent Matrix ─────────
router.get('/status/:identifier', requireScope('consent:read'), (req, res) => {
  try {
    const status = consentService.getConsentStatus(req.params.identifier);
    return res.json({
      success: true,
      data: status
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 4. POST /api/v1/consent/grant — Re-grant Consent (Opt-in) ─────────────────
router.post('/grant', requireScope('consent:grant'), async (req, res) => {
  try {
    const { identifier, email, customerId, categories, reason, requestedVia } = req.body || {};
    const targetIdentifier = identifier || email || customerId;
    if (!targetIdentifier) {
      return jsonError(res, 400, 'Data subject identifier is required.');
    }

    const actor = req.auth && req.auth.user ? req.auth.user.email : (req.auth ? req.auth.clientId : 'data_subject');

    const result = await consentService.grantConsent({
      identifier: targetIdentifier,
      categories: categories || 'ALL',
      reason,
      requestedVia: requestedVia || 'SELF_SERVE_PORTAL',
      actor
    });

    return res.json(result);
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 5. GET /api/v1/consent/history/:identifier — Audit Trail ──────────────────
router.get('/history/:identifier', requireScope('consent:read'), (req, res) => {
  try {
    const history = consentService.getConsentHistory(req.params.identifier);
    return res.json({
      success: true,
      ...history
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 6. GET /api/v1/consent/receipt/:receiptId — Cryptographic Proof Receipt ────
router.get('/receipt/:receiptId', requireScope('consent:read'), (req, res) => {
  try {
    const receipt = consentService.getReceipt(req.params.receiptId);
    return res.json({
      success: true,
      receipt
    });
  } catch (err) {
    return jsonError(res, 404, err.message);
  }
});

// ── 7. GET /api/v1/consent/ledger — DPO Ledger Overview ───────────────────────
router.get('/ledger', requireScope('consent:admin'), (req, res) => {
  try {
    const records = consentService.listRecords(req.query);
    return res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 8. GET /api/v1/consent/kafka/metrics — Kafka Broker & Cluster Health ──────
router.get('/kafka/metrics', requireScope('consent:read'), (req, res) => {
  try {
    const metrics = consentService.getKafkaMetrics();
    return res.json({
      success: true,
      data: metrics
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 9. GET /api/v1/consent/kafka/events — Live Kafka Event Stream ─────────────
router.get('/kafka/events', requireScope('consent:read'), (req, res) => {
  try {
    const events = consentService.getKafkaEvents({
      topic: req.query.topic,
      limit: req.query.limit || 50
    });
    return res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 10. GET /api/v1/consent/kafka/connectors — 5 Downstream Connector Status ───
router.get('/kafka/connectors', requireScope('consent:read'), (req, res) => {
  try {
    const connectors = consentService.getDownstreamConnectors();
    return res.json({
      success: true,
      count: connectors.length,
      connectors
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 11. GET /api/v1/consent/kafka/ledger — Downstream Enforcement Ledger ──────
router.get('/kafka/ledger', requireScope('consent:read'), (req, res) => {
  try {
    const ledger = consentService.getEnforcementLedger(req.query.limit || 50);
    return res.json({
      success: true,
      count: ledger.length,
      ledger
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 12. POST /api/v1/consent/kafka/replay — Replay Events from Offset ─────────
router.post('/kafka/replay', requireScope('consent:withdraw'), async (req, res) => {
  try {
    const { topic = 'consent.events.withdrawal', fromOffset = 0, targetGroupId } = req.body || {};
    const result = await consentService.replayKafkaEvents(topic, parseInt(fromOffset, 10), targetGroupId);
    return res.json(result);
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

module.exports = router;
