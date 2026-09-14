'use strict';

const dsarService = require('../backend/services/dsar-service');

describe('DSAR Intake Service (Step 1)', () => {

  test('generateDsarTrackingId should generate valid DSAR-YYYY-XXXXXX format', () => {
    const trackingId = dsarService.generateDsarTrackingId();
    expect(trackingId).toMatch(/^DSAR-2026-\d{6}$/);
  });

  test('createDsarRequest should fail if full name is missing', async () => {
    const res = await dsarService.createDsarRequest({ email: 'john@example.com' });
    expect(res.success).toBe(false);
    expect(res.message).toContain('Full Name is required');
  });

  test('createDsarRequest should fail if email is invalid', async () => {
    const res = await dsarService.createDsarRequest({ fullName: 'John Doe', email: 'invalid_email' });
    expect(res.success).toBe(false);
    expect(res.message).toContain('Valid Data Subject Email is required');
  });

  test('createDsarRequest should create valid DSAR request with tracking ID', async () => {
    const res = await dsarService.createDsarRequest({
      fullName: 'Alice Smith',
      email: 'alice.smith@example.com',
      phone: '+91 99887 76655',
      customerId: 'CUST-9901',
      requestType: 'full_erasure',
      subjectCategory: 'customer',
      verificationEvidence: 'Aadhaar Verified'
    });

    expect(res.success).toBe(true);
    expect(res.record).toBeDefined();
    expect(res.record.request_id).toMatch(/^DSAR-2026-\d{6}$/);
    expect(res.record.full_name).toBe('Alice Smith');
    expect(res.record.email).toBe('alice.smith@example.com');
    expect(res.record.status).toBe('RECEIVED');
  });

  test('getDsarRequests should retrieve all active DSAR intake requests', async () => {
    const res = await dsarService.getDsarRequests();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.records)).toBe(true);
    expect(res.records.length).toBeGreaterThan(0);
  });

  test('getDsarRequestById should return request details for matching ID', async () => {
    const createRes = await dsarService.createDsarRequest({
      fullName: 'Bob Johnson',
      email: 'bob.j@example.com',
      requestType: 'anonymization'
    });

    const trackingId = createRes.record.request_id;
    const fetchRes = await dsarService.getDsarRequestById(trackingId);

    expect(fetchRes.success).toBe(true);
    expect(fetchRes.record).toBeDefined();
    expect(fetchRes.record.request_id).toBe(trackingId);
    expect(fetchRes.record.full_name).toBe('Bob Johnson');
  });

  test('updateDsarTask should update assignee, priority, status, and internal notes', async () => {
    const updateRes = await dsarService.updateDsarTask('DSAR-2026-000125', {
      assigned_to: 'Sarah Lee',
      priority: 'Critical',
      status: 'Under Legal Review',
      internal_notes: 'Escalated to legal compliance team.'
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.record.assigned_to).toBe('Sarah Lee');
    expect(updateRes.record.priority).toBe('Critical');
    expect(updateRes.record.status).toBe('Under Legal Review');
    expect(updateRes.record.internal_notes).toContain('Escalated to legal');
  });

  test('getDsarComplianceReports should return aggregated metrics across jurisdictions', async () => {
    const reports = await dsarService.getDsarComplianceReports();
    expect(reports.success).toBe(true);
    expect(reports.complianceRate).toBe('100%');
    expect(reports.avgSlaTurnaroundDays).toBeDefined();
    expect(reports.jurisdictions).toBeDefined();
    expect(reports.requestTypes).toBeDefined();
    expect(reports.teamWorkload).toBeDefined();
    expect(reports.priorities).toBeDefined();
  });

  test('exportDsarComplianceCsv should return valid CSV content with headers', async () => {
    const csv = await dsarService.exportDsarComplianceCsv();
    expect(typeof csv).toBe('string');
    expect(csv).toContain('DSAR Tracking ID');
    expect(csv).toContain('Data Subject Name');
    expect(csv).toContain('Jurisdiction / Country');
    expect(csv).toContain('Right Type');
    expect(csv).toContain('Assigned Officer');
  });

});

