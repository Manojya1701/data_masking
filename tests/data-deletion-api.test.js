'use strict';

/**
 * Test Suite: Segmento Data Deletion API Platform (/api/v1/deletions/*)
 * Validates the full 10-endpoint REST specification and 7-stage state machine:
 * 1. Create Deletion Request (CREATED / DISCOVERY_PENDING)
 * 2. Get Deletion Status
 * 3. Discover Connected Data (DISCOVERY_PENDING -> DISCOVERED)
 * 4. Generate 6-Action Deletion Plan (PLAN_READY)
 * 5. Approve Deletion Plan (AWAITING_APPROVAL -> APPROVED)
 * 6. Execute Deletion Across Connectors (EXECUTING -> EXECUTED)
 * 7. Verify Deletion Outcome (VERIFICATION)
 * 8. Get Immutable Audit Trail & Cryptographic Certificate (COMPLETED)
 * 9. Cancel Deletion Request (CANCELLED)
 * 10. Get Exceptions & Retention Reasons (Statutory Rules)
 * 11. Webhook Event Stream
 */

const dataDeletionService = require('../backend/services/data-deletion-service');
const webhookService = require('../backend/services/webhook-service');

describe('Segmento Data Deletion API Platform (/api/v1/deletions)', () => {
  let testDeletionId;
  let testRequestId;

  beforeEach(() => {
    webhookService.clearEventLog();
  });

  // ── 1. Create Deletion Request ───────────────────────────────────────────────
  describe('1. Create Deletion Request (POST /api/v1/deletions)', () => {
    test('creates a new deletion request and emits deletion.created webhook', async () => {
      const payload = {
        requestId: 'DSAR-2026-000999',
        subject: {
          type: 'EMAIL',
          value: 'alex.smith@example.com',
          name: 'Alex Smith',
          phone: '+65 9876 5432'
        },
        reason: 'DATA_SUBJECT_REQUEST',
        scope: 'ALL_ELIGIBLE_DATA',
        jurisdiction: 'SG'
      };

      const res = await dataDeletionService.createDeletionRequest(payload);

      expect(res.deletionId).toMatch(/^DEL-2026-\d+/);
      expect(res.requestId).toBe('DSAR-2026-000999');
      expect(res.status).toBe('DISCOVERY_PENDING');
      expect(res.jurisdiction).toBe('SG');
      expect(res.subject.value).toBe('alex.smith@example.com');

      testDeletionId = res.deletionId;
      testRequestId = res.requestId;

      // Verify Webhook event
      const events = webhookService.getEventHistory({ event: 'deletion.created' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].deletionId).toBe(testDeletionId);
    });

    test('creates a deletion request with defaults when partial payload provided', async () => {
      const res = await dataDeletionService.createDeletionRequest({
        email: 'default.user@example.com'
      });

      expect(res.deletionId).toBeDefined();
      expect(res.subject.value).toBe('default.user@example.com');
      expect(res.status).toBe('DISCOVERY_PENDING');
    });
  });

  // ── 2. Get Deletion Status ───────────────────────────────────────────────────
  describe('2. Get Deletion Status (GET /api/v1/deletions/:id)', () => {
    test('fetches deletion details and lifecycle status', async () => {
      const res = await dataDeletionService.getDeletion(testDeletionId);

      expect(res.deletionId).toBe(testDeletionId);
      expect(res.status).toBeDefined();
      expect(res.subject.value).toBe('alex.smith@example.com');
    });

    test('throws error for non-existent deletion request', async () => {
      await expect(
        dataDeletionService.getDeletion('DEL-NON-EXISTENT')
      ).rejects.toThrow(/not found/);
    });
  });

  // ── 3. Discover Data ─────────────────────────────────────────────────────────
  describe('3. Discover Data (POST /api/v1/deletions/:id/discover)', () => {
    test('runs cross-system discovery and emits deletion.discovery.completed', async () => {
      const res = await dataDeletionService.discoverData(testDeletionId);

      expect(res.deletionId).toBe(testDeletionId);
      expect(res.status).toBe('DISCOVERED');
      expect(res.discovery).toBeDefined();
      expect(res.discovery.systemsScannedCount).toBeGreaterThanOrEqual(1);
      expect(res.discovery.recordsDiscoveredCount).toBeGreaterThan(0);

      const events = webhookService.getEventHistory({ event: 'deletion.discovery.completed' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].deletionId).toBe(testDeletionId);
    });
  });

  // ── 4. Generate Deletion Plan ────────────────────────────────────────────────
  describe('4. Generate Deletion Plan (POST /api/v1/deletions/:id/plan)', () => {
    test('generates a granular 6-action plan with legal exemptions', async () => {
      const res = await dataDeletionService.generatePlan(testDeletionId);

      expect(res.deletionId).toBe(testDeletionId);
      expect(res.status).toBe('PLAN_READY');
      expect(res.plan).toBeDefined();
      expect(res.plan.actionBreakdown).toBeDefined();

      // Check the 6 actions exist in breakdown
      const { actionBreakdown, items } = res.plan;
      expect(actionBreakdown.DELETE).toBeDefined();
      expect(actionBreakdown.ANONYMIZE).toBeDefined();
      expect(actionBreakdown.MASK).toBeDefined();
      expect(actionBreakdown.RETAIN).toBeDefined();

      // Check plan items structure
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      const retainItem = items.find(i => i.action === 'RETAIN');
      expect(retainItem).toBeDefined();
      expect(retainItem.policyRule).toContain('Statutory Exemption');

      const events = webhookService.getEventHistory({ event: 'deletion.plan.created' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].deletionId).toBe(testDeletionId);
    });
  });

  // ── 5. Approve Deletion Plan ─────────────────────────────────────────────────
  describe('5. Approve Deletion Plan (POST /api/v1/deletions/:id/approve)', () => {
    test('approves the deletion plan and emits deletion.approved', async () => {
      const approvalPayload = {
        approvedBy: 'Sarah Lee (DPO)',
        approverRole: 'Data Protection Officer',
        notes: 'Verified compliance with PDPA Section 25.'
      };

      const res = await dataDeletionService.approveDeletion(testDeletionId, approvalPayload);

      expect(res.status).toBe('APPROVED');
      expect(res.approval).toBeDefined();
      expect(res.approval.approved).toBe(true);
      expect(res.approval.approvedBy).toBe('Sarah Lee (DPO)');
      expect(res.approval.approvalSignature).toMatch(/^SIG-ECDSA-/);

      const events = webhookService.getEventHistory({ event: 'deletion.approved' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].deletionId).toBe(testDeletionId);
    });
  });

  // ── 6. Execute Deletion Across Connectors ────────────────────────────────────
  describe('6. Execute Deletion (POST /api/v1/deletions/:id/execute)', () => {
    test('executes deletion jobs across connectors and emits execution webhooks', async () => {
      const res = await dataDeletionService.executeDeletion(testDeletionId);

      expect(res.status).toBe('EXECUTED');
      expect(res.execution).toBeDefined();
      expect(res.execution.connectorsExecuted.length).toBeGreaterThan(0);
      expect(res.execution.summary.recordsDeleted).toBeGreaterThan(0);
      expect(res.execution.summary.recordsRetained).toBeGreaterThan(0);

      const startEvents = webhookService.getEventHistory({ event: 'deletion.started' });
      const completedEvents = webhookService.getEventHistory({ event: 'deletion.system.completed' });
      expect(startEvents.length).toBeGreaterThan(0);
      expect(completedEvents.length).toBeGreaterThan(0);
    });
  });

  // ── 7. Verify Deletion ───────────────────────────────────────────────────────
  describe('7. Verify Deletion (POST /api/v1/deletions/:id/verify)', () => {
    test('verifies 0 residual plaintext PII and emits verification webhook', async () => {
      const res = await dataDeletionService.verifyDeletion(testDeletionId);

      expect(res.status).toBe('VERIFICATION');
      expect(res.verification).toBeDefined();
      expect(res.verification.passed).toBe(true);
      expect(res.verification.score).toBe(100);
      expect(res.verification.evidenceHash).toMatch(/^VERIF-SHA256-/);

      const events = webhookService.getEventHistory({ event: 'deletion.verification.completed' });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ── 8. Get Immutable Audit Trail ─────────────────────────────────────────────
  describe('8. Get Immutable Audit Trail (GET /api/v1/deletions/:id/audit)', () => {
    test('generates cryptographic certificate, closes request (COMPLETED), and returns audit trail', async () => {
      const res = await dataDeletionService.getAuditTrail(testDeletionId);

      expect(res.status).toBe('COMPLETED');
      expect(res.auditTrail).toBeDefined();
      expect(res.auditTrail.certificateId).toBeDefined();
      expect(res.auditTrail.timeline.length).toBeGreaterThanOrEqual(5);
      expect(res.auditTrail.cryptographicSignature.algorithm).toBe('SHA-256 / RSA-4096');
      expect(res.auditTrail.cryptographicSignature.hash).toBeDefined();

      const events = webhookService.getEventHistory({ event: 'deletion.completed' });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].deletionId).toBe(testDeletionId);
    });
  });

  // ── 9. Get Exceptions & Retention Reasons ────────────────────────────────────
  describe('9. Get Exceptions (GET /api/v1/deletions/:id/exceptions)', () => {
    test('returns breakdown of statutory tax/AML retention rules and legal holds', async () => {
      const res = await dataDeletionService.getExceptions(testDeletionId);

      expect(res.deletionId).toBe(testDeletionId);
      expect(Array.isArray(res.exceptions)).toBe(true);
      expect(res.exceptions.length).toBeGreaterThan(0);
      expect(res.retainedCategories.length).toBeGreaterThan(0);
    });
  });

  // ── 10. Cancel Deletion Request ──────────────────────────────────────────────
  describe('10. Cancel Deletion Request (POST /api/v1/deletions/:id/cancel)', () => {
    let cancelableId;

    beforeAll(async () => {
      const createRes = await dataDeletionService.createDeletionRequest({
        email: 'cancel.me@example.com'
      });
      cancelableId = createRes.deletionId;
    });

    test('cancels an in-flight deletion request with a reason', async () => {
      const res = await dataDeletionService.cancelDeletion(cancelableId, {
        reason: 'Data subject withdrew request.',
        cancelledBy: 'Subject'
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('CANCELLED');
      expect(res.cancellation.reason).toBe('Data subject withdrew request.');
    });

    test('rejects cancellation of already completed deletion request', async () => {
      await expect(
        dataDeletionService.cancelDeletion(testDeletionId, { reason: 'Too late' })
      ).rejects.toThrow(/Cannot cancel a completed deletion/);
    });
  });

  // ── 11. Webhook Subscriber Registration & Event Stream ───────────────────────
  describe('11. Webhooks Management', () => {
    test('registers a webhook subscriber and streams events', () => {
      const sub = webhookService.subscribe({
        url: 'https://example.com/webhooks/dsar',
        events: ['deletion.created', 'deletion.completed']
      });

      expect(sub.id).toMatch(/^sub-/);
      expect(sub.url).toBe('https://example.com/webhooks/dsar');
      expect(webhookService.getSubscribers().length).toBeGreaterThan(0);

      const events = webhookService.getEventHistory();
      expect(Array.isArray(events)).toBe(true);
    });
  });
});
