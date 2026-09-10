'use strict';

const dsarService = require('../backend/services/dsar-service');
const dsarPolicyService = require('../backend/services/dsar-policy-service');
const dsarExecutionService = require('../backend/services/dsar-execution-service');

describe('DSAR Step 5: Deletion & Anonymization Execution Engine Service', () => {

  let testRequestId = null;

  beforeAll(async () => {
    // Create test DSAR request
    const res = await dsarService.createDsarRequest({
      fullName: 'Vikram Patel',
      email: 'vikram.p@example.in',
      phone: '+91 9876543210',
      customerId: 'CUST-8891',
      requestType: 'full_erasure',
      subjectCategory: 'customer'
    });
    if (res.success && res.record) {
      testRequestId = res.record.request_id;
      // Pre-evaluate policy for the request
      await dsarPolicyService.evaluateLegalPolicy(testRequestId);
    }
  });

  test('maskPersonName should mask names correctly', () => {
    expect(dsarExecutionService.maskPersonName('Vikram Patel')).toBe('V****m P***l');
    expect(dsarExecutionService.maskPersonName('John')).toBe('J**n');
  });

  test('maskEmail should mask emails preserving domains', () => {
    expect(dsarExecutionService.maskEmail('vikram@gmail.com')).toBe('v****m@gmail.com');
  });

  test('maskPhone should mask phone preserving country code and last 3 digits', () => {
    expect(dsarExecutionService.maskPhone('+91 9876543210')).toBe('+91 *******210');
  });

  test('generateExecutionChecksum should return 64-char SHA-256 hash', () => {
    const hash = dsarExecutionService.generateExecutionChecksum({ status: 'completed' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('executeDsarPlan should execute deletion and masking for valid tracking ID', async () => {
    if (!testRequestId) return;
    const res = await dsarExecutionService.executeDsarPlan(testRequestId);

    expect(res.success).toBe(true);
    expect(res.executionReport).toBeDefined();
    expect(res.executionReport.requestId).toBe(testRequestId);
    expect(res.executionReport.executionStatus).toBe('COMPLETED_SUCCESSFULLY');
    expect(res.executionReport.recordsPurgedCount).toBeGreaterThanOrEqual(1);
    expect(res.executionReport.recordsAnonymizedCount).toBeGreaterThanOrEqual(1);
    expect(res.executionReport.executionChecksum).toMatch(/^[a-f0-9]{64}$/);
  });

  test('getDsarExecutionReport should return saved report', async () => {
    if (!testRequestId) return;
    const res = await dsarExecutionService.getDsarExecutionReport(testRequestId);

    expect(res.success).toBe(true);
    expect(res.executionReport).toBeDefined();
    expect(res.executionReport.requestId).toBe(testRequestId);
  });

  test('executeDsarPlan should fail gracefully for non-existent tracking ID', async () => {
    const res = await dsarExecutionService.executeDsarPlan('DSAR-NON-EXISTENT');
    expect(res.success).toBe(false);
    expect(res.message).toContain('not found');
  });
});
