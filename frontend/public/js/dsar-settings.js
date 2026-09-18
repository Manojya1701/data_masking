'use strict';

/**
 * DSAR Platform Settings & Preferences Controller
 * Handles:
 * - Tab switching across Settings categories
 * - Form data hydration from backend /api/dsar/settings
 * - Category-level settings patch updates
 * - Live SMTP test email execution & real web inbox link viewing
 * - System defaults reset
 */

import { showToast } from './toast.js';

let activeSettingsTab = 'email';
let cachedSettings = null;

/**
 * Fetch settings from server and hydrate form controls
 */
export async function loadPlatformSettings() {
  try {
    const res = await fetch(`${window.location.origin}/api/dsar/settings`);
    const data = await res.json();
    if (!data || !data.success || !data.settings) return;

    cachedSettings = data.settings;
    hydrateSettingsForms(data.settings);
  } catch (err) {
    console.warn('[Settings] Failed to fetch settings:', err.message);
  }
}

/**
 * Hydrate all input fields from loaded settings JSON
 */
function hydrateSettingsForms(settings) {
  if (!settings) return;

  // 1. Email Tab
  if (settings.email) {
    const e = settings.email;
    const sName = document.getElementById('setting-email-sender-name');
    const sAddr = document.getElementById('setting-email-sender-address');
    const sHost = document.getElementById('setting-email-smtp-host');
    const sPort = document.getElementById('setting-email-smtp-port');
    const sUser = document.getElementById('setting-email-smtp-user');
    const sPass = document.getElementById('setting-email-smtp-pass');
    const sSecure = document.getElementById('setting-email-smtp-secure');
    const sAutoTask = document.getElementById('setting-email-auto-task');
    const sAutoApprove = document.getElementById('setting-email-auto-approve');
    const sWebhook = document.getElementById('setting-email-webhook-url');
    const sTestAddr = document.getElementById('setting-email-test-address');

    if (sName && e.senderName) sName.value = e.senderName;
    if (sAddr && e.senderEmail) sAddr.value = e.senderEmail;
    if (sHost && e.smtpHost) sHost.value = e.smtpHost;
    if (sPort && e.smtpPort) sPort.value = e.smtpPort;
    if (sUser && e.smtpUser) sUser.value = e.smtpUser;
    if (sPass && e.smtpPass) sPass.value = e.smtpPass;
    if (sSecure && typeof e.smtpSecure === 'boolean') sSecure.checked = e.smtpSecure;
    if (sAutoTask && typeof e.autoNotifyOnAssignment === 'boolean') sAutoTask.checked = e.autoNotifyOnAssignment;
    if (sAutoApprove && typeof e.autoNotifyOnApproval === 'boolean') sAutoApprove.checked = e.autoNotifyOnApproval;
    if (sWebhook && e.webhookUrl) sWebhook.value = e.webhookUrl;
    if (sTestAddr && e.senderEmail) sTestAddr.value = e.senderEmail;
  }

  // 2. Statutory Tab
  if (settings.statutory) {
    const st = settings.statutory;
    const sSla = document.getElementById('setting-statutory-default-sla');
    const sBuffer = document.getElementById('setting-statutory-grace-buffer');
    const sEsc = document.getElementById('setting-statutory-esc-threshold');
    const sGst = document.getElementById('setting-statutory-gst-lock');
    const sRbi = document.getElementById('setting-statutory-rbi-lock');

    if (sSla && st.defaultSlaDays) sSla.value = st.defaultSlaDays;
    if (sBuffer && st.graceBufferDays) sBuffer.value = st.graceBufferDays;
    if (sEsc && st.escalationAlertThresholdPct) sEsc.value = st.escalationAlertThresholdPct;
    if (sGst && typeof st.enforceGstTaxLock === 'boolean') sGst.checked = st.enforceGstTaxLock;
    if (sRbi && typeof st.enforceRbiKycLock === 'boolean') sRbi.checked = st.enforceRbiKycLock;
  }

  // 3. Security Tab
  if (settings.security) {
    const sec = settings.security;
    const sSha = document.getElementById('setting-sec-sha-seals');
    const sDpo = document.getElementById('setting-sec-dpo-sig');
    const sCert = document.getElementById('setting-sec-cert-id');
    const sRet = document.getElementById('setting-sec-ret-years');

    if (sSha && typeof sec.enableSha256LedgerSeals === 'boolean') sSha.checked = sec.enableSha256LedgerSeals;
    if (sDpo && typeof sec.requireDpoDigitalSignature === 'boolean') sDpo.checked = sec.requireDpoDigitalSignature;
    if (sCert && sec.dpoCertificateId) sCert.value = sec.dpoCertificateId;
    if (sRet && sec.auditRetentionYears) sRet.value = sec.auditRetentionYears;
  }

  // 4. Organization Tab
  if (settings.organization) {
    const org = settings.organization;
    const sComp = document.getElementById('setting-org-company-name');
    const sDpoN = document.getElementById('setting-org-dpo-name');
    const sDpoE = document.getElementById('setting-org-dpo-email');
    const sLeg = document.getElementById('setting-org-legal-lead');
    const sSup = document.getElementById('setting-org-support-email');

    if (sComp && org.companyName) sComp.value = org.companyName;
    if (sDpoN && org.dpoName) sDpoN.value = org.dpoName;
    if (sDpoE && org.dpoEmail) sDpoE.value = org.dpoEmail;
    if (sLeg && org.legalLead) sLeg.value = org.legalLead;
    if (sSup && org.supportEmail) sSup.value = org.supportEmail;
  }
}

/**
 * Open Settings Modal
 */
export function openSettingsModal(tabKey = 'email') {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  loadPlatformSettings();
  switchSettingsTab(tabKey);
  modal.classList.remove('hidden');
}

/**
 * Close Settings Modal
 */
export function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Switch Settings Navigation Tab
 */
export function switchSettingsTab(tabKey) {
  activeSettingsTab = tabKey;

  // Update tab buttons
  const tabBtns = document.querySelectorAll('.settings-nav-btn');
  tabBtns.forEach(btn => {
    if (btn.dataset.tab === tabKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update panels
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
    showToast('⚡ Free Test Inbox Mode: Emails will generate instant viewable browser links!', 'info');
  } else if (preset === 'gmail') {
    if (sHost) sHost.value = 'smtp.gmail.com';
    if (sPort) sPort.value = 465;
    if (sSecure) sSecure.checked = true;
    if (sUser && !sUser.value) sUser.focus();
    showToast('Gmail preset applied: Enter your Gmail & 16-character App Password.', 'info');
  } else if (preset === 'outlook') {
    if (sHost) sHost.value = 'smtp-mail.outlook.com';
    if (sPort) sPort.value = 587;
    if (sSecure) sSecure.checked = false;
    showToast('Outlook preset applied: Enter your Outlook email & password.', 'info');
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

  // Grab live form values so test email reflects current inputs immediately
  const smtpConfig = {
    senderName: document.getElementById('setting-email-sender-name')?.value?.trim(),
    senderEmail: document.getElementById('setting-email-sender-address')?.value?.trim(),
    smtpHost: document.getElementById('setting-email-smtp-host')?.value?.trim(),
    smtpPort: parseInt(document.getElementById('setting-email-smtp-port')?.value, 10) || 587,
    smtpUser: document.getElementById('setting-email-smtp-user')?.value?.trim(),
    smtpPass: document.getElementById('setting-email-smtp-pass')?.value?.trim(),
    smtpSecure: Boolean(document.getElementById('setting-email-smtp-secure')?.checked)
  };

  try {
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML = '<span>⏳ Dispatching Email…</span>';
    }
    showToast(`Dispatching live email notification to ${targetEmail}…`, 'info');

    const res = await fetch(`${window.location.origin}/api/dsar/settings/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, testType: 'Live SMTP System Validation', smtpConfig })
    });
    const data = await res.json();

    if (data && data.success) {
      const pUrl = data.previewUrl || (data.receipt && data.receipt.previewUrl);
      if (pUrl && previewBox && previewLink) {
        previewLink.href = pUrl;
        previewBox.classList.remove('hidden');
        previewBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('✓ Dispatched! Click [Open Sent Email in Web Inbox] to view.', 'success');
      } else {
        showToast(`✓ Live email successfully dispatched to ${targetEmail}!`, 'success');
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
  // Navigation tabs
  const tabBtns = document.querySelectorAll('.settings-nav-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) switchSettingsTab(tab);
    });
  });

  // SMTP Presets
  const presetBtns = document.querySelectorAll('.btn-smtp-preset');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset) applySmtpPreset(preset);
    });
  });

  // Save Settings Button
  const saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveActiveSettingsCategory);
  }

  // Reset Settings Button
  const resetBtn = document.getElementById('btn-reset-settings');
  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetSettings);
  }

  // Send Test Email Button
  const testEmailBtn = document.getElementById('btn-send-test-email');
  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', handleSendTestEmail);
  }

  // Close modal buttons
  const closeBtn = document.getElementById('btn-close-settings-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeSettingsModal);

  const backdrop = document.getElementById('settings-modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeSettingsModal);

  // Settings trigger button in header
  const openBtn = document.getElementById('btn-open-settings');
  if (openBtn) {
    openBtn.addEventListener('click', () => openSettingsModal('email'));
  }
}
