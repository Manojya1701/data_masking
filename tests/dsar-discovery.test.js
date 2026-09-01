'use strict';

/**
 * Unit Tests for DSAR Step 2: Identity Resolution & Data Discovery Service
 * Verifies cross-system PII scanning, data mapping generation, and DB persistence.
 */

const dsarService = require('../backend/services/dsar-service');
const dsarDiscoveryService = require('../backend/services/dsar-discovery-service');

describe('DSAR Step 2: Identity Resolution & Data Discovery Service', () => {

  test('performIdentityDiscovery should fail if tracking ID is invalid or missing', async () => {
    const res = await dsarDiscoveryService.performIdentityDiscovery('');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Valid DSAR Tracking ID is required');
  });

  test('performIdentityDiscovery should fail for non-existent tracking ID', async () => {
    const res = await dsarDiscoveryService.performIdentityDiscovery('DSAR-2026-99999999');
    expect(res.success).toBe(false);
    expect(res.message).toContain('not found');
  });

  test('performIdentityDiscovery should execute cross-system scan and return valid Data Map', async () => {
    // Step 1: Create a test intake request
    const createRes = await dsarService.createDsarRequest({
      fullName: 'Rahul Kumar',
      email: 'rahul@gmail.com',
      phone: '+91 98765 43210',
      requestType: 'full_erasure'
    });

    expect(createRes.success).toBe(true);
    const trackingId = createRes.record.request_id;

    // Step 2: Perform Discovery Scan
    const scanRes = await dsarDiscoveryService.performIdentityDiscovery(trackingId);

    expect(scanRes.success).toBe(true);
    expect(scanRes.dataMap).toBeDefined();
    expect(scanRes.dataMap.requestId).toBe(trackingId);
    expect(scanRes.dataMap.email).toBe('rahul@gmail.com');
    expect(scanRes.dataMap.totalPiiRecordsFound).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(scanRes.dataMap.discoveredTables)).toBe(true);
    expect(scanRes.dataMap.systemsScanned).toBeGreaterThan(0);

    // Verify privacy_deletion_customers was scanned and found Rahul Kumar
    const delTable = scanRes.dataMap.discoveredTables.find(t => t.tableName === 'privacy_deletion_customers');
    expect(delTable).toBeDefined();
    expect(delTable.recordCount).toBeGreaterThanOrEqual(1);
  });

  test('getDsarDiscoveryDataMap should retrieve saved Data Map for tracking ID', async () => {
    const createRes = await dsarService.createDsarRequest({
      fullName: 'Priya Sharma',
      email: 'priya@gmail.com',
      requestType: 'anonymization'
    });

    const trackingId = createRes.record.request_id;
    await dsarDiscoveryService.performIdentityDiscovery(trackingId);

    const fetchRes = await dsarDiscoveryService.getDsarDiscoveryDataMap(trackingId);

    expect(fetchRes.success).toBe(true);
    expect(fetchRes.dataMap).toBeDefined();
    expect(fetchRes.dataMap.requestId).toBe(trackingId);
    expect(fetchRes.dataMap.email).toBe('priya@gmail.com');
  });

});
