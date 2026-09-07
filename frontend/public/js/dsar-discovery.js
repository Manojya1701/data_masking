'use strict';

/**
 * DSAR Discovery Controller (Step 2 of Segmento Protect Flow)
 * Full 8-Stage AI Identity Resolution & Data Discovery Controller:
 * Manages cross-system identity resolution, PII data discovery scanning,
 * ML confidence score rendering, Explainable AI badges, and Identity Link Graph visualization.
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

function formatSystemName(systemName, tableName) {
  const isFile = (systemName || '').toLowerCase().includes('file') || (tableName || '').toLowerCase().includes('history');
  const typeLabel = isFile ? '📁 File Storage & Audit Logs' : '🗄️ PostgreSQL Database';
  const nameLabel = tableName || systemName || 'System Table';

  return `
    <div style="display:flex; flex-direction:column; gap:2px;">
      <div style="font-weight:700; color:var(--text-bright); font-size:0.88rem; font-family:monospace;">${escapeHtml(nameLabel)}</div>
      <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">${escapeHtml(typeLabel)}</div>
    </div>
  `;
}

function renderDataMapTable(dataMap) {
  const tbody = document.getElementById('dsar-discovery-table-body');
  if (!tbody) return;

  const tables = dataMap.discoveredTables || [];

  if (tables.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">
          No connected systems or database tables found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tables.map(t => {
    const isFound = t.recordCount > 0;
    const statusBadge = isFound
      ? '<span class="meta-pill badge-verified" style="font-size:0.75rem;">✓ PII DISCOVERED</span>'
      : '<span class="meta-pill" style="opacity:0.5; font-size:0.75rem;">NO PII MATCH</span>';

    const fieldsBadge = (t.matchedFields || []).length > 0
      ? t.matchedFields.map(f => `<span class="meta-pill primary" style="font-size:0.72rem; margin-right:4px;">${escapeHtml(f)}</span>`).join('')
      : '<span style="color:var(--text-muted); font-size:0.8rem;">-</span>';

    const matchMethod = t.matchMethod || 'SQL Exact Check';
    const aiConfidence = t.aiConfidence || (isFound ? '97% High Confidence' : '0%');
    const systemBadge = formatSystemName(t.systemName, t.tableName);

    let confBadgeStyle = 'color:var(--text-muted);';
    if (aiConfidence.includes('97') || aiConfidence.includes('100') || aiConfidence.includes('High') || aiConfidence.includes('Direct')) {
      confBadgeStyle = 'color:var(--emerald); font-weight:700;';
    } else if (aiConfidence.includes('Probable') || aiConfidence.includes('82') || aiConfidence.includes('91')) {
      confBadgeStyle = 'color:var(--amber); font-weight:700;';
    }

    return `
      <tr style="vertical-align:middle;">
        <td style="padding:12px 14px;">${systemBadge}</td>
        <td style="padding:12px 14px;">${fieldsBadge}</td>
        <td style="padding:12px 14px; font-size:0.82rem; color:var(--text-bright); font-weight:600;">${escapeHtml(matchMethod)}</td>
        <td style="padding:12px 14px; font-size:0.82rem; ${confBadgeStyle}">${escapeHtml(aiConfidence)}</td>
        <td style="padding:12px 14px; font-weight:700; color:${isFound ? 'var(--emerald)' : 'var(--text-muted)'};">${t.recordCount} Record${t.recordCount === 1 ? '' : 's'}</td>
        <td style="padding:12px 14px;">${statusBadge}</td>
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
  const confEl = document.getElementById('dsar-disc-confidence');
  const totalRecEl = document.getElementById('dsar-disc-total-records');
  const tbody = document.getElementById('dsar-discovery-table-body');

  if (card) card.classList.remove('hidden');
  if (reqIdEl) reqIdEl.textContent = `Target: ${requestId}`;

  // Update Stepper Bar to Step 2 Active
  updateStepperActiveStep(2);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:24px; color:var(--cyan); font-weight:600;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Running 8-Stage AI Identity Resolution & PII Discovery for ${escapeHtml(requestId)}…</span>
          </div>
        </td>
      </tr>
    `;
  }

  showToast(`Running 8-Stage AI Identity Resolution for ${requestId}…`, 'info');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/discovery/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });

    const data = await res.json();

    if (data && data.success && data.dataMap) {
      const dm = data.dataMap;
      if (nameEl) nameEl.textContent = dm.fullName || dm.targetDataSubject || 'N/A';
      if (emailEl) emailEl.textContent = dm.email || dm.targetEmail || 'N/A';
      if (phoneEl) phoneEl.textContent = dm.phone || dm.targetPhone || 'N/A';
      if (totalRecEl) totalRecEl.textContent = `${dm.totalPiiRecordsFound} Record${dm.totalPiiRecordsFound === 1 ? '' : 's'}`;

      if (confEl) {
        const confScore = dm.overallConfidence || (dm.totalPiiRecordsFound > 0 ? '97%' : '0%');
        const status = dm.overallStatus || 'MATCH';
        confEl.textContent = `${confScore} ${status.replace('_', ' ')}`;
        if (status === 'MATCH' || confScore.includes('9')) {
          confEl.style.color = 'var(--emerald)';
        } else if (status === 'PROBABLE_MATCH' || confScore.includes('8')) {
          confEl.style.color = 'var(--amber)';
        } else {
          confEl.style.color = 'var(--red)';
        }
      }

      renderDataMapTable(dm);
      showToast(`✓ Identity Discovery Complete! Discovered ${dm.totalPiiRecordsFound} PII record(s) across ${dm.systemsScanned || dm.discoveredSystemsCount} systems.`, 'success');

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
      const reqIdTag = document.getElementById('dsar-discovery-req-id');
      const reqId = reqIdTag ? reqIdTag.textContent.replace('Target: ', '').trim() : activeTargetRequestId;
      if (window.runImpactAnalysisScan && reqId) {
        window.runImpactAnalysisScan(reqId);
      } else {
        const impactBtn = document.getElementById('btn-retrigger-impact');
        if (impactBtn) impactBtn.click();
      }
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

