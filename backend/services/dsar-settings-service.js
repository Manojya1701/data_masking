'use strict';

/**
 * DSAR Platform Settings & Preferences Service
 * Manages:
 * - Email / SMTP Notification configurations
 * - Compliance & Statutory SLA grace periods & escalation rules
 * - Security & Cryptographic ledger seals (ISO/IEC 27701)
 * - Enterprise Organization Profile & DPO metadata
 */

const DEFAULT_SETTINGS = {
  email: {
    senderName: 'Segmento Protect Privacy Office',
    senderEmail: 'privacy-notifications@segmento.com',
    smtpHost: 'smtp.segmento-protect.internal',
    smtpPort: 587,
    useTls: true,
    autoNotifyOnAssignment: true,
    autoNotifyOnApproval: true,
    notifyRequesterOnComplete: true,
    webhookUrl: 'https://api.segmento.internal/webhooks/dsar-events'
  },
  statutory: {
    defaultSlaDays: 30,
    graceBufferDays: 5,
    escalationAlertThresholdPct: 80,
    enforceGstTaxLock: true,
    enforceRbiKycLock: true,
    allowPartialRedaction: true,
    primaryJurisdiction: 'India (DPDP Act 2023)'
  },
  security: {
    enableSha256LedgerSeals: true,
    requireDpoDigitalSignature: true,
    requireTwoFactorApproval: false,
    dpoCertificateId: 'CERT-DPO-SG-2026-9941',
    auditRetentionYears: 7,
    iso27701Certified: true
  },
  organization: {
    companyName: 'Segmento Protect Enterprise',
    dpoName: 'Anil Reddy (Chief Data Protection Officer)',
    dpoEmail: 'dpo@segmento.com',
    legalLead: 'Vikram Malhotra (Lead Legal Counsel)',
    supportEmail: 'privacy@segmento.com',
    websiteUrl: 'https://segmento.com'
  }
};

let platformSettingsStore = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

/**
 * Fetch complete platform settings
 */
async function getSettings() {
  return {
    success: true,
    settings: JSON.parse(JSON.stringify(platformSettingsStore)),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update specific settings category (email, statutory, security, organization)
 */
async function updateSettings(category, updates = {}) {
  const validCategories = ['email', 'statutory', 'security', 'organization'];
  if (!validCategories.includes(category)) {
    return { success: false, notFound: true, message: `Invalid settings category '${category}'. Valid: ${validCategories.join(', ')}` };
  }

  if (typeof updates !== 'object' || updates === null) {
    return { success: false, message: 'Settings updates must be an object.' };
  }

  // Merge updates into category
  platformSettingsStore[category] = {
    ...platformSettingsStore[category],
    ...updates
  };

  return {
    success: true,
    message: `Settings for '${category}' updated successfully`,
    category,
    settings: JSON.parse(JSON.stringify(platformSettingsStore[category]))
  };
}

/**
 * Reset all settings to canonical defaults
 */
async function resetSettings() {
  platformSettingsStore = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  return {
    success: true,
    message: 'Platform settings successfully reset to defaults',
    settings: JSON.parse(JSON.stringify(platformSettingsStore))
  };
}

/**
 * Fetch settings for a specific category
 */
async function getCategorySettings(category) {
  const validCategories = ['email', 'statutory', 'security', 'organization'];
  if (!validCategories.includes(category)) {
    return { success: false, notFound: true, message: `Invalid settings category '${category}'` };
  }
  return {
    success: true,
    category,
    settings: JSON.parse(JSON.stringify(platformSettingsStore[category]))
  };
}

module.exports = {
  getSettings,
  getCategorySettings,
  updateSettings,
  resetSettings,
  DEFAULT_SETTINGS
};
