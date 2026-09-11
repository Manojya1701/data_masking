'use strict';

/**
 * DSAR Execution Controller (Step 5 of Segmento Protect Flow)
 * Manages Physical Deletion & Cryptographic Anonymization Execution:
 * Executes hard purging on marketing/profile records and selective masking on financial ledgers
 * per the approved Step 4 statutory policy.
 */

let activeExecutionRequestId = null;

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

function updateStepperActiveStep(stepNumber) {
  const stepItems = document.querySelectorAll('.dsar-step-item');
  stepItems.forEach(item => {
    const step = parseInt(item.getAttribute('data-step') || '1', 10);
    if (step <= stepNumber) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function renderExecutionTable(executionLogs) {
  const tbody = document.getElementById('dsar-execution-table-body');
  if (!tbody) return;

  if (!executionLogs || executionLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">
          No execution logs available.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = executionLogs.map(row => {
    const isPurged = row.operationApplied === 'HARD_DELETE';
    
    let opBadge = isPurged
      ? `<span class="meta-pill" style="background:rgba(239,68,68,0.15); color:var(--red); border:1px solid rgba(239,68,68,0.35); font-size:0.75rem; font-weight:700;">
           🗑️ HARD PURGED
         </span>`
      : `<span class="meta-pill" style="background:rgba(6,182,212,0.15); color:var(--cyan); border:1px solid rgba(6,182,212,0.35); font-size:0.75rem; font-weight:700;">
           🛡️ PSEUDONYMIZED
         </span>`;

    const fieldsList = Array.isArray(row.fieldsModified) ? row.fieldsModified.join(', ') : (row.fieldsModified || 'N/A');

    return `
      <tr>
        <td style="padding:12px 14px; font-weight:700; color:var(--text-bright); font-family:monospace;">
          ${escapeHtml(row.tableName)}
          <div style="font-size:0.7rem; color:var(--text-muted); font-weight:normal; font-family:sans-serif;">${row.recordsAffected} Record(s)</div>
        </td>
        <td style="padding:12px 14px;">${opBadge}</td>
        <td style="padding:12px 14px; font-size:0.8rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(fieldsList)}</td>
        <td style="padding:12px 14px; font-size:0.78rem; color:var(--text-bright);">${escapeHtml(row.statutoryRetentionStatus)}</td>
        <td style="padding:12px 14px; font-size:0.8rem; color:var(--emerald); font-weight:700;">
          <span style="display:inline-flex; align-items:center; gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${escapeHtml(row.executionStatus)}</span>
          </span>
        </td>
        <td style="padding:12px 14px; font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(row.executedAt?.slice(0, 19).replace('T', ' ') || 'Just now')}</td>
      </tr>
    `;
  }).join('');
}

export async function runDsarExecution(requestId) {
  if (!requestId) return;
  activeExecutionRequestId = requestId;

  const card = document.getElementById('dsar-step5-execution-card');
  const reqIdEl = document.getElementById('dsar-execution-req-id');
  const totalProcEl = document.getElementById('dsar-exec-total-processed');
  const purgedEl = document.getElementById('dsar-exec-purged-count');
  const anonEl = document.getElementById('dsar-exec-anonymized-count');
  const retainedEl = document.getElementById('dsar-exec-retained-count');
  const bannerDescEl = document.getElementById('dsar-execution-desc-banner');
  const sha256El = document.getElementById('dsar-execution-sha256');
  const tbody = document.getElementById('dsar-execution-table-body');

  if (card) card.classList.remove('hidden');
  if (reqIdEl) reqIdEl.textContent = `Target: ${requestId}`;

  // Update stepper indicator to Step 5
  updateStepperActiveStep(5);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:24px; color:var(--cyan); font-weight:600;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Executing approved Deletion & Anonymization operations for ${escapeHtml(requestId)}…</span>
          </div>
        </td>
      </tr>
    `;
  }

  showToast(`Executing Deletion / Anonymization Plan for ${requestId}…`, 'info');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/execution/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });

    const data = await res.json();

    if (data && data.success && data.executionReport) {
      const rep = data.executionReport;

      if (totalProcEl) totalProcEl.textContent = `${rep.totalRecordsProcessed} Records`;
      if (purgedEl) purgedEl.textContent = `${rep.recordsPurgedCount} Purged`;
      if (anonEl) anonEl.textContent = `${rep.recordsAnonymizedCount} Masked`;
      if (retainedEl) retainedEl.textContent = `${rep.recordsRetainedCount} Retained (7-Yr Lock)`;

      if (bannerDescEl) {
        bannerDescEl.textContent = rep.summaryMessage || 'Execution completed successfully across all system stores.';
      }

      if (sha256El) {
        sha256El.textContent = rep.executionChecksum || 'e3b0c44298fc1c149afbf4c8996f';
      }

      renderExecutionTable(rep.executionLogs);
      showToast(`✓ Step 5 Execution Complete: ${rep.recordsPurgedCount} purged, ${rep.recordsAnonymizedCount} pseudonymized.`, 'success');

      if (card) card.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(data.message || 'Failed to complete execution', 'error');
    }
  } catch (err) {
    showToast(`Error executing DSAR plan: ${err.message}`, 'error');
  }
}

export function initDsarExecution() {
  const retriggerBtn = document.getElementById('btn-retrigger-execution');
  const proceedStep6Btn = document.getElementById('btn-proceed-step6');

  if (retriggerBtn) {
    retriggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeExecutionRequestId) {
        runDsarExecution(activeExecutionRequestId);
      } else {
        showToast('Please run Step 4 Policy Check first.', 'info');
      }
    });
  }

  if (proceedStep6Btn) {
    proceedStep6Btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeExecutionRequestId) {
        if (typeof window.runDsarVerification === 'function') {
          window.runDsarVerification(activeExecutionRequestId);
        } else {
          showToast(`Step 6 Verification ready for ${activeExecutionRequestId}`, 'info');
        }
      } else {
        showToast('Please execute Step 5 deletion first.', 'info');
      }
    });
  }

  // Expose global handler for cross-module invocations
  window.runDsarExecution = runDsarExecution;
}
