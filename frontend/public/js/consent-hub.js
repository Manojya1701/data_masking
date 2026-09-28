'use strict';

/**
 * Consent Hub & Self-Serve Withdrawal Controller (Day 2)
 * Manages granular consent lifecycle (GDPR Art. 7(3), DPDP Act 2023 Sec. 6(4), PDPA Sec. 16):
 * - Live subject status scan & matrix rendering
 * - Granular category withdrawal execution (Marketing, AI Training, Telemetry, Third-Party, Biometrics)
 * - Cryptographic SHA-256 Proof of Withdrawal Receipt & Suppression Token generation
 * - Downstream system synchronization status
 * - Re-granting consent (Opt-In) & immutable audit ledger
 */

import { showToast } from './toast.js';

let activeSubjectStatus = null;
let selectedCategoriesToWithdraw = new Set();

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Fetch and render consent status for a specific subject identifier
 */
export async function loadSubjectConsentStatus(identifier) {
  if (!identifier) {
    identifier = (document.getElementById('consent-lookup-identifier')?.value || 'alex.johnson@example.com').trim();
  }

  const container = document.getElementById('consent-matrix-container');
  const summaryEl = document.getElementById('consent-summary-badge');
  const scanBtn = document.getElementById('btn-scan-consent-status');

  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span>Scanning Ledger...</span>';
  }

  try {
    const res = await fetch(`${window.location.origin}/api/v1/consent/status/${encodeURIComponent(identifier)}`);
    const data = await res.json();

    if (data && data.success && data.data) {
      activeSubjectStatus = data.data;
      renderConsentMatrix(data.data);
      renderConsentHistory(data.data.history || []);
      showToast(`✓ Loaded consent records for ${identifier}`, 'success');
    } else {
      showToast(data.error || 'Failed to load consent data.', 'error');
    }
  } catch (err) {
    showToast(`Network error scanning consent ledger: ${err.message}`, 'error');
  } finally {
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<span>🔍 Scan Consent Status</span>';
    }
  }
}

/**
 * Render granular 5-category consent matrix
 */
export function renderConsentMatrix(statusData) {
  const container = document.getElementById('consent-matrix-cards');
  const subjectNameEl = document.getElementById('consent-active-subject-name');
  const accountStatusEl = document.getElementById('consent-active-account-status');
  const grantedCountEl = document.getElementById('consent-stat-granted');
  const withdrawnCountEl = document.getElementById('consent-stat-withdrawn');
  const overallPillEl = document.getElementById('consent-overall-status-pill');

  if (!container || !statusData) return;

  if (subjectNameEl) subjectNameEl.textContent = `${statusData.subjectName || statusData.identifier} (${statusData.identifier})`;
  if (accountStatusEl) {
    accountStatusEl.textContent = `Account: ${statusData.accountStatus || 'ACTIVE'} (Retained)`;
    accountStatusEl.style.color = '#10b981';
  }

  if (grantedCountEl) grantedCountEl.textContent = statusData.summary?.grantedCount ?? 0;
  if (withdrawnCountEl) withdrawnCountEl.textContent = statusData.summary?.withdrawnCount ?? 0;

  if (overallPillEl) {
    const status = statusData.summary?.overallStatus;
    if (status === 'ALL_GRANTED') {
      overallPillEl.textContent = 'All Consents Active';
      overallPillEl.className = 'meta-pill success';
      overallPillEl.style.color = '#10b981';
    } else if (status === 'ALL_WITHDRAWN') {
      overallPillEl.textContent = 'All Consents Withdrawn';
      overallPillEl.className = 'meta-pill error';
      overallPillEl.style.color = '#ef4444';
    } else {
      overallPillEl.textContent = 'Partially Withdrawn';
      overallPillEl.className = 'meta-pill warning';
      overallPillEl.style.color = '#f59e0b';
    }
  }

  // Clear selections
  selectedCategoriesToWithdraw.clear();

  const categories = Object.values(statusData.categories || {});
  container.innerHTML = categories.map(cat => {
    const isGranted = cat.state === 'GRANTED';
    const isWithdrawn = cat.state === 'WITHDRAWN';
    const stateBadgeClass = isGranted ? 'background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3);' : 'background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.3);';
    const stateLabel = isGranted ? '✓ GRANTED / ACTIVE' : '⛔ WITHDRAWN';

    const downstreamTags = (cat.downstreamSystems || []).map(sys =>
      `<span style="font-size:0.68rem; padding:2px 6px; background:var(--bg-input); border:1px solid var(--border); border-radius:4px; color:var(--text-secondary);">${escapeHtml(sys)}</span>`
    ).join(' ');

    return `
      <div class="consent-category-card" data-cat-id="${cat.id}" style="padding:16px; background:var(--bg-card); border:1px solid ${isWithdrawn ? 'rgba(239,68,68,0.3)' : 'var(--border)'}; border-radius:10px; display:flex; flex-direction:column; justify-content:space-between; gap:12px; transition:border-color 0.2s ease;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">${cat.icon || '🛡️'}</span>
              <div>
                <div style="font-size:0.88rem; font-weight:700; color:var(--text-bright);">${escapeHtml(cat.name)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${escapeHtml(cat.legalBasis)}</div>
              </div>
            </div>
            <span style="font-size:0.72rem; font-weight:800; padding:3px 8px; border-radius:6px; ${stateBadgeClass}">${stateLabel}</span>
          </div>
          
          <p style="font-size:0.76rem; color:var(--text-secondary); line-height:1.35; margin:0 0 10px 0;">${escapeHtml(cat.description)}</p>
          
          <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Downstream Processing Queues:</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px;">
            ${downstreamTags}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:10px; margin-top:4px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:0.75rem; color:var(--text-secondary); cursor:pointer;">
            <input type="checkbox" class="consent-category-select-cb" data-category="${cat.id}" ${isWithdrawn ? '' : 'checked'} style="accent-color:#2563eb;">
            <span>${isGranted ? 'Select to Withdraw' : 'Select to Re-Grant'}</span>
          </label>
          ${isWithdrawn ? `
            <button type="button" class="btn-ghost btn-sm btn-regrant-single" data-category="${cat.id}" style="font-size:0.7rem; padding:2px 8px; color:#10b981; border-color:rgba(16,185,129,0.3);">🔄 Re-Grant</button>
          ` : `
            <button type="button" class="btn-ghost btn-sm btn-withdraw-single" data-category="${cat.id}" style="font-size:0.7rem; padding:2px 8px; color:#ef4444; border-color:rgba(239,68,68,0.3);">✋ Withdraw</button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Attach individual category button handlers
  container.querySelectorAll('.btn-withdraw-single').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.category;
      executeWithdrawalAction([catId], `Single-category withdrawal for ${catId}`);
    });
  });

  container.querySelectorAll('.btn-regrant-single').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.category;
      executeGrantAction([catId], `Re-grant consent for ${catId}`);
    });
  });
}

/**
 * Execute withdrawal for specified or selected categories
 */
export async function executeWithdrawalAction(categories, reason) {
  if (!activeSubjectStatus || !activeSubjectStatus.identifier) {
    showToast('Please scan a data subject identifier first.', 'warning');
    return;
  }

  const identifier = activeSubjectStatus.identifier;
  const reasonText = reason || document.getElementById('consent-withdrawal-reason')?.value || 'Withdrawn via DSAR Portal Self-Serve Matrix';

  const withdrawBtn = document.getElementById('btn-execute-consent-withdraw');
  if (withdrawBtn) {
    withdrawBtn.disabled = true;
    withdrawBtn.innerHTML = '<span>Generating SHA-256 Proof & Syncing...</span>';
  }

  try {
    const res = await fetch(`${window.location.origin}/api/v1/consent/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier,
        categories: categories || 'ALL',
        reason: reasonText,
        requestedVia: 'DSAR_PORTAL',
        jurisdiction: activeSubjectStatus.jurisdiction || 'Singapore (PDPA)'
      })
    });

    const data = await res.json();

    if (data && data.success) {
      showToast(`✓ Consent withdrawn successfully! Statutory receipt generated.`, 'success');
      renderProofReceipt(data.receipt, data.downstreamSync);
      // Reload updated status
      loadSubjectConsentStatus(identifier);
    } else {
      showToast(data.error || 'Withdrawal failed.', 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    if (withdrawBtn) {
      withdrawBtn.disabled = false;
      withdrawBtn.innerHTML = '<span>✋ Execute Consent Withdrawal</span>';
    }
  }
}

/**
 * Execute re-grant for specified categories
 */
export async function executeGrantAction(categories, reason) {
  if (!activeSubjectStatus || !activeSubjectStatus.identifier) return;

  const identifier = activeSubjectStatus.identifier;
  try {
    const res = await fetch(`${window.location.origin}/api/v1/consent/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier,
        categories,
        reason: reason || 'Re-granted by data subject'
      })
    });

    const data = await res.json();
    if (data && data.success) {
      showToast(`✓ Re-granted consent for ${categories.join(', ')}`, 'success');
      loadSubjectConsentStatus(identifier);
    } else {
      showToast(data.error || 'Re-grant failed.', 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

/**
 * Render cryptographic proof receipt card
 */
export function renderProofReceipt(receipt, downstreamSync = []) {
  const receiptCard = document.getElementById('consent-proof-receipt-card');
  if (!receiptCard || !receipt) return;

  receiptCard.classList.remove('hidden');

  const idEl = document.getElementById('proof-receipt-id');
  const timeEl = document.getElementById('proof-receipt-time');
  const hashEl = document.getElementById('proof-receipt-sha256');
  const suppEl = document.getElementById('proof-receipt-suppression');
  const basisEl = document.getElementById('proof-receipt-basis');
  const syncListEl = document.getElementById('proof-receipt-downstream-list');

  if (idEl) idEl.textContent = receipt.receiptId;
  if (timeEl) timeEl.textContent = new Date(receipt.timestamp).toLocaleString();
  if (hashEl) hashEl.textContent = receipt.sha256Proof;
  if (suppEl) suppEl.textContent = receipt.suppressionToken;
  if (basisEl) basisEl.textContent = receipt.legalBasis || 'GDPR Art. 7(3) / DPDP Act 2023 Sec. 6(4)';

  if (syncListEl) {
    syncListEl.innerHTML = downstreamSync.map(item => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:var(--bg-input); border:1px solid var(--border); border-radius:6px; font-size:0.75rem;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="color:#10b981;">✓</span>
          <span style="font-weight:700; color:var(--text-bright);">${escapeHtml(item.system)}</span>
          <span style="font-size:0.68rem; color:var(--text-muted);">(${escapeHtml(item.category)})</span>
        </div>
        <span style="font-size:0.68rem; font-weight:700; color:#10b981; background:rgba(16,185,129,0.1); padding:2px 6px; border-radius:4px;">${escapeHtml(item.action)}</span>
      </div>
    `).join('');
  }

  receiptCard.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Render historical consent ledger timeline
 */
export function renderConsentHistory(history = []) {
  const historyTbody = document.getElementById('consent-history-tbody');
  if (!historyTbody) return;

  if (history.length === 0) {
    historyTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-muted); font-size:0.8rem;">No previous consent withdrawal events recorded.</td></tr>`;
    return;
  }

  historyTbody.innerHTML = history.map(item => {
    const isWithdrawal = item.action === 'WITHDRAWAL';
    const actionBadge = isWithdrawal
      ? `<span style="padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700; background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.3);">WITHDRAWAL</span>`
      : `<span style="padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700; background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3);">${escapeHtml(item.action)}</span>`;

    const categoriesStr = Array.isArray(item.categories) ? item.categories.join(', ') : (item.categories || 'ALL');
    const proofShort = item.proofHash ? `${item.proofHash.substring(0, 12)}...` : 'N/A';

    return `
      <tr style="border-bottom:1px solid var(--border); font-size:0.76rem;">
        <td style="padding:10px 12px; color:var(--text-muted);">${new Date(item.timestamp).toLocaleString()}</td>
        <td style="padding:10px 12px;">${actionBadge}</td>
        <td style="padding:10px 12px; color:var(--text-bright); font-weight:600;">${escapeHtml(categoriesStr)}</td>
        <td style="padding:10px 12px; color:var(--text-secondary);">${escapeHtml(item.method || item.actor || 'Portal')}</td>
        <td style="padding:10px 12px; font-family:monospace; color:var(--cyan);" title="${item.proofHash || ''}">${proofShort}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Initialize Consent Hub Module
 */
export function initConsentHub() {
  const scanBtn = document.getElementById('btn-scan-consent-status');
  const lookupInput = document.getElementById('consent-lookup-identifier');
  const withdrawAllBtn = document.getElementById('btn-withdraw-all-consent');
  const withdrawSelectedBtn = document.getElementById('btn-execute-consent-withdraw');
  const copyHashBtn = document.getElementById('btn-copy-proof-hash');
  const closeReceiptBtn = document.getElementById('btn-close-proof-receipt');

  // Quick lookup scan
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      loadSubjectConsentStatus(lookupInput?.value);
    });
  }

  if (lookupInput) {
    lookupInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadSubjectConsentStatus(lookupInput.value);
      }
    });
  }

  // Withdraw All Button
  if (withdrawAllBtn) {
    withdrawAllBtn.addEventListener('click', () => {
      executeWithdrawalAction('ALL', 'Full consent withdrawal across all processing queues');
    });
  }

  // Withdraw Selected Button
  if (withdrawSelectedBtn) {
    withdrawSelectedBtn.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.consent-category-select-cb:checked');
      const selected = Array.from(checkedBoxes).map(cb => cb.dataset.category);
      if (selected.length === 0) {
        showToast('Please check at least one consent category to withdraw.', 'warning');
        return;
      }
      executeWithdrawalAction(selected, 'Selected categories withdrawn by user');
    });
  }

  // Copy SHA-256 Proof Button
  if (copyHashBtn) {
    copyHashBtn.addEventListener('click', () => {
      const hashText = document.getElementById('proof-receipt-sha256')?.textContent;
      if (hashText && navigator.clipboard) {
        navigator.clipboard.writeText(hashText);
        showToast('✓ Cryptographic SHA-256 proof hash copied to clipboard!', 'success');
      }
    });
  }

  // Close receipt card
  if (closeReceiptBtn) {
    closeReceiptBtn.addEventListener('click', () => {
      document.getElementById('consent-proof-receipt-card')?.classList.add('hidden');
    });
  }

  // Auto-load default subject
  if (document.getElementById('consent-matrix-cards')) {
    loadSubjectConsentStatus('alex.johnson@example.com');
  }

  // Expose global methods
  window.loadSubjectConsentStatus = loadSubjectConsentStatus;
  window.executeWithdrawalAction = executeWithdrawalAction;
  window.executeGrantAction = executeGrantAction;
}
