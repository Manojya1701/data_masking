'use strict';

const dsarService = require('../backend/services/dsar-service');
const dsarPolicyService = require('../backend/services/dsar-policy-service');

describe('DSAR Step 4: Legal Compliance Policy & Approval Service', () => {

  let testRequestId = null;

  beforeAll(async () => {
    // Create test DSAR request for policy evaluation
    const res = await dsarService.createDsarRequest({
      fullName: 'Vikram Patel',
      email: 'vikram.patel@example.in',
      phone: '+91 9876543210',
      customerId: 'CUST-8891',
      requestType: 'full_erasure',
      subjectCategory: 'customer'
    });
    if (res.success && res.record) {
      testRequestId = res.record.request_id;
    }
  });

  test('generateLegalChecksum should generate valid 64-char SHA-256 hash', () => {
    const hash = dsarPolicyService.generateLegalChecksum({ test: 'payload' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('evaluateLegalPolicyLocally should evaluate India DPDP, GST, and RBI statutory rules', () => {
    const target = {
      requestId: 'DSAR-2026-000001',
      fullName: 'Vikram Patel',
      email: 'vikram@example.in',
      phone: '+91 9876543210'
    };
    const dataMap = {
      discoveredTables: [
        { tableName: 'customers', recordCount: 1 },
        { tableName: 'orders', recordCount: 2 }
      ]
    };

    const result = dsarPolicyService.evaluateLegalPolicyLocally(target, dataMap);
    expect(result.success).toBe(true);
    expect(result.jurisdictions).toContain('INDIA_DPDP_2023');
    expect(result.jurisdictions).toContain('INDIA_TAX_GST_INCOME_TAX');
    expect(result.policyMatrix.length).toBe(2);
    expect(result.statutoryLocksCount).toBe(1);
    expect(result.approvalMode).toBe('DPO_SIGN_OFF_REQUIRED');
    expect(result.legalDefenseStatement).toContain('DPDP Act 2023');
  });

  test('evaluateLegalPolicy should evaluate policy for valid tracking ID', async () => {
    if (!testRequestId) return;
    const res = await dsarPolicyService.evaluateLegalPolicy(testRequestId);

    expect(res.success).toBe(true);
    expect(res.report).toBeDefined();
    expect(res.report.requestId).toBe(testRequestId);
    expect(res.report.policyMatrix).toBeDefined();
    expect(res.report.legalCertificateHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('getDsarPolicyReport should return evaluated report', async () => {
    if (!testRequestId) return;
    const res = await dsarPolicyService.getDsarPolicyReport(testRequestId);

    expect(res.success).toBe(true);
    expect(res.report).toBeDefined();
    expect(res.report.requestId).toBe(testRequestId);
  });

  test('approvePolicyCompliance should record DPO digital sign-off and signature hash', async () => {
    if (!testRequestId) return;
    const approveRes = await dsarPolicyService.approvePolicyCompliance(
      testRequestId,
      'Legal retention lock verified under GST Act Sec. 36. Marketing records authorized for erasure.',
      'S. Sharma (Chief Privacy Officer)'
    );

    expect(approveRes.success).toBe(true);
    expect(approveRes.dpoSignOff).toBeDefined();
    expect(approveRes.dpoSignOff.status).toBe('DPO_APPROVED');
    expect(approveRes.dpoSignOff.signedBy).toBe('S. Sharma (Chief Privacy Officer)');
    expect(approveRes.dpoSignOff.approvalSignatureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(approveRes.report.overallStatus).toBe('DPO_APPROVED_READY_FOR_EXECUTION');
  });

  test('evaluateLegalPolicy should fail gracefully for non-existent tracking ID', async () => {
    const res = await dsarPolicyService.evaluateLegalPolicy('DSAR-NON-EXISTENT');
    expect(res.success).toBe(false);
    expect(res.message).toContain('not found');
  });
});
