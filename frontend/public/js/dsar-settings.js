'use strict';

/**
 * DSAR Platform Settings & Preferences Controller
 * Manages:
 * - 4 Settings Hub Tabs (Email & SMTP, Compliance & SLAs, Security & Crypto, Organization Profile)
 * - Live settings saving with instant backend persistence
 * - Live test email dispatch tester
 * - Canonical defaults reset
 */

let currentSettings = null;
let activeSettingsTab = 'email';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info') {
  if (window.showToastMessage) {
    window.showToastMessage(msg, type);
  } else {
    console.log(`[Toast ${type}] ${msg}`);
  }
}

/**
 * Fetch and Populate Platform Settings
 */
export async function loadPlatformSettings() {
  try {
    const res = await fetch(`${window.location.origin}/api/dsar/settings`);
    const data = await res.json();

    if (data && data.success && data.settings) {
      currentSettings = data.settings;
      populateSettingsForms(currentSettings);
    }
  } catch (err) {
    console.error('Error fetching platform settings:', err);
    showToast(`Failed to load settings: ${err.message}`, 'error');
  }
}

/**
 * Fill input fields with loaded settings
 */
function populateSettingsForms(settings) {
  if (!settings) return;

  // 1. Email & SMTP
  if (settings.email) {
    const sName = document.getElementById('setting-email-sender-name');
    const sEmail = document.getElementById('setting-email-sender-address');
    const sHost = document.getElementById('setting-email-smtp-host');
    const sPort = document.getElementById('setting-email-smtp-port');
    const sAutoTask = document.getElementById('setting-email-auto-task');
    const sAutoApprove = document.getElementById('setting-email-auto-approve');
    const sWebhook = document.getElementById('setting-email-webhook-url');

    if (sName) sName.value = settings.email.senderName || '';
    if (sEmail) sEmail.value = settings.email.senderEmail || '';
    if (sHost) sHost.value = settings.email.smtpHost || '';
    if (sPort) sPort.value = settings.email.smtpPort || 587;
    if (sAutoTask) sAutoTask.checked = Boolean(settings.email.autoNotifyOnAssignment);
    if (sAutoApprove) sAutoApprove.checked = Boolean(settings.email.autoNotifyOnApproval);
    if (sWebhook) sWebhook.value = settings.email.webhookUrl || '';
  }

  // 2. Compliance & Statutory SLAs
  if (settings.statutory) {
    const sSla = document.getElementById('setting-statutory-default-sla');
    const sGrace = document.getElementById('setting-statutory-grace-buffer');
    const sEsc = document.getElementById('setting-statutory-esc-threshold');
    const sGst = document.getElementById('setting-statutory-gst-lock');
    const sRbi = document.getElementById('setting-statutory-rbi-lock');

    if (sSla) sSla.value = settings.statutory.defaultSlaDays || 30;
    if (sGrace) sGrace.value = settings.statutory.graceBufferDays || 5;
    if (sEsc) sEsc.value = settings.statutory.escalationAlertThresholdPct || 80;
    if (sGst) sGst.checked = Boolean(settings.statutory.enforceGstTaxLock);
    if (sRbi) sRbi.checked = Boolean(settings.statutory.enforceRbiKycLock);
  }

  // 3. Security & Cryptographic Seals
  if (settings.security) {
    const sSha = document.getElementById('setting-sec-sha-seals');
    const sDpoSig = document.getElementById('setting-sec-dpo-sig');
    const sCertId = document.getElementById('setting-sec-cert-id');
    const sRetYears = document.getElementById('setting-sec-ret-years');

    if (sSha) sSha.checked = Boolean(settings.security.enableSha256LedgerSeals);
    if (sDpoSig) sDpoSig.checked = Boolean(settings.security.requireDpoDigitalSignature);
    if (sCertId) sCertId.value = settings.security.dpoCertificateId || '';
    if (sRetYears) sRetYears.value = settings.security.auditRetentionYears || 7;
  }

  // 4. Organization Profile
  if (settings.organization) {
    const sOrg = document.getElementById('setting-org-company-name');
    const sDpo = document.getElementById('setting-org-dpo-name');
    const sDpoEmail = document.getElementById('setting-org-dpo-email');
    const sLegal = document.getElementById('setting-org-legal-lead');
    const sSupport = document.getElementById('setting-org-support-email');

    if (sOrg) sOrg.value = settings.organization.companyName || '';
    if (sDpo) sDpo.value = settings.organization.dpoName || '';
    if (sDpoEmail) sDpoEmail.value = settings.organization.dpoEmail || '';
    if (sLegal) sLegal.value = settings.organization.legalLead || '';
    if (sSupport) sSupport.value = settings.organization.supportEmail || '';
  }
}

/**
 * Switch settings tab
 */
function switchSettingsTab(tabKey) {
  activeSettingsTab = tabKey;

  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const panels = {
    email: document.getElementById('settings-panel-email'),
    statutory: document.getElementById('settings-panel-statutory'),
    security: document.getElementById('settings-panel-security'),
    organization: document.getElementById('settings-panel-organization')
  };

  Object.entries(panels).forEach(([key, el]) => {
    if (el) {
      if (key === tabKey) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
}

/**
 * Save active settings category
 */
async function saveActiveSettingsCategory() {
  let category = activeSettingsTab;
  let payload = {};

  if (category === 'email') {
    payload = {
      senderName: document.getElementById('setting-email-sender-name')?.value?.trim(),
      senderEmail: document.getElementById('setting-email-sender-address')?.value?.trim(),
      smtpHost: document.getElementById('setting-email-smtp-host')?.value?.trim(),
      smtpPort: parseInt(document.getElementById('setting-email-smtp-port')?.value, 10) || 587,
      autoNotifyOnAssignment: Boolean(document.getElementById('setting-email-auto-task')?.checked),
      autoNotifyOnApproval: Boolean(document.getElementById('setting-email-auto-approve')?.checked),
      webhookUrl: document.getElementById('setting-email-webhook-url')?.value?.trim()
    };
  } else if (category === 'statutory') {
    payload = {
      defaultSlaDays: parseInt(document.getElementById('setting-statutory-default-sla')?.value, 10) || 30,
      graceBufferDays: parseInt(document.getElementById('setting-statutory-grace-buffer')?.value, 10) || 5,
      escalationAlertThresholdPct: parseInt(document.getElementById('setting-statutory-esc-threshold')?.value, 10) || 80,
      enforceGstTaxLock: Boolean(document.getElementById('setting-statutory-gst-lock')?.checked),
      enforceRbiKycLock: Boolean(document.getElementById('setting-statutory-rbi-lock')?.checked)
    };
  } else if (category === 'security') {
    payload = {
      enableSha256LedgerSeals: Boolean(document.getElementById('setting-sec-sha-seals')?.checked),
      requireDpoDigitalSignature: Boolean(document.getElementById('setting-sec-dpo-sig')?.checked),
      dpoCertificateId: document.getElementById('setting-sec-cert-id')?.value?.trim(),
      auditRetentionYears: parseInt(document.getElementById('setting-sec-ret-years')?.value, 10) || 7
    };
  } else if (category === 'organization') {
    payload = {
      companyName: document.getElementById('setting-org-company-name')?.value?.trim(),
      dpoName: document.getElementById('setting-org-dpo-name')?.value?.trim(),
      dpoEmail: document.getElementById('setting-org-dpo-email')?.value?.trim(),
      legalLead: document.getElementById('setting-org-legal-lead')?.value?.trim(),
      supportEmail: document.getElementById('setting-org-support-email')?.value?.trim()
    };
  }

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/settings/${encodeURIComponent(category)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data && data.success) {
      showToast(`✓ ${category.charAt(0).toUpperCase() + category.slice(1)} settings saved successfully!`, 'success');
      await loadPlatformSettings();
    } else {
      showToast(data.message || 'Failed to update settings', 'error');
    }
  } catch (err) {
    showToast(`Error saving settings: ${err.message}`, 'error');
  }
}

/**
 * Trigger simulated test email
 */
async function handleSendTestEmail() {
  const targetEmail = document.getElementById('setting-email-test-address')?.value?.trim() || document.getElementById('setting-email-sender-address')?.value?.trim() || 'operator@segmento.com';

  try {
    showToast(`Sending test notification to ${targetEmail}…`, 'info');
    const res = await fetch(`${window.location.origin}/api/dsar/settings/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, testType: 'SMTP Live Validation' })
    });
    const data = await res.json();

    if (data && data.success) {
      showToast(`✓ Test email delivered to ${targetEmail}!`, 'success');
    } else {
      showToast(data.message || 'Failed to dispatch test email', 'error');
    }
  } catch (err) {
    showToast(`Error sending test email: ${err.message}`, 'error');
  }
}

/**
 * Handle Reset Settings
 */
async function handleResetSettings() {
  try {
    showToast('Resetting platform settings to default…', 'info');
    const res = await fetch(`${window.location.origin}/api/dsar/settings/reset`, { method: 'POST' });
    const data = await res.json();

    if (data && data.success) {
      showToast('✓ Platform settings restored to defaults', 'success');
      await loadPlatformSettings();
    } else {
      showToast(data.message || 'Failed to reset settings', 'error');
    }
  } catch (err) {
    showToast(`Error resetting settings: ${err.message}`, 'error');
  }
}

/**
 * Initialize Settings Hub Controller
 */
export function initDsarSettings() {
  // Tab switching
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchSettingsTab(tab);
    });
  });

  // Save Settings button
  const saveBtn = document.getElementById('btn-save-platform-settings');
  if (saveBtn) saveBtn.addEventListener('click', saveActiveSettingsCategory);

  // Test Email button
  const testEmailBtn = document.getElementById('btn-send-test-email');
  if (testEmailBtn) testEmailBtn.addEventListener('click', handleSendTestEmail);

  // Reset Settings button
  const resetBtn = document.getElementById('btn-reset-platform-settings');
  if (resetBtn) resetBtn.addEventListener('click', handleResetSettings);

  // Global methods
  window.loadPlatformSettings = loadPlatformSettings;
  window.switchSettingsTab = switchSettingsTab;

  // Initial load
  loadPlatformSettings();
}
