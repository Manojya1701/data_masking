'use strict';

/**
 * DSAR Detail View Controller (Screen 3 of Segmento Protect Workflow)
 * Manages:
 * - 7-Tab Navigation Hub (Overview, Requester, Data Discovery, Tasks, Approvals, Communications, Audit Log)
 * - 6 Cross-Functional Department Tasks (CRM, HR, Marketing, Data Engineering, Vendor Mgmt, Privacy)
 * - Live Subtask Status Updates & Instant Feedback
 * - DPO & Legal Officer Approvals Sign-off
 * - CSV Export of Departmental Tasks
 * - Seamless Transition to 7-Stage Deep Privacy Execution Pipeline
 */

let currentDetailRequestId = null;
let currentDetailData = null;

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
 * Format Team Department Badge
 */
function formatTeamBadge(teamName) {
  const t = (teamName || '').toLowerCase();
  if (t.includes('crm')) {
    return '<span class="meta-pill" style="background:rgba(245,158,11,0.15); color:var(--amber); border:1px solid rgba(245,158,11,0.35); font-weight:700; font-size:0.75rem;">👥 CRM Team</span>';
  }
  if (t.includes('hr')) {
    return '<span class="meta-pill" style="background:rgba(16,185,129,0.15); color:var(--emerald); border:1px solid rgba(16,185,129,0.35); font-weight:700; font-size:0.75rem;">🏢 HR Team</span>';
  }
  if (t.includes('marketing')) {
    return '<span class="meta-pill" style="background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.35); font-weight:700; font-size:0.75rem;">📢 Marketing</span>';
  }
  if (t.includes('data') || t.includes('eng')) {
    return '<span class="meta-pill" style="background:rgba(6,182,212,0.15); color:var(--cyan); border:1px solid rgba(6,182,212,0.35); font-weight:700; font-size:0.75rem;">🗄️ Data Engineering</span>';
  }
  if (t.includes('vendor')) {
    return '<span class="meta-pill" style="background:rgba(59,130,246,0.15); color:var(--blue); border:1px solid rgba(59,130,246,0.35); font-weight:700; font-size:0.75rem;">🤝 Vendor Mgmt</span>';
  }
  if (t.includes('privacy') || t.includes('legal')) {
    return '<span class="meta-pill" style="background:rgba(239,68,68,0.15); color:var(--red); border:1px solid rgba(239,68,68,0.35); font-weight:700; font-size:0.75rem;">⚖️ Privacy Team</span>';
  }
  return `<span class="meta-pill primary" style="font-size:0.75rem;">${escapeHtml(teamName || 'Team')}</span>`;
}

/**
 * Format Priority Badge
 */
function formatPriorityBadge(priority) {
  const p = (priority || 'Medium').toLowerCase();
  if (p === 'critical') {
    return '<span class="meta-pill" style="background:rgba(239,68,68,0.2); color:var(--red); border:1px solid rgba(239,68,68,0.4); font-weight:800; font-size:0.72rem;">🔥 Critical</span>';
  }
  if (p === 'high') {
    return '<span class="meta-pill" style="background:rgba(245,158,11,0.15); color:var(--amber); border:1px solid rgba(245,158,11,0.35); font-weight:700; font-size:0.72rem;">⚡ High</span>';
  }
  if (p === 'medium') {
    return '<span class="meta-pill primary" style="font-size:0.72rem;">Medium</span>';
  }
  return '<span class="meta-pill" style="font-size:0.72rem; color:var(--text-muted);">Low</span>';
}

/**
 * Switch Active Tab inside Screen 3 Detail View
 */
export function switchDetailTab(tabKey) {
  // Tab buttons
  document.querySelectorAll('.dsar-detail-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Tab content panels
  const panelMap = {
    overview: document.getElementById('detail-panel-overview'),
    requester: document.getElementById('detail-panel-requester'),
    discovery: document.getElementById('detail-panel-discovery'),
    tasks: document.getElementById('detail-panel-tasks'),
    approvals: document.getElementById('detail-panel-approvals'),
    communications: document.getElementById('detail-panel-communications'),
    auditlog: document.getElementById('detail-panel-auditlog')
  };

  Object.values(panelMap).forEach(panel => {
    if (panel) panel.classList.add('hidden');
  });

  if (panelMap[tabKey]) {
    panelMap[tabKey].classList.remove('hidden');
  }
}

/**
 * Render the 6 Cross-Team Tasks Table (Screen 3 Core)
 */
function renderSubtasksTable(tasks) {
  const tbody = document.getElementById('dsar-subtasks-table-body');
  const countPill = document.getElementById('subtasks-count-pill');
  if (countPill) countPill.textContent = `${tasks.length}`;
  if (!tbody) return;

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No departmental tasks generated yet.</td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(t => {
    const taskId = escapeHtml(t.id);
    const taskTitle = escapeHtml(t.task);
    const desc = escapeHtml(t.description || '');
    const assignee = escapeHtml(t.assignee || 'Assigned Lead');
    const dueDate = escapeHtml(t.due_date || 'Sep 22, 2026');
    const status = t.status || 'Not Started';

    return `
      <tr data-subtask-id="${taskId}" style="vertical-align:middle; transition:background 0.15s ease;">
        <td style="padding:14px 16px;">
          <div style="font-weight:700; color:var(--text-bright); font-size:0.9rem;">${taskTitle}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; max-width:320px;">${desc}</div>
        </td>
        <td style="padding:14px 16px;">${formatTeamBadge(t.team)}</td>
        <td style="padding:14px 16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:24px; height:24px; border-radius:50%; background:rgba(6,182,212,0.15); color:var(--cyan); font-weight:800; font-size:0.7rem; display:flex; align-items:center; justify-content:center;">
              ${assignee.split(' ').map(w => w[0]).join('').substring(0, 2)}
            </div>
            <span style="font-size:0.85rem; font-weight:600; color:var(--text-bright);">${assignee}</span>
          </div>
        </td>
        <td style="padding:14px 16px;">${formatPriorityBadge(t.priority)}</td>
        <td style="padding:14px 16px; font-size:0.85rem; color:var(--text-bright); font-weight:600;">${dueDate}</td>
        <td style="padding:14px 16px;">
          <select class="input-field select-subtask-status" data-task-id="${taskId}" style="padding:5px 10px; font-size:0.78rem; font-weight:600; border-radius:6px; width:130px;">
            <option value="Not Started" ${status === 'Not Started' ? 'selected' : ''}>⏳ Not Started</option>
            <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>🔄 In Progress</option>
            <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>✓ Completed</option>
          </select>
        </td>
        <td style="padding:14px 16px; text-align:right;">
          <button type="button" class="btn-ghost btn-sm btn-subtask-action" data-task-id="${taskId}" style="display:inline-flex; align-items:center; gap:6px; color:var(--cyan); border-color:rgba(6,182,212,0.35); font-size:0.75rem; font-weight:700; padding:6px 12px; cursor:pointer;">
            <span>Execute ➔</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render Communications Timeline (Tab 6)
 */
function renderCommunicationsList(comms) {
  const container = document.getElementById('detail-communications-list');
  if (!container) return;

  if (!comms || comms.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No communications logged yet.</div>';
    return;
  }

  container.innerHTML = comms.map(c => `
    <div style="padding:14px 18px; background:var(--bg-input); border-radius:8px; border-left:3px solid var(--cyan);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <div style="font-weight:700; color:var(--text-bright); font-size:0.9rem;">${escapeHtml(c.title)}</div>
        <span class="meta-pill badge-verified" style="font-size:0.72rem;">✓ ${escapeHtml(c.status)}</span>
      </div>
      <div style="font-size:0.78rem; color:var(--cyan); margin-bottom:6px;">Recipient: ${escapeHtml(c.recipient)} • <span style="color:var(--text-muted);">${escapeHtml(c.timestamp)}</span></div>
      <div style="font-size:0.82rem; color:var(--text-secondary); background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:6px;">"${escapeHtml(c.preview)}"</div>
    </div>
  `).join('');
}

/**
 * Render Audit Log Ledger (Tab 7)
 */
function renderAuditLogList(logs) {
  const container = document.getElementById('detail-auditlog-list');
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No audit logs recorded yet.</div>';
    return;
  }

  container.innerHTML = logs.map(l => `
    <div style="padding:12px 16px; background:var(--bg-input); border-radius:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <div style="font-weight:700; color:var(--text-bright); font-size:0.85rem; font-family:monospace;">${escapeHtml(l.action)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">Actor: <strong style="color:var(--text-secondary);">${escapeHtml(l.actor)}</strong> • ${new Date(l.timestamp).toLocaleString()}</div>
      </div>
      <div style="font-size:0.72rem; color:var(--cyan); font-family:monospace; background:rgba(6,182,212,0.1); padding:4px 8px; border-radius:4px;">
        SHA256: ${escapeHtml((l.sha256 || '').substring(0, 24))}…
      </div>
    </div>
  `).join('');
}

/**
 * Open and Populate Screen 3: DSAR Detail View for a Request ID
 */
export async function openDsarDetailView(requestId) {
  if (!requestId) return;
  currentDetailRequestId = requestId;

  const dashboardView = document.getElementById('dsar-dashboard-internal-view');
  const detailView = document.getElementById('dsar-ticket-detail-view');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(requestId)}/details`);
    const data = await res.json();

    if (data && data.success) {
      currentDetailData = data;

      // 1. Header Lockup
      const ticketIdEl = document.getElementById('detail-ticket-id');
      const reqNameEl = document.getElementById('detail-requester-name');
      const typeLabelEl = document.getElementById('detail-request-type-label');
      const dueDateEl = document.getElementById('detail-due-date');
      const statusPillEl = document.getElementById('detail-status-pill');

      if (ticketIdEl) ticketIdEl.textContent = data.requestId;
      if (reqNameEl) reqNameEl.textContent = data.requester.fullName;
      if (typeLabelEl) typeLabelEl.textContent = `${data.requester.requestType} (Statutory Privacy Right)`;
      if (dueDateEl) dueDateEl.textContent = data.record.due_date || 'Sep 22, 2026';
      if (statusPillEl) {
        statusPillEl.textContent = data.record.status || 'In Progress';
      }

      // 2. Dossier (Tab 2)
      const dName = document.getElementById('dossier-full-name');
      const dEmail = document.getElementById('dossier-email');
      const dPhone = document.getElementById('dossier-phone');
      const dCountry = document.getElementById('dossier-country');
      const dRel = document.getElementById('dossier-relationship');
      const dEvid = document.getElementById('dossier-evidence');
      const dDetails = document.getElementById('dossier-details');

      if (dName) dName.textContent = data.requester.fullName;
      if (dEmail) dEmail.textContent = data.requester.email;
      if (dPhone) dPhone.textContent = data.requester.phone;
      if (dCountry) dCountry.textContent = data.requester.country;
      if (dRel) dRel.textContent = data.requester.relationship;
      if (dEvid) dEvid.textContent = data.requester.verificationEvidence;
      if (dDetails) dDetails.textContent = data.requester.requestDetails;

      // 3. Tasks Table (Tab 4)
      renderSubtasksTable(data.tasks);

      // 4. Communications (Tab 6)
      renderCommunicationsList(data.communications);

      // 5. Audit Log (Tab 7)
      renderAuditLogList(data.auditLog);

      // Hide Dashboard & Show Screen 3 Detail View
      if (dashboardView) dashboardView.classList.add('hidden');
      if (detailView) detailView.classList.remove('hidden');

      // Default active tab: Tasks
      switchDetailTab('tasks');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast(data.message || 'Failed to load DSAR ticket details', 'error');
    }
  } catch (err) {
    showToast(`Error opening DSAR details: ${err.message}`, 'error');
  }
}

/**
 * Return to Dashboard from Detail View
 */
export function closeDsarDetailView() {
  const dashboardView = document.getElementById('dsar-dashboard-internal-view');
  const detailView = document.getElementById('dsar-ticket-detail-view');

  if (detailView) detailView.classList.add('hidden');
  if (dashboardView) dashboardView.classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Initialize DSAR Detail View Controller
 */
export function initDsarDetail() {
  // Back to Dashboard button
  const backBtn = document.getElementById('btn-detail-back-to-dash');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeDsarDetailView();
    });
  }

  // Tab switching clicks
  const tabBtns = document.querySelectorAll('.dsar-detail-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabKey = btn.dataset.tab;
      if (tabKey) switchDetailTab(tabKey);
    });
  });

  // Export Subtasks CSV
  const exportCsvBtn = document.getElementById('btn-export-subtasks-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentDetailRequestId) {
        showToast(`Exporting departmental tasks for ${currentDetailRequestId}…`, 'info');
        window.open(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentDetailRequestId)}/tasks/export`, '_blank');
      }
    });
  }

  // Proceed to 7-Stage Privacy Pipeline from Detail View
  const proceedPipelineBtn = document.getElementById('btn-detail-proceed-pipeline');
  const runDiscoveryBtn = document.getElementById('btn-detail-run-discovery');

  const triggerPipeline = (e) => {
    if (e) e.preventDefault();
    if (currentDetailRequestId) {
      if (window.runIdentityDiscoveryScan) {
        window.runIdentityDiscoveryScan(currentDetailRequestId);
      } else if (window.triggerDsarDiscovery) {
        window.triggerDsarDiscovery(currentDetailRequestId);
      }
    }
  };

  if (proceedPipelineBtn) proceedPipelineBtn.addEventListener('click', triggerPipeline);
  if (runDiscoveryBtn) runDiscoveryBtn.addEventListener('click', triggerPipeline);

  // Subtask Status change dropdown listener
  document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('select-subtask-status')) {
      const taskId = e.target.dataset.taskId;
      const status = e.target.value;
      if (currentDetailRequestId && taskId) {
        try {
          const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentDetailRequestId)}/subtasks/${encodeURIComponent(taskId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });
          const data = await res.json();
          if (data && data.success) {
            showToast(`✓ ${data.message}`, 'success');
            if (data.tasks) renderSubtasksTable(data.tasks);
          } else {
            showToast(data.message || 'Failed to update subtask', 'error');
          }
        } catch (err) {
          showToast(`Error updating subtask: ${err.message}`, 'error');
        }
      }
    }
  });

  // Execute Subtask button click
  document.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.btn-subtask-action');
    if (actionBtn) {
      e.preventDefault();
      triggerPipeline();
    }
  });

  // DPO Approval Sign-off
  const dpoSignBtn = document.getElementById('btn-sign-dpo-approval');
  if (dpoSignBtn) {
    dpoSignBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentDetailRequestId) return;
      try {
        const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentDetailRequestId)}/approvals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'dpoApproval', status: 'APPROVED', signedBy: 'Anil Reddy (Chief DPO)' })
        });
        const data = await res.json();
        if (data && data.success) {
          showToast('✓ DPO Statutory Approval Signed & Attested', 'success');
          const badge = document.getElementById('approval-dpo-badge');
          if (badge) {
            badge.className = 'meta-pill badge-verified';
            badge.textContent = '✓ APPROVED';
          }
          dpoSignBtn.disabled = true;
          dpoSignBtn.textContent = 'DPO Attestation Signed ✓';
        }
      } catch (err) {
        showToast(`Error signing approval: ${err.message}`, 'error');
      }
    });
  }

  // Expose global helper
  window.openDsarDetailView = openDsarDetailView;
  window.closeDsarDetailView = closeDsarDetailView;
}
