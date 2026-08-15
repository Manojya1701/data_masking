'use strict';

/**
 * Unit Tests for PostgreSQL Database Integration & Audit Logging
 */

const db = require('../backend/database/db');
const auditService = require('../backend/services/audit-service');
const fs = require('fs');
const path = require('path');

describe('PostgreSQL Database & Audit Service', () => {
  describe('db.js module', () => {
    test('isConfigured returns boolean based on DATABASE_URL', () => {
      const configured = db.isConfigured();
      expect(typeof configured).toBe('boolean');
    });

    test('healthCheck returns status object without throwing', async () => {
      const health = await db.healthCheck();
      expect(health).toHaveProperty('success');
      expect(health).toHaveProperty('database');
      expect(typeof health.success).toBe('boolean');
    });
  });

  describe('schema.sql privacy compliance', () => {
    test('schema.sql does not contain columns for PII values or passwords', () => {
      const schemaSql = fs.readFileSync(path.join(__dirname, '../backend/database/schema.sql'), 'utf8');
      const forbiddenTerms = [
        'plaintext', 'pii_value', 'raw_content', 'email_address', 'password',
        'decrypted_content', 'secret_key', 'token_mapping'
      ];
      for (const term of forbiddenTerms) {
        expect(schemaSql.toLowerCase()).not.toContain(term);
      }
    });
  });

  describe('audit-service.js offline resilience (Graceful Fallback)', () => {
    test('recordProcessingHistory handles unconfigured DB without throwing', async () => {
      const result = await auditService.recordProcessingHistory({
        jobId: 'test-job-123',
        originalFileName: 'test.pdf',
        fileFormat: 'pdf',
        fileSize: 1024,
        operation: 'mask',
        maskingType: 'tokenization',
        processedCount: 5,
        status: 'success',
      });
      // Should return null (or ID if DB is connected), never throw
      expect(result === null || typeof result === 'number' || typeof result === 'string').toBe(true);
    });

    test('recordPrivacyScanHistory handles unconfigured DB without throwing', async () => {
      const result = await auditService.recordPrivacyScanHistory({
        jobId: 'scan-job-456',
        fileName: 'sample.csv',
        fileFormat: 'csv',
        fileSize: 2048,
        totalDetected: 3,
        counts: { email: 2, phone: 1 },
        riskLevel: 'Medium',
      });
      expect(result === null || typeof result === 'number' || typeof result === 'string').toBe(true);
    });

    test('getHistory returns valid result structure without throwing', async () => {
      const res = await auditService.getHistory({ limit: 10, operation: 'mask', format: 'pdf', status: 'success' });
      expect(res).toHaveProperty('configured');
      expect(res).toHaveProperty('records');
      expect(Array.isArray(res.records)).toBe(true);
    });

    test('getHistory bounds limit parameter safely', async () => {
      const res = await auditService.getHistory({ limit: '9999' });
      expect(Array.isArray(res.records)).toBe(true);
    });
  });
});
