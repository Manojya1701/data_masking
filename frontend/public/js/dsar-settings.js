'use strict';

/**
 * DSAR Platform Settings & Preferences Controller
 * Manages:
 * - 4 Settings Hub Tabs (Email & SMTP, Compliance & SLAs, Security & Crypto, Organization Profile)
 * - Real live SMTP authentication settings & quick presets (Gmail, Outlook, Ethereal)
 * - Live settings saving with instant backend persistence
 * - Real live test email dispatch tester with Web Inbox preview links
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
    const sUser = document.getElementById('setting-email-smtp-user');
    const sPass = document.getElementById('setting-email-smtp-pass');
    const sSecure = document.getElementById('setting-email-smtp-secure');
    const sAutoTask = document.getElementById('setting-email-auto-task');
    const sAutoApprove = document.getElementById('setting-email-auto-approve');
    const sWebhook = document.getElementById('setting-email-webhook-url');

    if (sName) sName.value = settings.email.senderName || '';
    if (sEmail) sEmail.value = settings.email.senderEmail || '';
    if (sHost) sHost.value = settings.email.smtpHost || '';
    if (sPort) sPort.value = settings.email.smtpPort || 587;
    if (sUser) sUser.value = settings.email.smtpUser || '';
    if (sPass) sPass.value = settings.email.smtpPass || '';
    if (sSecure) sSecure.checked = Boolean(settings.email.smtpSecure);
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
 * Switch Settings Tab
 */
export function switchSettingsTab(tabKey) {
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
 * Apply SMTP Quick Preset
 */
function applySmtpPreset(preset) {
  const sHost = document.getElementById('setting-email-smtp-host');
  const sPort = document.getElementById('setting-email-smtp-port');
  const sUser = document.getElementById('setting-email-smtp-user');
  const sPass = document.getElementById('setting-email-smtp-pass');
  const sSecure = document.getElementById('setting-email-smtp-secure');

  if (preset === 'ethereal') {
    if (sHost) sHost.value = 'smtp.ethereal.email';
    if (sPort) sPort.value = 587;
    if (sUser) sUser.value = '';
    if (sPass) sPass.value = '';
    if (sSecure) sSecure.checked = false;
    showToast('⚡ Applied Ethereal Free Live Test Inbox Preset', 'info');
  } else if (preset === 'gmail') {
    if (sHost) sHost.value = 'smtp.gmail.com';
    if (sPort) sPort.value = 587;
    if (sSecure) sSecure.checked = false;
    showToast('Applied Gmail SMTP Preset (Use App Password)', 'info');
  } else if (preset === 'outlook') {
    if (sHost) sHost.value = 'smtp-mail.outlook.com';
    if (sPort) sPort.value = 587;
    if (sSecure) sSecure.checked = false;
    showToast('Applied Outlook SMTP Preset', 'info');
  }
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
      smtpUser: document.getElementById('setting-email-smtp-user')?.value?.trim(),
      smtpPass: document.getElementById('setting-email-smtp-pass')?.value?.trim(),
      smtpSecure: Boolean(document.getElementById('setting-email-smtp-secure')?.checked),
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
 * Trigger real test email and display live web inbox URL
 */
async function handleSendTestEmail() {
  const targetEmail = document.getElementById('setting-email-test-address')?.value?.trim() || document.getElementById('setting-email-sender-address')?.value?.trim() || 'operator@segmento.com';

  const testBtn = document.getElementById('btn-send-test-email');
  const previewBox = document.getElementById('test-email-preview-link-wrap');
  const previewLink = document.getElementById('test-email-preview-link');

  try {
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML = '<span>⏳ Sending Real Email…</span>';
    }
    showToast(`Sending real email notification to ${targetEmail}…`, 'info');

    const res = await fetch(`${window.location.origin}/api/dsar/settings/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, testType: 'Live SMTP System Validation' })
    });
    const data = await res.json();

    if (data && data.success) {
      showToast(`✓ Email successfully delivered to ${targetEmail}!`, 'success');

      // Check if real preview URL exists
      const pUrl = data.previewUrl || (data.receipt && data.receipt.previewUrl);
      if (pUrl && previewBox && previewLink) {
        previewLink.href = pUrl;
        previewBox.classList.remove('hidden');
        previewBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      showToast(data.message || 'Failed to dispatch test email', 'error');
    }
  } catch (err) {
    showToast(`Error sending test email: ${err.message}`, 'error');
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.innerHTML = '<span>⚡ Send Real Test Email</span>';
    }
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

  // Preset buttons
  document.querySelectorAll('.btn-smtp-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset) applySmtpPreset(preset);
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
