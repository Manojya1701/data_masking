'use strict';

/**
 * Unit Tests for DSAR Step 3: Impact Analysis & Dependency Mapping Service
 * Verifies relational dependency scanning, risk score evaluation, and report persistence.
 */

const dsarService = require('../backend/services/dsar-service');
const dsarDiscoveryService = require('../backend/services/dsar-discovery-service');
const dsarImpactService = require('../backend/services/dsar-impact-service');

describe('DSAR Step 3: Impact Analysis & Dependency Mapping Service', () => {

  test('performImpactAnalysis should fail if tracking ID is invalid or missing', async () => {
    const res = await dsarImpactService.performImpactAnalysis('');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Valid DSAR Tracking ID is required');
  });

  test('performImpactAnalysis should fail for non-existent tracking ID', async () => {
    const res = await dsarImpactService.performImpactAnalysis('DSAR-2026-99999999');
    expect(res.success).toBe(false);
    expect(res.message).toContain('not found');
  });

  test('performImpactAnalysis should evaluate dependencies, risk score, and recommended erasure action', async () => {
    // Step 1: Create intake request
    const createRes = await dsarService.createDsarRequest({
      fullName: 'Ananya Sharma',
      email: 'ananya@example.com',
      requestType: 'full_erasure'
    });

    expect(createRes.success).toBe(true);
    const trackingId = createRes.record.request_id;

    // Step 2: Run Discovery Scan
    await dsarDiscoveryService.performIdentityDiscovery(trackingId);

    // Step 3: Run Impact Analysis Scan
    const impactRes = await dsarImpactService.performImpactAnalysis(trackingId);

    expect(impactRes.success).toBe(true);
    expect(impactRes.impactReport).toBeDefined();
    expect(impactRes.impactReport.requestId).toBe(trackingId);
    expect(impactRes.impactReport.riskLevel).toBeDefined();
    expect(impactRes.impactReport.riskScore).toBeGreaterThanOrEqual(0);
    expect(impactRes.impactReport.recommendedAction).toBeDefined();
    expect(Array.isArray(impactRes.impactReport.dependencies)).toBe(true);
  });

  test('getDsarImpactReport should retrieve saved Impact Analysis Report for tracking ID', async () => {
    const createRes = await dsarService.createDsarRequest({
      fullName: 'Vikram Patel',
      email: 'vikram.p@example.com',
      requestType: 'anonymization'
    });

    const trackingId = createRes.record.request_id;
    await dsarDiscoveryService.performIdentityDiscovery(trackingId);
    await dsarImpactService.performImpactAnalysis(trackingId);

    const fetchRes = await dsarImpactService.getDsarImpactReport(trackingId);

    expect(fetchRes.success).toBe(true);
    expect(fetchRes.impactReport).toBeDefined();
    expect(fetchRes.impactReport.requestId).toBe(trackingId);
  });

});
