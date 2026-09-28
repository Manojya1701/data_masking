'use strict';

/**
 * Consent Withdrawal & Management Tests (Day 1)
 * Validates:
 * 1. Granular consent categories model (Marketing, AI Training, Behavioral Tracking, Third-Party Sharing, Biometrics)
 * 2. State machine transitions (GRANTED -> WITHDRAWN -> GRANTED)
 * 3. SHA-256 Cryptographic withdrawal receipt generation
 * 4. Downstream suppression list hashing and sync
 * 5. Full audit history & receipts lookup
 */

const consentService = require('../backend/services/consent-service');

describe('Consent Management & Withdrawal Service (GDPR Art. 7(3) / DPDP Sec. 6(4))', () => {

  const testSubject = `test.user.${Date.now()}@example.com`;

  describe('1. Consent Categories & Default State', () => {
    test('should retrieve all 5 standard granular consent categories with metadata', () => {
      const categories = consentService.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(5);

      const categoryIds = categories.map(c => c.id);
      expect(categoryIds).toContain('MARKETING_COMMUNICATIONS');
      expect(categoryIds).toContain('AI_MODEL_TRAINING');
      expect(categoryIds).toContain('BEHAVIORAL_TRACKING');
      expect(categoryIds).toContain('THIRD_PARTY_SHARING');
      expect(categoryIds).toContain('BIOMETRIC_TELEMETRY');
    });

    test('should initialize a default active consent matrix for a new subject', () => {
      const status = consentService.getConsentStatus(testSubject);
      expect(status.identifier).toBe(testSubject);
      expect(status.accountStatus).toBe('ACTIVE');
      expect(status.summary.totalCategories).toBe(5);
      expect(status.summary.grantedCount).toBe(5);
      expect(status.summary.withdrawnCount).toBe(0);
      expect(status.summary.overallStatus).toBe('ALL_GRANTED');
      expect(status.categories.AI_MODEL_TRAINING.state).toBe('GRANTED');
      expect(status.categories.MARKETING_COMMUNICATIONS.state).toBe('GRANTED');
    });
  });

  describe('2. Granular Consent Withdrawal Execution & Proof Receipt', () => {
    let withdrawalReceipt;

    test('should withdraw consent for selected categories (AI_MODEL_TRAINING and MARKETING_COMMUNICATIONS)', async () => {
      const result = await consentService.withdrawConsent({
        identifier: testSubject,
        categories: ['AI_MODEL_TRAINING', 'MARKETING_COMMUNICATIONS'],
        reason: 'Subject requested AI training opt-out and marketing stop',
        requestedVia: 'DSAR_PORTAL',
        actor: 'subject',
        jurisdiction: 'EU (GDPR)'
      });

      expect(result.success).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.receiptId).toMatch(/^WDR-\d{4}-/);
      expect(result.receipt.sha256Proof).toBeDefined();
      expect(result.receipt.sha256Proof.length).toBe(64); // Valid SHA-256 hex
      expect(result.receipt.suppressionToken).toBeDefined();
      expect(result.receipt.suppressionToken.length).toBe(64);
      expect(result.receipt.withdrawnCategories.length).toBe(2);

      withdrawalReceipt = result.receipt;

      // Verify downstream synchronization
      expect(Array.isArray(result.downstreamSync)).toBe(true);
      expect(result.downstreamSync.length).toBeGreaterThan(0);
      const syncedSystems = result.downstreamSync.map(s => s.system);
      expect(syncedSystems).toContain('Vertex AI Pipeline');
      expect(syncedSystems).toContain('Braze CRM');

      // Verify updated subject status
      const updatedStatus = consentService.getConsentStatus(testSubject);
      expect(updatedStatus.summary.overallStatus).toBe('PARTIALLY_WITHDRAWN');
      expect(updatedStatus.categories.AI_MODEL_TRAINING.state).toBe('WITHDRAWN');
      expect(updatedStatus.categories.MARKETING_COMMUNICATIONS.state).toBe('WITHDRAWN');
      expect(updatedStatus.categories.BEHAVIORAL_TRACKING.state).toBe('GRANTED'); // untouched
      expect(updatedStatus.accountStatus).toBe('ACTIVE'); // Account remains active unlike full deletion
    });

    test('should look up withdrawal receipt by receiptId', () => {
      const receipt = consentService.getReceipt(withdrawalReceipt.receiptId);
      expect(receipt).toBeDefined();
      expect(receipt.receiptId).toBe(withdrawalReceipt.receiptId);
      expect(receipt.sha256Proof).toBe(withdrawalReceipt.sha256Proof);
      expect(receipt.identifier).toBe(testSubject);
    });

    test('should withdraw ALL remaining consent categories when categories="ALL"', async () => {
      const result = await consentService.withdrawConsent({
        identifier: testSubject,
        categories: 'ALL',
        reason: 'Complete opt-out across all categories',
        requestedVia: 'DSAR_PORTAL'
      });

      expect(result.success).toBe(true);
      expect(result.receipt.withdrawnCategories.length).toBe(5);

      const status = consentService.getConsentStatus(testSubject);
      expect(status.summary.overallStatus).toBe('ALL_WITHDRAWN');
      expect(status.summary.withdrawnCount).toBe(5);
      expect(status.summary.grantedCount).toBe(0);
    });

    test('should reject withdrawal with empty or invalid categories', async () => {
      await expect(consentService.withdrawConsent({
        identifier: testSubject,
        categories: ['NON_EXISTENT_CATEGORY']
      })).rejects.toThrow(/Invalid or empty consent categories/);
    });
  });

  describe('3. Re-granting Consent & Audit Trail', () => {
    test('should re-grant consent for specified categories (Opt-in)', async () => {
      const grantResult = await consentService.grantConsent({
        identifier: testSubject,
        categories: ['AI_MODEL_TRAINING'],
        reason: 'Subject voluntarily opted back in to AI features'
      });

      expect(grantResult.success).toBe(true);
      expect(grantResult.receiptId).toMatch(/^GNT-\d{4}-/);

      const status = consentService.getConsentStatus(testSubject);
      expect(status.categories.AI_MODEL_TRAINING.state).toBe('GRANTED');
      expect(status.categories.MARKETING_COMMUNICATIONS.state).toBe('WITHDRAWN');
    });

    test('should maintain an immutable audit trail with history entries', () => {
      const historyRes = consentService.getConsentHistory(testSubject);
      expect(historyRes.identifier).toBe(testSubject);
      expect(historyRes.totalEvents).toBeGreaterThanOrEqual(3);
      
      const actions = historyRes.history.map(h => h.action);
      expect(actions).toContain('WITHDRAWAL');
      expect(actions).toContain('CONSENT_GRANTED');
    });

    test('should list all consent records for DPO compliance overview', () => {
      const list = consentService.listRecords();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      
      const filtered = consentService.listRecords({ search: testSubject });
      expect(filtered.length).toBe(1);
      expect(filtered[0].identifier).toBe(testSubject);
    });
  });

});
