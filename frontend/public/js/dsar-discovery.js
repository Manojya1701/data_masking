'use strict';

/**
 * DSAR Discovery Controller (Step 2 of Segmento Protect Flow)
 * Manages cross-system identity resolution, PII data discovery scanning,
 * updating stepper active states, and rendering the Discovered Data Map.
 */

let activeTargetRequestId = null;

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

function renderDataMapTable(dataMap) {
  const tbody = document.getElementById('dsar-discovery-table-body');
  if (!tbody) return;

  const tables = dataMap.discoveredTables || [];

  if (tables.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">
          No connected systems or database tables found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tables.map(t => {
    const isFound = t.recordCount > 0;
    const statusBadge = isFound
      ? '<span class="meta-pill badge-verified">✓ PII DISCOVERED</span>'
      : '<span class="meta-pill" style="opacity:0.6;">NO PII MATCH</span>';

    const fieldsBadge = (t.matchedFields || []).length > 0
      ? t.matchedFields.map(f => `<span class="meta-pill primary" style="font-size:0.75rem;">${escapeHtml(f)}</span>`).join(' ')
      : '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>';

    const rowIdsStr = (t.matchedRowIds || []).length > 0
      ? `<span style="font-family:monospace; color:var(--cyan); font-weight:700;">[ ${t.matchedRowIds.join(', ')} ]</span>`
      : '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>';

    return `
      <tr>
        <td style="font-weight:700; color:var(--text-bright);">${escapeHtml(t.systemName || t.tableName)}</td>
        <td>${fieldsBadge}</td>
        <td>${rowIdsStr}</td>
        <td style="font-weight:700; color:${isFound ? 'var(--emerald)' : 'var(--text-muted)'};">${t.recordCount} Record${t.recordCount === 1 ? '' : 's'}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

export async function runIdentityDiscoveryScan(requestId) {
  if (!requestId) return;
  activeTargetRequestId = requestId;

  const card = document.getElementById('dsar-step2-discovery-card');
  const reqIdEl = document.getElementById('dsar-discovery-req-id');
  const nameEl = document.getElementById('dsar-disc-name');
  const emailEl = document.getElementById('dsar-disc-email');
  const phoneEl = document.getElementById('dsar-disc-phone');
  const totalRecEl = document.getElementById('dsar-disc-total-records');
  const tbody = document.getElementById('dsar-discovery-table-body');

  if (card) card.classList.remove('hidden');
  if (reqIdEl) reqIdEl.textContent = `Target: ${requestId}`;

  // Update Stepper Bar to Step 2 Active
  updateStepperActiveStep(2);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:24px; color:var(--cyan); font-weight:600;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Scanning connected databases and file history logs for ${escapeHtml(requestId)}…</span>
          </div>
        </td>
      </tr>
    `;
  }

  showToast(`Running Identity Resolution & PII Discovery for ${requestId}…`, 'info');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/discovery/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });

    const data = await res.json();

    if (data && data.success && data.dataMap) {
      const dm = data.dataMap;
      if (nameEl) nameEl.textContent = dm.dataSubject || 'N/A';
      if (emailEl) emailEl.textContent = dm.email || 'N/A';
      if (phoneEl) phoneEl.textContent = dm.phone || 'N/A';
      if (totalRecEl) totalRecEl.textContent = `${dm.totalPiiRecordsFound} Record${dm.totalPiiRecordsFound === 1 ? '' : 's'}`;

      renderDataMapTable(dm);
      showToast(`✓ Identity Discovery Complete! Discovered ${dm.totalPiiRecordsFound} PII record(s) across ${dm.systemsScanned} systems.`, 'success');

      if (card) card.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(data.message || 'Failed to complete identity discovery scan', 'error');
    }
  } catch (err) {
    showToast(`Error running identity discovery scan: ${err.message}`, 'error');
  }
}

export function initDsarDiscovery() {
  const retriggerBtn = document.getElementById('btn-retrigger-discovery');
  const proceedStep3Btn = document.getElementById('btn-proceed-step3');

  if (retriggerBtn) {
    retriggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeTargetRequestId) {
        runIdentityDiscoveryScan(activeTargetRequestId);
      } else {
        showToast('Please select a DSAR request from the queue table first.', 'info');
      }
    });
  }

  if (proceedStep3Btn) {
    proceedStep3Btn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Step 2 Identity Discovery complete! Step 3 (Impact Analysis) will be available in tomorrow\'s workflow update.', 'info');
    });
  }

  // Delegate click events on Proceed (Step 2) queue buttons
  document.addEventListener('click', (e) => {
    const proceedBtn = e.target.closest('.btn-proceed-identity-discovery');
    if (proceedBtn) {
      e.preventDefault();
      const requestId = proceedBtn.getAttribute('data-id');
      if (requestId) {
        runIdentityDiscoveryScan(requestId);
      }
    }
  });
}
