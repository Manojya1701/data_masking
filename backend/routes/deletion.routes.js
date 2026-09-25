'use strict';

/**
 * Segmento Data Deletion API Routes
 * Implements the full REST specification protected by Segmento OAuth 2.0 Gateway:
 * - POST /api/v1/deletions             — Create deletion request (Scope: deletions:create)
 * - GET  /api/v1/deletions             — List all deletion requests (Scope: deletions:read)
 * - GET  /api/v1/deletions/:id         — Get deletion status (Scope: deletions:read)
 * - POST /api/v1/deletions/:id/discover — Discover data (Scope: deletions:write)
 * - POST /api/v1/deletions/:id/plan    — Generate 6-action plan (Scope: deletions:write)
 * - POST /api/v1/deletions/:id/approve — Approve deletion plan (Scope: deletions:approve)
 * - POST /api/v1/deletions/:id/execute — Execute deletion (Scope: deletions:execute)
 * - POST /api/v1/deletions/:id/verify  — Verify deletion outcome (Scope: deletions:verify)
 * - GET  /api/v1/deletions/:id/audit   — Get audit trail & certificate (Scope: audit:read)
 * - POST /api/v1/deletions/:id/cancel  — Cancel deletion request (Scope: deletions:cancel)
 * - GET  /api/v1/deletions/:id/exceptions — Get exceptions (Scope: deletions:read)
 * - POST /api/v1/deletions/webhooks/subscribe — Register webhook subscriber (Scope: webhooks:manage)
 * - GET  /api/v1/deletions/webhooks/events   — View webhook stream (Scope: webhooks:manage)
 */

const express = require('express');
const dataDeletionService = require('../services/data-deletion-service');
const webhookService = require('../services/webhook-service');
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

// ── 1. POST /api/v1/deletions — Create deletion request ───────────────────────
router.post('/', requireScope('deletions:create'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      tenantId: req.tenant ? req.tenant.tenantId : undefined,
      createdBy: req.auth ? (req.auth.user ? req.auth.user.email : req.auth.clientId) : undefined
    };
    const record = await dataDeletionService.createDeletionRequest(payload);
    return res.status(201).json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      subject: record.subject,
      reason: record.reason,
      scope: record.scope,
      jurisdiction: record.jurisdiction,
      createdAt: record.createdAt
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── GET /api/v1/deletions — List all deletion requests ────────────────────────
router.get('/', requireScope('deletions:read'), async (req, res) => {
  try {
    const list = await dataDeletionService.listDeletions(req.query);
    return res.json({
      success: true,
      count: list.length,
      deletions: list
    });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── Webhooks Helpers ──────────────────────────────────────────────────────────
router.post('/webhooks/subscribe', requireScope('webhooks:manage'), (req, res) => {
  try {
    const sub = webhookService.subscribe(req.body);
    return res.status(201).json({ success: true, subscriber: sub });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

router.get('/webhooks/events', requireScope('webhooks:manage'), (req, res) => {
  try {
    const events = webhookService.getEventHistory(req.query);
    return res.json({ success: true, count: events.length, events });
  } catch (err) {
    return jsonError(res, 500, err.message);
  }
});

// ── 2. GET /api/v1/deletions/:id — Get deletion status ────────────────────────
router.get('/:id', requireScope('deletions:read'), async (req, res) => {
  try {
    const record = await dataDeletionService.getDeletion(req.params.id);
    return res.json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      subject: record.subject,
      reason: record.reason,
      scope: record.scope,
      jurisdiction: record.jurisdiction,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      discovery: record.discovery,
      plan: record.plan,
      approval: record.approval,
      execution: record.execution,
      verification: record.verification,
      audit: record.audit,
      exceptionsCount: record.exceptions ? record.exceptions.length : 0
    });
  } catch (err) {
    return jsonError(res, 404, err.message);
  }
});

// ── 3. POST /api/v1/deletions/:id/discover — Discover data ────────────────────
router.post('/:id/discover', requireScope('deletions:write'), async (req, res) => {
  try {
    const record = await dataDeletionService.discoverData(req.params.id);
    return res.json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      discovery: record.discovery
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 4. POST /api/v1/deletions/:id/plan — Generate deletion plan ───────────────
router.post('/:id/plan', requireScope('deletions:write'), async (req, res) => {
  try {
    const record = await dataDeletionService.generatePlan(req.params.id);
    return res.json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      plan: record.plan,
      exceptionsCount: record.exceptions.length
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 5. POST /api/v1/deletions/:id/approve — Approve deletion plan ─────────────
router.post('/:id/approve', requireScope('deletions:approve'), async (req, res) => {
  try {
    const approvalData = {
      ...req.body,
      approvedBy: (req.auth && req.auth.user && req.auth.user.email) || req.body.approvedBy || 'dpo@segmento.com'
    };
    const record = await dataDeletionService.approveDeletion(req.params.id, approvalData);
    return res.json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      approval: record.approval
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 6. POST /api/v1/deletions/:id/execute — Execute deletion across connectors ─
router.post('/:id/execute', requireScope('deletions:execute'), async (req, res) => {
  try {
    const record = await dataDeletionService.executeDeletion(req.params.id, req.body);
    return res.json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      execution: record.execution
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 7. POST /api/v1/deletions/:id/verify — Verify deletion ────────────────────
router.post('/:id/verify', requireScope('deletions:verify'), async (req, res) => {
  try {
    const record = await dataDeletionService.verifyDeletion(req.params.id);
    return res.json({
      success: true,
      deletionId: record.deletionId,
      requestId: record.requestId,
      status: record.status,
      verification: record.verification
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 8. GET /api/v1/deletions/:id/audit — Get audit trail & certificate ─────────
router.get('/:id/audit', requireScope('audit:read'), async (req, res) => {
  try {
    const auditData = await dataDeletionService.getAuditTrail(req.params.id);
    return res.json({
      success: true,
      ...auditData
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 9. POST /api/v1/deletions/:id/cancel — Cancel deletion request ────────────
router.post('/:id/cancel', requireScope('deletions:cancel'), async (req, res) => {
  try {
    const result = await dataDeletionService.cancelDeletion(req.params.id, req.body);
    return res.json(result);
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

// ── 10. GET /api/v1/deletions/:id/exceptions — Get retention & legal hold exceptions
router.get('/:id/exceptions', requireScope('deletions:read'), async (req, res) => {
  try {
    const exceptions = await dataDeletionService.getExceptions(req.params.id);
    return res.json({
      success: true,
      ...exceptions
    });
  } catch (err) {
    return jsonError(res, 400, err.message);
  }
});

module.exports = router;
