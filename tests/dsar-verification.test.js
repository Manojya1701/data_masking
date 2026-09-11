'use strict';

const dsarService = require('../backend/services/dsar-service');
const dsarPolicyService = require('../backend/services/dsar-policy-service');
const dsarExecutionService = require('../backend/services/dsar-execution-service');
const dsarVerificationService = require('../backend/services/dsar-verification-service');

describe('DSAR Step 6: Post-Deletion Verification & Residual PII Re-Scan Engine', () => {

  let testRequestId = null;

  beforeAll(async () => {
    // Create test DSAR request
    const res = await dsarService.createDsarRequest({
      fullName: 'Vikram Patel',
      email: 'vikram.verify@example.in',
      phone: '+91 9876543210',
      customerId: 'CUST-8891',
      requestType: 'full_erasure',
      subjectCategory: 'customer'
    });
    if (res.success && res.record) {
      testRequestId = res.record.request_id;
      // Pre-evaluate policy & execute plan for the request
      await dsarPolicyService.evaluateLegalPolicy(testRequestId);
      await dsarExecutionService.executeDsarPlan(testRequestId);
    }
  });

  test('generateVerificationDigest should return 64-character SHA-256 hash', () => {
    const digest = dsarVerificationService.generateVerificationDigest({
      requestId: 'DSAR-2026-000101',
      status: 'VERIFICATION_PASSED'
    });
    expect(digest).toBeDefined();
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  test('verifyDsarExecution should reject missing or invalid requestId', async () => {
    const res1 = await dsarVerificationService.verifyDsarExecution('');
    expect(res1.success).toBe(false);

    const res2 = await dsarVerificationService.verifyDsarExecution(null);
    expect(res2.success).toBe(false);
  });

  test('verifyDsarExecution should execute multi-system residual PII audit for valid tracking ID', async () => {
    if (!testRequestId) return;
    const res = await dsarVerificationService.verifyDsarExecution(testRequestId);

    expect(res.success).toBe(true);
    expect(res.verificationReport).toBeDefined();
    expect(res.verificationReport.requestId).toBe(testRequestId);
    expect(res.verificationReport.isVerificationPassed).toBe(true);
    expect(res.verificationReport.residualDirectPiiCount).toBe(0);
    expect(res.verificationReport.totalSystemsScanned).toBe(5);
    expect(res.verificationReport.verifiedCleanSystemsCount).toBe(5);
    expect(res.verificationReport.verificationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(res.verificationReport.overallVerificationStatus).toBe('VERIFICATION_PASSED_100_PERCENT_CLEAN');
    expect(Array.isArray(res.verificationReport.verificationAuditLogs)).toBe(true);
    expect(res.verificationReport.verificationAuditLogs.length).toBe(5);
  });

  test('verificationAuditLogs should contain entries for all 5 enterprise systems', async () => {
    if (!testRequestId) return;
    const res = await dsarVerificationService.verifyDsarExecution(testRequestId);
    const logs = res.verificationReport.verificationAuditLogs;

    const systemTypes = logs.map(l => l.systemType);
    expect(systemTypes).toContain('RELATIONAL_DATABASE');
    expect(systemTypes).toContain('FINANCIAL_TAX_STORE');
    expect(systemTypes).toContain('SEARCH_INDEX_CLUSTER');
    expect(systemTypes).toContain('GRAPH_DATABASE');
    expect(systemTypes).toContain('EPHEMERAL_FILE_STORE');
  });

  test('getDsarVerificationReport should return saved report for tracking ID', async () => {
    if (!testRequestId) return;
    const res = await dsarVerificationService.getDsarVerificationReport(testRequestId);

    expect(res.success).toBe(true);
    expect(res.verificationReport).toBeDefined();
    expect(res.verificationReport.requestId).toBe(testRequestId);
    expect(res.verificationReport.verificationDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  test('getDsarVerificationReport should reject invalid tracking ID', async () => {
    const res = await dsarVerificationService.getDsarVerificationReport('');
    expect(res.success).toBe(false);
  });

});
