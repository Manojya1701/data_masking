'use strict';

const dsarService = require('../backend/services/dsar-service');
const dsarPolicyService = require('../backend/services/dsar-policy-service');
const dsarExecutionService = require('../backend/services/dsar-execution-service');
const dsarVerificationService = require('../backend/services/dsar-verification-service');
const dsarCertificateService = require('../backend/services/dsar-certificate-service');

describe('DSAR Step 7: Certified Deletion Certificate & Immutable Audit Package', () => {

  let testRequestId = null;

  beforeAll(async () => {
    // Create test DSAR request
    const res = await dsarService.createDsarRequest({
      fullName: 'Vikram Patel',
      email: 'vikram.cert@example.in',
      phone: '+91 9876543210',
      customerId: 'CUST-8891',
      requestType: 'full_erasure',
      subjectCategory: 'customer',
      verificationEvidence: 'Government ID & Aadhaar Verified (#ID-8891)'
    });
    if (res.success && res.record) {
      testRequestId = res.record.request_id;
      // Pre-run steps 4, 5, 6
      await dsarPolicyService.evaluateLegalPolicy(testRequestId);
      await dsarExecutionService.executeDsarPlan(testRequestId);
      await dsarVerificationService.verifyDsarExecution(testRequestId);
    }
  });

  test('generateCertificateSeal should return 64-character SHA-256 hash', () => {
    const seal = dsarCertificateService.generateCertificateSeal({
      certificateId: 'CERT-2026-000101',
      status: 'CERTIFICATE_ISSUED_CLOSED'
    });
    expect(seal).toBeDefined();
    expect(seal).toMatch(/^[a-f0-9]{64}$/);
  });

  test('generateCertificateNumber should format properly with CERT- prefix', () => {
    const num1 = dsarCertificateService.generateCertificateNumber('DSAR-2026-000101');
    expect(num1).toBe('CERT-2026-000101');

    const num2 = dsarCertificateService.generateCertificateNumber('');
    expect(num2).toMatch(/^CERT-\d{4}-\d{6}$/);
  });

  test('generateDsarCertificate should reject missing or invalid requestId', async () => {
    const res1 = await dsarCertificateService.generateDsarCertificate('');
    expect(res1.success).toBe(false);

    const res2 = await dsarCertificateService.generateDsarCertificate(null);
    expect(res2.success).toBe(false);
  });

  test('generateDsarCertificate should generate complete, cryptographically sealed certificate', async () => {
    if (!testRequestId) return;
    const res = await dsarCertificateService.generateDsarCertificate(testRequestId);

    expect(res.success).toBe(true);
    expect(res.certificateId).toBeDefined();
    expect(res.certificate).toBeDefined();
    expect(res.certificate.requestId).toBe(testRequestId);
    expect(res.certificate.complianceStatus).toBe('CERTIFICATE_ISSUED_CLOSED');
    expect(res.certificate.digitalCertificateSeal).toMatch(/^[a-f0-9]{64}$/);
    expect(res.certificate.dpoAttestation).toBeDefined();
    expect(res.certificate.dpoAttestation.dpoName).toContain('Authorized Privacy Signatory');
    expect(res.certificate.lifecycleAuditSummary).toBeDefined();
    expect(res.certificate.lifecycleAuditSummary.step1_intake).toBeDefined();
    expect(res.certificate.lifecycleAuditSummary.step6_verification).toBeDefined();
    expect(res.certificate.lifecycleAuditSummary.step7_certificate).toBeDefined();
    expect(Array.isArray(res.certificate.regulatoryComplianceScope)).toBe(true);
    expect(res.certificate.regulatoryComplianceScope.length).toBeGreaterThanOrEqual(4);
  });

  test('getDsarCertificate should retrieve existing generated certificate', async () => {
    if (!testRequestId) return;
    const res = await dsarCertificateService.getDsarCertificate(testRequestId);

    expect(res.success).toBe(true);
    expect(res.certificate).toBeDefined();
    expect(res.certificate.requestId).toBe(testRequestId);
    expect(res.certificate.digitalCertificateSeal).toMatch(/^[a-f0-9]{64}$/);
  });

  test('exportDsarAuditPackage should compile court-admissible immutable audit JSON', async () => {
    if (!testRequestId) return;
    const res = await dsarCertificateService.exportDsarAuditPackage(testRequestId);

    expect(res.success).toBe(true);
    expect(res.certificateId).toBeDefined();
    expect(res.filename).toContain('SegmentoProtect-AuditPackage');
    expect(res.exportPayload).toBeDefined();
    expect(res.exportPayload.auditPackageFormat).toBe('SEGMENTO_PROTECT_IMMUTABLE_DSAR_AUDIT_V1');
    expect(res.exportPayload.cryptographicVerificationSeal).toBeDefined();
    expect(res.exportPayload.cryptographicVerificationSeal.sealHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.exportPayload.lifecycleAuditTrail).toBeDefined();
  });

  test('getDsarCertificate should reject invalid tracking ID', async () => {
    const res = await dsarCertificateService.getDsarCertificate('');
    expect(res.success).toBe(false);
  });

});
