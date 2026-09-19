'use strict';

const emailNotificationService = require('../backend/services/email-notification-service');
const dsarSettingsService = require('../backend/services/dsar-settings-service');
const dsarService = require('../backend/services/dsar-service');

describe('DSAR Platform Settings & Email Notification Services', () => {

  beforeEach(async () => {
    await dsarSettingsService.resetSettings();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 1. PLATFORM SETTINGS SERVICE TESTS ──────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  describe('dsarSettingsService', () => {
    
    test('getSettings() should return all 4 categories with default configurations', async () => {
      const res = await dsarSettingsService.getSettings();
      expect(res.success).toBe(true);
      expect(res.settings).toBeDefined();

      const { email, statutory, security, organization } = res.settings;

      // 1. Email
      expect(email).toBeDefined();
      expect(email.senderName).toBe('Segmento Protect Privacy Office');
      expect(email.senderEmail).toBe('privacy-notifications@segmento.com');
      expect(email.smtpPort).toBe(587);
      expect(email.autoNotifyOnAssignment).toBe(true);
      expect(email.autoNotifyOnApproval).toBe(true);

      // 2. Statutory
      expect(statutory).toBeDefined();
      expect(statutory.defaultSlaDays).toBe(30);
      expect(statutory.graceBufferDays).toBe(5);
      expect(statutory.escalationAlertThresholdPct).toBe(80);
      expect(statutory.enforceGstTaxLock).toBe(true);
      expect(statutory.enforceRbiKycLock).toBe(true);

      // 3. Security
      expect(security).toBeDefined();
      expect(security.enableSha256LedgerSeals).toBe(true);
      expect(security.requireDpoDigitalSignature).toBe(true);
      expect(security.dpoCertificateId).toBe('CERT-DPO-SG-2026-9941');
      expect(security.auditRetentionYears).toBe(7);

      // 4. Organization
      expect(organization).toBeDefined();
      expect(organization.companyName).toBe('Segmento Protect Enterprise');
      expect(organization.dpoName).toContain('Anil Reddy');
      expect(organization.legalLead).toContain('Vikram Malhotra');
    });

    test('getCategorySettings() should return specific category configuration', async () => {
      const emailRes = await dsarSettingsService.getCategorySettings('email');
      expect(emailRes.success).toBe(true);
      expect(emailRes.category).toBe('email');
      expect(emailRes.settings.smtpHost).toBe('smtp.segmento-protect.internal');

      const statutoryRes = await dsarSettingsService.getCategorySettings('statutory');
      expect(statutoryRes.success).toBe(true);
      expect(statutoryRes.settings.defaultSlaDays).toBe(30);

      const invalidRes = await dsarSettingsService.getCategorySettings('invalid_cat');
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.notFound).toBe(true);
    });

    test('updateSettings() should update specific fields in a category and preserve other fields', async () => {
      const updateRes = await dsarSettingsService.updateSettings('email', {
        smtpHost: 'mail.custom-segmento.com',
        smtpPort: 465
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.settings.smtpHost).toBe('mail.custom-segmento.com');
      expect(updateRes.settings.smtpPort).toBe(465);
      // Sender name should remain preserved
      expect(updateRes.settings.senderName).toBe('Segmento Protect Privacy Office');

      // Verify persistence via getSettings
      const check = await dsarSettingsService.getSettings();
      expect(check.settings.email.smtpHost).toBe('mail.custom-segmento.com');
      expect(check.settings.email.smtpPort).toBe(465);
    });

    test('updateSettings() should reject invalid category names', async () => {
      const res = await dsarSettingsService.updateSettings('non_existent_category', { foo: 'bar' });
      expect(res.success).toBe(false);
      expect(res.notFound).toBe(true);
    });

    test('resetSettings() should restore system canonical defaults', async () => {
      await dsarSettingsService.updateSettings('organization', { companyName: 'Temporary Test Corp' });
      let check = await dsarSettingsService.getSettings();
      expect(check.settings.organization.companyName).toBe('Temporary Test Corp');

      const resetRes = await dsarSettingsService.resetSettings();
      expect(resetRes.success).toBe(true);

      check = await dsarSettingsService.getSettings();
      expect(check.settings.organization.companyName).toBe('Segmento Protect Enterprise');
    });

    test('getOperatorProfile() should return active workstation profile defaults', async () => {
      const res = await dsarSettingsService.getOperatorProfile();
      expect(res.success).toBe(true);
      expect(res.profile).toBeDefined();
      expect(res.profile.name).toBe('John Doe');
      expect(res.profile.email).toBe('john.doe@segmento.com');
      expect(res.profile.role).toBe('Privacy Team');
      expect(res.profile.initials).toBe('JD');
      expect(res.profile.status).toBe('Active');
    });

    test('updateOperatorProfile() should update name, compute initials, and persist custom role and color', async () => {
      const updateRes = await dsarSettingsService.updateOperatorProfile({
        name: 'Manojya Sharma',
        email: 'manojya@segmento.com',
        role: 'Data Engineering',
        title: 'Lead Privacy Architect',
        color: '#8b5cf6'
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.profile.name).toBe('Manojya Sharma');
      expect(updateRes.profile.initials).toBe('MS');
      expect(updateRes.profile.email).toBe('manojya@segmento.com');
      expect(updateRes.profile.role).toBe('Data Engineering');
      expect(updateRes.profile.color).toBe('#8b5cf6');

      // Verify persistence via getOperatorProfile
      const check = await dsarSettingsService.getOperatorProfile();
      expect(check.profile.name).toBe('Manojya Sharma');
      expect(check.profile.initials).toBe('MS');

      // Reset profile back to John Doe for subsequent tests
      await dsarSettingsService.updateOperatorProfile(dsarSettingsService.DEFAULT_OPERATOR_PROFILE);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 2. EMAIL NOTIFICATION SERVICE TESTS ────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  describe('emailNotificationService', () => {

    test('DEFAULT_LEAD_EMAILS registry should contain all core department leads', () => {
      const leads = emailNotificationService.DEFAULT_LEAD_EMAILS;
      expect(leads['CRM Team'].email).toBe('john.tan@segmento.com');
      expect(leads['HR Team'].email).toBe('priya.sharma@segmento.com');
      expect(leads['Marketing Team'].email).toBe('david.lee@segmento.com');
      expect(leads['Data Engineering'].email).toBe('arun.kumar@segmento.com');
      expect(leads['Third-Party / Vendor Mgmt'].email).toBe('marcus.brody@segmento.com');
      expect(leads['Privacy / DPO'].email).toBe('anil.reddy@segmento.com');
      expect(leads['Security'].email).toBe('farhan.ali@segmento.com');
    });

    test('buildTaskEmailTemplate() should generate formatted subject, html, and text with placeholders', () => {
      const task = {
        id: 'task_1',
        team: 'CRM Team',
        assignee: 'John Tan',
        task: 'Extract CRM customer profile & purchase history',
        priority: 'High',
        due_date: 'March 25, 2026',
        instructions: ['Locate profile in Salesforce CRM', 'Export purchase records as CSV'],
        systems: 'Salesforce, HubSpot, MongoDB CRM'
      };

      const request = {
        request_id: 'DSAR-2026-000125',
        full_name: 'Sarah Jenkins',
        email: 'sarah.jenkins@example.com',
        request_type: 'Deletion'
      };

      const leadInfo = { name: 'John Tan', email: 'john.tan@segmento.com' };

      const template = emailNotificationService.buildTaskEmailTemplate(request, task, leadInfo, 'High priority customer record');
      expect(template.subject).toContain('[Action Required] Privacy Task Assigned');
      expect(template.subject).toContain('DSAR-2026-000125');
      expect(template.subject).toContain('Extract CRM customer profile & purchase history');

      expect(template.html).toContain('John Tan');
      expect(template.html).toContain('Sarah Jenkins');
      expect(template.html).toContain('CRM Team');
      expect(template.html).toContain('High priority customer record');
      expect(template.html).toContain('Salesforce, HubSpot, MongoDB CRM');

      expect(template.text).toContain('John Tan');
      expect(template.text).toContain('DSAR-2026-000125');
    });

    test('sendTaskAssignmentEmail() should send email and append communication log to request', async () => {
      const res = await emailNotificationService.sendTaskAssignmentEmail('DSAR-2026-000125', 'task_1');
      expect(res.success).toBe(true);
      expect(res.receipt).toBeDefined();
      expect(res.receipt.id).toBeDefined();
      expect(res.receipt.recipient).toBe('john.tan@segmento.com');
      expect(res.receipt.status).toBe('Delivered');

      // Verify that a communication was logged in the ticket's ledger
      const ticketRes = await dsarService.getDsarTicketDetails('DSAR-2026-000125');
      expect(ticketRes.success).toBe(true);
      const latestComm = ticketRes.communications[0];
      expect(latestComm).toBeDefined();
      expect(latestComm.recipient).toBe('john.tan@segmento.com');
      expect(latestComm.status).toBe('Delivered');
    });

    test('notifyAllAssignedTeams() should dispatch emails to all assigned team leads in parallel', async () => {
      const res = await emailNotificationService.notifyAllAssignedTeams('DSAR-2026-000125', 'Automated Privacy Engine');
      expect(res.success).toBe(true);
      expect(res.count).toBe(6);
      expect(Array.isArray(res.dispatched)).toBe(true);
      expect(res.dispatched.length).toBe(6);

      const recipientEmails = res.dispatched.map(d => d.recipient);
      expect(recipientEmails).toContain('john.tan@segmento.com');
      expect(recipientEmails).toContain('priya.sharma@segmento.com');
      expect(recipientEmails).toContain('david.lee@segmento.com');
      expect(recipientEmails).toContain('arun.kumar@segmento.com');
      expect(recipientEmails).toContain('marcus.brody@segmento.com');
      expect(recipientEmails).toContain('anil.reddy@segmento.com');
    });

    test('sendTestEmail() should simulate SMTP live validation and log dispatch', async () => {
      const res = await emailNotificationService.sendTestEmail('test-admin@segmento.com', 'Live SMTP Ping');
      expect(res.success).toBe(true);
      expect(res.receipt.recipient).toBe('test-admin@segmento.com');
      expect(res.receipt.status).toBe('Delivered');
      expect(res.receipt.id).toBeDefined();
    });

    test('sendViaResendApi() and sendTestEmail() with Resend Cloud API configuration', async () => {
      // Test direct Resend method with test mock key
      const directRes = await emailNotificationService.sendViaResendApi({
        apiKey: 're_test_mock_key',
        from: 'Segmento Protect <onboarding@resend.dev>',
        to: 'user@example.com',
        subject: 'Resend API Cloud Test',
        html: '<p>Test</p>',
        text: 'Test'
      });
      expect(directRes.success).toBe(true);
      expect(directRes.messageId).toContain('resend_mock');

      // Test sendTestEmail with Resend config override
      const testRes = await emailNotificationService.sendTestEmail('user@example.com', 'Resend Validation', {
        resendApiKey: 're_test_mock_key',
        provider: 'resend'
      });
      expect(testRes.success).toBe(true);
      expect(testRes.receipt.channel).toContain('Resend Cloud');
      expect(testRes.receipt.recipient).toBe('user@example.com');
    });

    test('sendViaResendApi() should reject empty API key', async () => {
      await expect(emailNotificationService.sendViaResendApi({
        apiKey: '',
        from: 'onboarding@resend.dev',
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      })).rejects.toThrow('Resend API Key is required');
    });

    test('getEmailDispatchHistory() should retrieve dispatch log with filtering', async () => {
      await emailNotificationService.sendTestEmail('audit@segmento.com', 'Audit Test');
      const history = await emailNotificationService.getEmailDispatchHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].recipient).toBe('audit@segmento.com');
    });

    test('sendTaskAssignmentEmail() should gracefully handle invalid task ID', async () => {
      const res = await emailNotificationService.sendTaskAssignmentEmail('DSAR-2026-000125', 'invalid_task_999');
      expect(res.success).toBe(false);
      expect(res.notFound).toBe(true);
    });

    test('sendTaskAssignmentEmail() should gracefully handle invalid request ID', async () => {
      const res = await emailNotificationService.sendTaskAssignmentEmail('NON-EXISTENT-DSAR', 'task_1');
      expect(res.success).toBe(false);
      expect(res.notFound).toBe(true);
    });
  });

});
