'use strict';

/**
 * DSAR Impact Analysis Controller (Step 3 of Segmento Protect Flow)
 * Manages relational dependency scanning, risk score evaluation,
 * updating stepper active states, and rendering dependency breakdown tables.
 */

let activeImpactRequestId = null;

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

function renderImpactDependencyTable(report) {
  const tbody = document.getElementById('dsar-impact-table-body');
  if (!tbody) return;

  const deps = report.dependencies || [];

  if (deps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:20px; color:var(--emerald); font-weight:600;">
          ✓ No relational dependencies or Foreign Key risks found. Direct hard deletion is safe.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = deps.map(d => {
    let fkBadge = `<span class="meta-pill primary" style="font-size:0.75rem;">${escapeHtml(d.foreignKeyStatus)}</span>`;
    if (d.orphanRisk.includes('HIGH') || d.orphanRisk.includes('CRITICAL')) {
      fkBadge = `<span class="meta-pill" style="background:rgba(239,68,68,0.15); color:var(--red); border:1px solid rgba(239,68,68,0.3); font-size:0.75rem;">⚠️ ${escapeHtml(d.foreignKeyStatus)}</span>`;
    }

    return `
      <tr style="vertical-align:middle;">
        <td style="padding:12px 16px; font-weight:700; color:var(--text-bright); font-family:monospace;">${escapeHtml(d.tableName)}</td>
        <td style="padding:12px 16px; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(d.category)}</td>
        <td style="padding:12px 16px;">${fkBadge}</td>
        <td style="padding:12px 16px; font-weight:700; color:var(--cyan);">${d.dependentRecordCount} Row${d.dependentRecordCount === 1 ? '' : 's'}</td>
        <td style="padding:12px 16px; font-weight:600; color:var(--text-bright); font-size:0.85rem;">${escapeHtml(d.recommendation)}</td>
      </tr>
    `;
  }).join('');
}

export async function runImpactAnalysisScan(requestId) {
  if (!requestId) return;
  activeImpactRequestId = requestId;

  const card = document.getElementById('dsar-step3-impact-card');
  const reqIdEl = document.getElementById('dsar-impact-req-id');
  const levelEl = document.getElementById('dsar-impact-level');
  const scoreEl = document.getElementById('dsar-impact-score');
  const actionEl = document.getElementById('dsar-impact-action');
  const depsCountEl = document.getElementById('dsar-impact-deps-count');
  const descBannerEl = document.getElementById('dsar-impact-desc-banner');
  const tbody = document.getElementById('dsar-impact-table-body');

  if (card) card.classList.remove('hidden');
  if (reqIdEl) reqIdEl.textContent = `Target: ${requestId}`;

  // Update Stepper Bar to Step 3 Active
  updateStepperActiveStep(3);

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:24px; color:var(--amber); font-weight:600;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Analyzing relational dependencies and foreign key integrity for ${escapeHtml(requestId)}…</span>
          </div>
        </td>
      </tr>
    `;
  }

  showToast(`Running Step 3 Impact Analysis for ${requestId}…`, 'info');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/impact/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });

    const data = await res.json();

    if (data && data.success && data.impactReport) {
      const r = data.impactReport;
      
      let levelColor = 'var(--emerald)';
      if (r.riskLevel === 'MEDIUM') levelColor = 'var(--amber)';
      if (r.riskLevel === 'HIGH') levelColor = 'var(--red)';

      if (levelEl) {
        levelEl.textContent = `${r.riskLevel} RISK`;
        levelEl.style.color = levelColor;
      }
      if (scoreEl) scoreEl.textContent = `${r.riskScore} / 100`;
      if (actionEl) actionEl.textContent = r.recommendedAction.replace(/_/g, ' ');
      if (depsCountEl) depsCountEl.textContent = `${r.dependenciesFoundCount} Table System${r.dependenciesFoundCount === 1 ? '' : 's'}`;
      if (descBannerEl) descBannerEl.textContent = r.actionDescription;

      renderImpactDependencyTable(r);
      showToast(`✓ Step 3 Impact Analysis Complete! Risk Level: ${r.riskLevel} (${r.riskScore}/100)`, 'success');

      if (card) card.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(data.message || 'Failed to complete impact analysis scan', 'error');
    }
  } catch (err) {
    showToast(`Error running impact analysis scan: ${err.message}`, 'error');
  }
}

export function initDsarImpact() {
  const retriggerBtn = document.getElementById('btn-retrigger-impact');
  const proceedStep4Btn = document.getElementById('btn-proceed-step4');
  const proceedStep3FromStep2Btn = document.getElementById('btn-proceed-step3');

  if (retriggerBtn) {
    retriggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeImpactRequestId) {
        runImpactAnalysisScan(activeImpactRequestId);
      } else {
        showToast('Please run Step 2 Discovery first.', 'info');
      }
    });
  }

  if (proceedStep3FromStep2Btn) {
    proceedStep3FromStep2Btn.addEventListener('click', (e) => {
      e.preventDefault();
      const reqIdTag = document.getElementById('dsar-discovery-req-id');
      const reqId = reqIdTag ? reqIdTag.textContent.replace('Target: ', '').trim() : activeImpactRequestId;
      if (reqId) {
        runImpactAnalysisScan(reqId);
      } else {
        showToast('Please select a DSAR request to run Impact Analysis.', 'info');
      }
    });
  }

  if (proceedStep4Btn) {
    proceedStep4Btn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Step 3 Impact Analysis complete! Step 4 (Compliance Policy Check) will be available in tomorrow\'s workflow update.', 'info');
    });
  }
}
