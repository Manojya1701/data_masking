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
    smtpHost: process.env.SMTP_HOST || 'smtp.segmento-protect.internal',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
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

const DEFAULT_OPERATOR_PROFILE = {
  name: 'John Doe',
  email: 'john.doe@segmento.com',
  role: 'Privacy Team',
  title: 'Senior Privacy Operations Specialist',
  initials: 'JD',
  color: '#06b6d4',
  status: 'Active'
};

let activeOperatorProfile = JSON.parse(JSON.stringify(DEFAULT_OPERATOR_PROFILE));

/**
 * Fetch current operator profile
 */
async function getOperatorProfile() {
  return {
    success: true,
    profile: JSON.parse(JSON.stringify(activeOperatorProfile))
  };
}

/**
 * Update operator profile (name, email, role, title, color, status)
 */
async function updateOperatorProfile(updates = {}) {
  if (typeof updates !== 'object' || updates === null) {
    return { success: false, message: 'Profile updates must be an object.' };
  }

  if (updates.name && typeof updates.name === 'string') {
    activeOperatorProfile.name = updates.name.trim();
    const parts = activeOperatorProfile.name.split(/\s+/).filter(Boolean);
    activeOperatorProfile.initials = parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'OP');
  }

  if (updates.email && typeof updates.email === 'string') {
    activeOperatorProfile.email = updates.email.trim();
  }

  if (updates.role && typeof updates.role === 'string') {
    activeOperatorProfile.role = updates.role.trim();
  }

  if (updates.title && typeof updates.title === 'string') {
    activeOperatorProfile.title = updates.title.trim();
  }

  if (updates.color && typeof updates.color === 'string') {
    activeOperatorProfile.color = updates.color.trim();
  }

  if (updates.status && typeof updates.status === 'string') {
    activeOperatorProfile.status = updates.status.trim();
  }

  return {
    success: true,
    message: 'Operator profile updated successfully',
    profile: JSON.parse(JSON.stringify(activeOperatorProfile))
  };
}

module.exports = {
  getSettings,
  getCategorySettings,
  updateSettings,
  resetSettings,
  getOperatorProfile,
  updateOperatorProfile,
  DEFAULT_SETTINGS,
  DEFAULT_OPERATOR_PROFILE
};
