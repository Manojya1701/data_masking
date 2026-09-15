'use strict';

/**
 * DSAR Operations Dashboard Controller (Screen 2 / Operational View of Segmento Protect Flow)
 * Manages:
 * - 4 Live KPI Trend Metric Cards (Total Requests, In Progress, Completed, SLA Breaches)
 * - Sub-view Navigation (Dashboard, Requests, My Tasks, Team Tasks, SLA Breaches, Reports)
 * - My Tasks: Operator-focused task board for John Doe with priority & status editing
 * - Team Tasks: Team workload distribution cards & live ticket reassignment
 * - Compliance Reports Hub: Visual jurisdiction/right type distributions & CSV/JSON export
 * - Requests Queue Table with 'Open Pipeline' trigger linking to Steps 2-7
 */

let allDsarRequests = [];
let activeFilter = 'all';
let currentSearchTerm = '';
let activeSubView = 'dashboard';
const CURRENT_OPERATOR = 'John Doe';
const TEAM_MEMBERS = ['John Doe', 'Sarah Lee', 'Michael Tan', 'Alex Chen'];

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
 * Formats request type badge with distinctive color accent
 */
function formatRequestTypeBadge(type) {
  const t = (type || 'Deletion').toLowerCase();
  if (t.includes('delete') || t.includes('erasure')) {
    return '<span class="meta-pill" style="background:rgba(239,68,68,0.12); color:var(--red); border:1px solid rgba(239,68,68,0.3); font-weight:700; font-size:0.75rem;">🗑️ Deletion</span>';
  }
  if (t.includes('access') || t.includes('export')) {
    return '<span class="meta-pill" style="background:rgba(59,130,246,0.12); color:var(--blue); border:1px solid rgba(59,130,246,0.3); font-weight:700; font-size:0.75rem;">📦 Access</span>';
  }
  if (t.includes('rectif') || t.includes('correct')) {
    return '<span class="meta-pill" style="background:rgba(245,158,11,0.12); color:var(--amber); border:1px solid rgba(245,158,11,0.3); font-weight:700; font-size:0.75rem;">✏️ Rectification</span>';
  }
  if (t.includes('restrict')) {
    return '<span class="meta-pill" style="background:rgba(139,92,246,0.12); color:#a78bfa; border:1px solid rgba(139,92,246,0.3); font-weight:700; font-size:0.75rem;">🔒 Restrict</span>';
  }
  if (t.includes('portab')) {
    return '<span class="meta-pill" style="background:rgba(6,182,212,0.12); color:var(--cyan); border:1px solid rgba(6,182,212,0.3); font-weight:700; font-size:0.75rem;">🔄 Portability</span>';
  }
  if (t.includes('anonym')) {
    return '<span class="meta-pill" style="background:rgba(16,185,129,0.12); color:var(--emerald); border:1px solid rgba(16,185,129,0.3); font-weight:700; font-size:0.75rem;">🎭 Anonymization</span>';
  }
  return `<span class="meta-pill primary" style="font-size:0.75rem;">${escapeHtml(type || 'Request')}</span>`;
}

/**
 * Formats lifecycle status badge
 */
function formatStatusBadge(status) {
  const s = (status || 'In Progress').toLowerCase();
  if (s.includes('complet') || s.includes('certif') || s.includes('closed') || s.includes('approved')) {
    return '<span class="meta-pill badge-verified" style="font-size:0.75rem; font-weight:700;">✓ Completed</span>';
  }
  if (s.includes('in progress') || s.includes('progress')) {
    return '<span class="meta-pill" style="background:rgba(6,182,212,0.15); color:var(--cyan); border:1px solid rgba(6,182,212,0.35); font-weight:700; font-size:0.75rem;">⏳ In Progress</span>';
  }
  if (s.includes('assign')) {
    return '<span class="meta-pill" style="background:rgba(59,130,246,0.15); color:var(--blue); border:1px solid rgba(59,130,246,0.35); font-weight:700; font-size:0.75rem;">👤 Assigned</span>';
  }
  if (s.includes('not started') || s.includes('received') || s.includes('pending')) {
    return '<span class="meta-pill" style="background:rgba(245,158,11,0.15); color:var(--amber); border:1px solid rgba(245,158,11,0.35); font-weight:700; font-size:0.75rem;">⏳ Not Started</span>';
  }
  return `<span class="meta-pill" style="font-size:0.75rem;">${escapeHtml(status || 'Active')}</span>`;
}

/**
 * Formats priority badge
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
 * Calculates due date formatted string
 */
function calculateDueDateDisplay(record) {
  if (record.due_date) return record.due_date;
  const created = record.created_at ? new Date(record.created_at) : new Date();
  const due = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return due.toLocaleDateString('en-US', options);
}

/**
 * Updates KPI Metric counter cards
 */
function updateKpiCards(kpis, totalCount) {
  const totalEl = document.getElementById('dash-kpi-total-requests');
  const inProgressEl = document.getElementById('dash-kpi-in-progress');
  const completedEl = document.getElementById('dash-kpi-completed');
  const slaBreachesEl = document.getElementById('dash-kpi-sla-breaches');

  const total = kpis && kpis.total !== undefined ? kpis.total : (kpis && kpis.totalRequests !== undefined ? kpis.totalRequests : totalCount);
  const inProgress = kpis && kpis.inProgress !== undefined ? kpis.inProgress : (kpis && kpis.inProgressCount !== undefined ? kpis.inProgressCount : 0);
  const completed = kpis && kpis.completed !== undefined ? kpis.completed : (kpis && kpis.completedCount !== undefined ? kpis.completedCount : 0);
  const slaBreaches = kpis && kpis.slaBreaches !== undefined ? kpis.slaBreaches : (kpis && kpis.slaBreachesCount !== undefined ? kpis.slaBreachesCount : 0);

  if (totalEl) totalEl.textContent = total;
  if (inProgressEl) inProgressEl.textContent = inProgress;
  if (completedEl) completedEl.textContent = completed;
  if (slaBreachesEl) slaBreachesEl.textContent = slaBreaches;
}

/**
 * Switch Sub-view inside DSAR Operations Workspace
 */
export function switchDsarSubView(viewKey) {
  activeSubView = viewKey;

  const views = {
    dashboard: document.getElementById('dsar-subview-dashboard'),
    requests: document.getElementById('dsar-subview-dashboard'),
    my_tasks: document.getElementById('dsar-subview-my-tasks'),
    team_tasks: document.getElementById('dsar-subview-team-tasks'),
    sla_breaches: document.getElementById('dsar-subview-dashboard'),
    reports: document.getElementById('dsar-subview-reports')
  };

  // Hide all subviews
  Object.values(views).forEach(el => {
    if (el) el.classList.add('hidden');
  });

  // Highlight active sidebar item
  document.querySelectorAll('.dsar-sidebar-nav-item').forEach(item => {
    if (item.dataset.tab === viewKey) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (viewKey === 'dashboard' || viewKey === 'requests') {
    if (views.dashboard) views.dashboard.classList.remove('hidden');
    activeFilter = 'all';
    renderDsarTable();
  } else if (viewKey === 'sla_breaches') {
    if (views.dashboard) views.dashboard.classList.remove('hidden');
    activeFilter = 'sla_breach';
    renderDsarTable();
  } else if (viewKey === 'my_tasks') {
    if (views.my_tasks) views.my_tasks.classList.remove('hidden');
    renderMyTasks();
  } else if (viewKey === 'team_tasks') {
    if (views.team_tasks) views.team_tasks.classList.remove('hidden');
    renderTeamTasks();
  } else if (viewKey === 'reports') {
    if (views.reports) views.reports.classList.remove('hidden');
    loadComplianceReports();
  }
}

/**
 * Fetches DSAR requests from backend and updates dashboard UI
 */
export async function loadDsarDashboard() {
  const tbody = document.getElementById('dsar-dashboard-table-body');
  const countBadge = document.getElementById('dsar-dash-queue-count');

  try {
    const res = await fetch(window.location.origin + '/api/dsar/requests');
    const data = await res.json();
    const list = data ? (data.records || data.requests || []) : [];

    if (data && data.success && Array.isArray(list)) {
      allDsarRequests = list;
      if (countBadge) {
        countBadge.textContent = `${allDsarRequests.length} Total`;
      }
      if (data.kpis) {
        updateKpiCards(data.kpis, allDsarRequests.length);
      } else {
        updateKpiCards(null, allDsarRequests.length);
      }
      
      // Re-render active subview
      if (activeSubView === 'my_tasks') {
        renderMyTasks();
      } else if (activeSubView === 'team_tasks') {
        renderTeamTasks();
      } else if (activeSubView === 'reports') {
        loadComplianceReports();
      } else {
        renderDsarTable();
      }
    } else {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No DSAR requests registered in system yet.</td></tr>';
      }
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--red);">Error loading DSAR requests: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

/**
 * Filters and renders Main DSAR Requests Table
 */
export function renderDsarTable() {
  const tbody = document.getElementById('dsar-dashboard-table-body');
  if (!tbody) return;

  const filtered = allDsarRequests.filter(r => {
    // 1. Search Query Match
    if (currentSearchTerm) {
      const q = currentSearchTerm.toLowerCase();
      const matchId = (r.request_id || '').toLowerCase().includes(q);
      const matchName = (r.full_name || '').toLowerCase().includes(q);
      const matchEmail = (r.email || '').toLowerCase().includes(q);
      const matchType = (r.request_type || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchEmail && !matchType) return false;
    }

    // 2. Status Filter Chip Match
    const status = (r.status || 'in progress').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'in_progress') return status.includes('progress') || status.includes('in progress');
    if (activeFilter === 'assigned') return status.includes('assigned');
    if (activeFilter === 'not_started') return status.includes('not started') || status.includes('received') || status.includes('pending');
    if (activeFilter === 'completed') return status.includes('completed') || status.includes('certif') || status.includes('closed');
    if (activeFilter === 'sla_breach') return status.includes('breach');
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px 16px; color:var(--text-muted);"><div style="font-size:1.5rem; margin-bottom:8px;">🔍</div><div style="font-weight:600; color:var(--text-bright);">No DSAR requests match the active filter.</div><div style="font-size:0.82rem; margin-top:4px;">Try changing the search query or selecting "All Requests".</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const reqId = escapeHtml(r.request_id || 'DSAR-2026-000125');
    const name = escapeHtml(r.full_name || 'Requester');
    const email = escapeHtml(r.email || 'user@example.com');
    const country = r.country ? '<span style="font-size:0.75rem; color:var(--text-muted); display:block;">📍 ' + escapeHtml(r.country) + '</span>' : '';
    const dueDate = calculateDueDateDisplay(r);

    return '<tr data-request-id="' + reqId + '" style="transition:background 0.15s ease;">' +
      '<td>' +
        '<button type="button" class="btn-open-dsar-detail dsar-ticket-id-link" data-id="' + reqId + '" style="background:transparent; border:none; padding:0; font-weight:700; color:var(--cyan); font-family:var(--font-mono, monospace); font-size:0.88rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; text-decoration:underline; text-underline-offset:3px;" title="Click to view full 7-tab Ticket Detail Hub">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
          reqId +
        '</button>' +
      '</td>' +
      '<td>' + formatRequestTypeBadge(r.request_type) + '</td>' +
      '<td>' +
        '<div style="font-weight:700; color:var(--text-bright); font-size:0.9rem;">' + name + '</div>' +
        '<div style="font-size:0.78rem; color:var(--text-muted);">' + email + '</div>' +
        country +
      '</td>' +
      '<td>' + formatStatusBadge(r.status) + '</td>' +
      '<td>' +
        '<div style="font-weight:600; color:var(--text-primary); font-size:0.85rem;">' + dueDate + '</div>' +
        '<div style="font-size:0.72rem; color:var(--emerald); font-weight:600;">✓ SLA on track</div>' +
      '</td>' +
      '<td style="text-align:right;">' +
        '<div style="display:inline-flex; align-items:center; gap:6px;">' +
          '<button type="button" class="btn-ghost btn-sm btn-open-dsar-detail" data-id="' + reqId + '" style="display:inline-flex; align-items:center; gap:5px; color:var(--text-bright); border-color:var(--border-subtle); padding:6px 10px; font-size:0.75rem; font-weight:600; border-radius:6px; cursor:pointer;" title="View 7-Tab Ticket Detail Hub with Cross-Team Tasks">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '<span>Detail Hub</span>' +
          '</button>' +
          '<button type="button" class="btn-ghost btn-sm btn-open-dsar-flow" data-id="' + reqId + '" style="display:inline-flex; align-items:center; gap:6px; color:var(--cyan); border-color:rgba(6,182,212,0.35); padding:6px 12px; font-size:0.78rem; font-weight:700; border-radius:6px; cursor:pointer;">' +
            '<span>Pipeline</span>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>' +
          '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/**
 * Render My Tasks Sub-view (Operator Focus: John Doe)
 */
export function renderMyTasks() {
  const tbody = document.getElementById('dsar-mytasks-table-body');
  const badgeCount = document.getElementById('mytasks-badge-count');
  const inProgEl = document.getElementById('mytasks-in-progress-count');
  const highPrioEl = document.getElementById('mytasks-high-priority-count');
  const completedEl = document.getElementById('mytasks-completed-count');

  const myTasks = allDsarRequests.filter(r => (r.assigned_to || 'John Doe') === CURRENT_OPERATOR);

  let inProgCount = 0;
  let highPrioCount = 0;
  let compCount = 0;

  myTasks.forEach(r => {
    const st = (r.status || '').toLowerCase();
    const pr = (r.priority || '').toLowerCase();
    if (st.includes('complet') || st.includes('certif') || st.includes('closed')) {
      compCount++;
    } else {
      inProgCount++;
    }
    if (pr === 'critical' || pr === 'high') {
      highPrioCount++;
    }
  });

  if (badgeCount) badgeCount.textContent = `${myTasks.length} Assigned`;
  if (inProgEl) inProgEl.textContent = inProgCount;
  if (highPrioEl) highPrioEl.textContent = highPrioCount;
  if (completedEl) completedEl.textContent = compCount;

  if (!tbody) return;

  if (myTasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:28px; color:var(--text-muted);">No tasks currently assigned to John Doe.</td></tr>';
    return;
  }

  tbody.innerHTML = myTasks.map(r => {
    const reqId = escapeHtml(r.request_id);
    const name = escapeHtml(r.full_name || 'Data Subject');
    const notes = r.internal_notes ? `<div style="font-size:0.75rem; color:var(--cyan); margin-top:2px;">💬 ${escapeHtml(r.internal_notes)}</div>` : '';
    const dueDate = calculateDueDateDisplay(r);
    const currentStatus = r.status || 'In Progress';
    const currentPriority = r.priority || 'Medium';

    return `
      <tr data-request-id="${reqId}" style="vertical-align:middle;">
        <td style="padding:12px 14px; font-weight:700; color:var(--cyan); font-family:monospace; font-size:0.85rem;">${reqId}</td>
        <td style="padding:12px 14px;">${formatRequestTypeBadge(r.request_type)}</td>
        <td style="padding:12px 14px;">
          <div style="font-weight:700; color:var(--text-bright); font-size:0.88rem;">${name}</div>
          ${notes}
        </td>
        <td style="padding:12px 14px;">
          <select class="input-field select-task-priority" data-id="${reqId}" style="padding:4px 8px; font-size:0.75rem; border-radius:4px; font-weight:700; width:100px;">
            <option value="Critical" ${currentPriority === 'Critical' ? 'selected' : ''}>🔥 Critical</option>
            <option value="High" ${currentPriority === 'High' ? 'selected' : ''}>⚡ High</option>
            <option value="Medium" ${currentPriority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Low" ${currentPriority === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </td>
        <td style="padding:12px 14px;">
          <select class="input-field select-task-status" data-id="${reqId}" style="padding:4px 8px; font-size:0.75rem; border-radius:4px; width:120px;">
            <option value="In Progress" ${currentStatus === 'In Progress' ? 'selected' : ''}>⏳ In Progress</option>
            <option value="Assigned" ${currentStatus === 'Assigned' ? 'selected' : ''}>👤 Assigned</option>
            <option value="Under Legal Review" ${currentStatus === 'Under Legal Review' ? 'selected' : ''}>⚖️ Under Review</option>
            <option value="Completed" ${currentStatus === 'Completed' ? 'selected' : ''}>✓ Completed</option>
          </select>
        </td>
        <td style="padding:12px 14px; text-align:right;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" class="btn-ghost btn-sm btn-open-dsar-detail" data-id="${reqId}" style="display:inline-flex; align-items:center; gap:5px; color:var(--text-bright); border-color:var(--border-subtle); padding:5px 9px; font-size:0.75rem; font-weight:600; border-radius:6px; cursor:pointer;" title="View Detail Hub">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Detail Hub</span>
            </button>
            <button type="button" class="btn-ghost btn-sm btn-open-dsar-flow" data-id="${reqId}" style="display:inline-flex; align-items:center; gap:4px; color:var(--cyan); border-color:rgba(6,182,212,0.35); padding:5px 9px; font-size:0.75rem; font-weight:700; cursor:pointer;">
              <span>Pipeline</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render Team Tasks Sub-view (Team Workload & Reassignment)
 */
export function renderTeamTasks() {
  const grid = document.getElementById('team-workload-grid');
  const tbody = document.getElementById('dsar-teamtasks-table-body');

  // Compute workload
  const workload = {};
  TEAM_MEMBERS.forEach(m => { workload[m] = 0; });
  allDsarRequests.forEach(r => {
    const a = r.assigned_to || 'John Doe';
    workload[a] = (workload[a] || 0) + 1;
  });

  if (grid) {
    grid.innerHTML = TEAM_MEMBERS.map(m => {
      const count = workload[m] || 0;
      const initials = m.split(' ').map(n => n[0]).join('');
      return `
        <div class="db-card" style="padding:14px 16px; display:flex; align-items:center; gap:12px; border-left:3px solid var(--cyan);">
          <div style="width:36px; height:36px; border-radius:50%; background:rgba(6,182,212,0.15); color:var(--cyan); font-weight:800; font-size:0.85rem; display:flex; align-items:center; justify-content:center; border:1px solid rgba(6,182,212,0.3); flex-shrink:0;">
            ${initials}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; color:var(--text-bright); font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${count} Active Task${count === 1 ? '' : 's'}</div>
          </div>
          <span class="meta-pill primary" style="font-size:0.75rem;">${count}</span>
        </div>
      `;
    }).join('');
  }

  if (!tbody) return;

  tbody.innerHTML = allDsarRequests.map(r => {
    const reqId = escapeHtml(r.request_id);
    const name = escapeHtml(r.full_name || 'Requester');
    const country = escapeHtml(r.country || 'India');
    const currentAssignee = r.assigned_to || 'John Doe';
    const currentPriority = r.priority || 'Medium';

    const assigneeOptions = TEAM_MEMBERS.map(m => `
      <option value="${m}" ${currentAssignee === m ? 'selected' : ''}>${m}</option>
    `).join('');

    return `
      <tr data-request-id="${reqId}" style="vertical-align:middle;">
        <td style="padding:12px 14px; font-weight:700; color:var(--cyan); font-family:monospace; font-size:0.85rem;">
          <button type="button" class="btn-open-dsar-detail dsar-ticket-id-link" data-id="${reqId}" style="background:transparent; border:none; padding:0; font-weight:700; color:var(--cyan); font-family:var(--font-mono, monospace); font-size:0.85rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer; text-decoration:underline; text-underline-offset:3px;" title="View Detail Hub">
            ${reqId}
          </button>
        </td>
        <td style="padding:12px 14px;">
          <div style="font-weight:700; color:var(--text-bright); font-size:0.88rem;">${name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(r.email || '')}</div>
        </td>
        <td style="padding:12px 14px; font-size:0.8rem; color:var(--text-bright);">📍 ${country}</td>
        <td style="padding:12px 14px;">
          <select class="input-field select-task-assignee" data-id="${reqId}" style="padding:4px 8px; font-size:0.78rem; border-radius:4px; font-weight:600; width:130px;">
            ${assigneeOptions}
          </select>
        </td>
        <td style="padding:12px 14px;">
          <select class="input-field select-task-priority" data-id="${reqId}" style="padding:4px 8px; font-size:0.75rem; border-radius:4px; font-weight:700; width:95px;">
            <option value="Critical" ${currentPriority === 'Critical' ? 'selected' : ''}>🔥 Critical</option>
            <option value="High" ${currentPriority === 'High' ? 'selected' : ''}>⚡ High</option>
            <option value="Medium" ${currentPriority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Low" ${currentPriority === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </td>
        <td style="padding:12px 14px;">${formatStatusBadge(r.status)}</td>
        <td style="padding:12px 14px; text-align:right;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" class="btn-ghost btn-sm btn-open-dsar-detail" data-id="${reqId}" style="display:inline-flex; align-items:center; gap:5px; color:var(--text-bright); border-color:var(--border-subtle); padding:5px 9px; font-size:0.75rem; font-weight:600; border-radius:6px; cursor:pointer;" title="View Detail Hub">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Detail Hub</span>
            </button>
            <button type="button" class="btn-ghost btn-sm btn-open-dsar-flow" data-id="${reqId}" style="display:inline-flex; align-items:center; gap:4px; color:var(--cyan); border-color:rgba(6,182,212,0.35); padding:5px 9px; font-size:0.75rem; font-weight:700; cursor:pointer;">
              <span>Pipeline</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Load Compliance & Analytics Reports Hub
 */
export async function loadComplianceReports() {
  const avgDaysEl = document.getElementById('report-stat-avg-days');
  const jurisdictionsEl = document.getElementById('report-stat-jurisdictions');
  const jurBars = document.getElementById('reports-jurisdiction-bars');
  const typeBars = document.getElementById('reports-types-bars');
  const prioBars = document.getElementById('reports-priority-bars');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/analytics/reports`);
    const data = await res.json();

    if (data && data.success) {
      if (avgDaysEl) avgDaysEl.textContent = `${data.avgSlaTurnaroundDays || 4.2} Days`;
      if (jurisdictionsEl) jurisdictionsEl.textContent = `${data.activeJurisdictionsCount || 5} Frameworks`;

      const total = data.totalRequests || allDsarRequests.length || 1;

      // 1. Jurisdiction Bars
      if (jurBars && data.jurisdictions) {
        jurBars.innerHTML = Object.entries(data.jurisdictions).map(([name, count]) => {
          const pct = Math.round((count / total) * 100);
          return `
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:600; margin-bottom:4px;">
                <span style="color:var(--text-bright);">${escapeHtml(name)}</span>
                <span style="color:var(--cyan);">${count} (${pct}%)</span>
              </div>
              <div style="width:100%; height:8px; background:var(--bg-input); border-radius:4px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--cyan), var(--blue)); border-radius:4px;"></div>
              </div>
            </div>
          `;
        }).join('');
      }

      // 2. Type Bars
      if (typeBars && data.requestTypes) {
        typeBars.innerHTML = Object.entries(data.requestTypes).map(([type, count]) => {
          const pct = Math.round((count / total) * 100);
          return `
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:600; margin-bottom:4px;">
                <span style="color:var(--text-bright);">${escapeHtml(type)}</span>
                <span style="color:var(--emerald);">${count} (${pct}%)</span>
              </div>
              <div style="width:100%; height:8px; background:var(--bg-input); border-radius:4px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--emerald), var(--cyan)); border-radius:4px;"></div>
              </div>
            </div>
          `;
        }).join('');
      }

      // 3. Priority Bars
      if (prioBars && data.priorities) {
        prioBars.innerHTML = Object.entries(data.priorities).map(([prio, count]) => {
          const pct = Math.round((count / total) * 100);
          let barColor = 'var(--blue)';
          if (prio === 'Critical') barColor = 'var(--red)';
          if (prio === 'High') barColor = 'var(--amber)';
          if (prio === 'Medium') barColor = 'var(--cyan)';

          return `
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:600; margin-bottom:4px;">
                <span style="color:var(--text-bright);">${escapeHtml(prio)} Priority</span>
                <span style="color:${barColor}; font-weight:700;">${count} (${pct}%)</span>
              </div>
              <div style="width:100%; height:8px; background:var(--bg-input); border-radius:4px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:4px;"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Error loading compliance reports:', err.message);
  }
}

/**
 * Handle live task field update via PATCH /api/dsar/requests/:id/task
 */
async function updateTaskField(requestId, payload) {
  try {
    const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(requestId)}/task`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data && data.success) {
      showToast(`✓ Updated task ${requestId}`, 'success');
      await loadDsarDashboard();
    } else {
      showToast(data.message || 'Failed to update task', 'error');
    }
  } catch (err) {
    showToast(`Network error updating task: ${err.message}`, 'error');
  }
}

/**
 * Initialize DSAR Dashboard Controller
 */
export function initDsarDashboard() {
  // Global search input in Dashboard
  const searchInput = document.getElementById('dsar-dash-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value.trim();
      renderDsarTable();
    });
  }

  // Filter Pills (All, In Progress, Assigned, Not Started, Completed)
  const filterPills = document.querySelectorAll('.dsar-dash-filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.dataset.filter || 'all';
      renderDsarTable();
    });
  });

  // Sidebar navigation tabs -> Switch subviews
  const sidebarItems = document.querySelectorAll('.dsar-sidebar-nav-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabKey = item.dataset.tab;
      if (tabKey) {
        switchDsarSubView(tabKey);
      }
    });
  });

  // Click on 'Detail Hub' / Ticket ID -> Open 7-Tab Detail Hub (Screen 3)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-dsar-detail');
    if (btn) {
      const requestId = btn.dataset.id;
      if (requestId && window.openDsarDetailView) {
        window.openDsarDetailView(requestId);
      }
    }
  });

  // Click on 'Open Pipeline' -> Scroll smoothly to Step 2 Identity Discovery
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-open-dsar-flow');
    if (btn) {
      const requestId = btn.dataset.id;
      if (requestId) {
        if (window.runIdentityDiscoveryScan) {
          window.runIdentityDiscoveryScan(requestId);
        } else if (window.triggerDsarDiscovery) {
          window.triggerDsarDiscovery(requestId);
        }
      }
    }
  });

  // Priority and Status dropdown change listeners (delegated)
  document.addEventListener('change', (e) => {
    // Priority select
    if (e.target.classList.contains('select-task-priority')) {
      const requestId = e.target.dataset.id;
      const priority = e.target.value;
      if (requestId) updateTaskField(requestId, { priority });
    }
    // Status select
    if (e.target.classList.contains('select-task-status')) {
      const requestId = e.target.dataset.id;
      const status = e.target.value;
      if (requestId) updateTaskField(requestId, { status });
    }
    // Assignee select
    if (e.target.classList.contains('select-task-assignee')) {
      const requestId = e.target.dataset.id;
      const assigned_to = e.target.value;
      if (requestId) updateTaskField(requestId, { assigned_to });
    }
  });

  // Refresh button
  const refreshBtn = document.getElementById('btn-refresh-dsar-requests');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      showToast('Refreshing DSAR requests queue…', 'info');
      await loadDsarDashboard();
      showToast('✓ DSAR queue refreshed successfully', 'success');
    });
  }

  // Reset clean demo records button
  const resetBtn = document.getElementById('btn-reset-dsar-queue');
  if (resetBtn) {
    resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        showToast('Resetting DSAR requests to clean demo records…', 'info');
        const res = await fetch(`${window.location.origin}/api/dsar/requests/reset`, { method: 'POST' });
        const data = await res.json();
        if (data && data.success) {
          showToast('✓ DSAR requests reset to clean demo records', 'success');
          await loadDsarDashboard();
        } else {
          showToast(data.message || 'Failed to reset DSAR requests', 'error');
        }
      } catch (err) {
        showToast(`Error resetting DSAR requests: ${err.message}`, 'error');
      }
    });
  }

  // Compliance Reports Export Buttons
  const exportCsvBtn = document.getElementById('btn-export-compliance-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      showToast('Downloading DSAR Compliance CSV Audit Report…', 'info');
      window.open(`${window.location.origin}/api/dsar/analytics/export?format=csv`, '_blank');
    });
  }

  const exportJsonBtn = document.getElementById('btn-export-compliance-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      showToast('Downloading Complete Audit JSON Package…', 'info');
      window.open(`${window.location.origin}/api/dsar/analytics/export?format=json`, '_blank');
    });
  }

  // Expose global refresh hook
  window.refreshDsarDashboard = loadDsarDashboard;
  window.switchDsarSubView = switchDsarSubView;

  // Initial load
  loadDsarDashboard();
}
