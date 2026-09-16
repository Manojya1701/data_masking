'use strict';

/**
 * DSAR Team Assignment & Task Detail Controller
 * Manages:
 * - Screen 4: Team Assignment & Task Distribution (6 teams, leads, task distribution breakdown)
 * - Screen 5: Individual Task Detail Workspace (Instructions checklist, Evidence attachments, Comments, History)
 * - Live Status toggling, evidence upload, comment posting, and seamless back/forward navigation
 */

let currentAssignmentRequestId = null;
let currentSubtaskId = null;
let returnScreen = 'screen4'; // 'screen4' or 'screen3'

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
 * Format Status Badge
 */
function formatStatusBadge(status) {
  const s = (status || 'In Progress').toLowerCase();
  if (s.includes('complet') || s.includes('closed') || s.includes('approved')) {
    return '<span class="meta-pill badge-verified" style="font-size:0.75rem; font-weight:700;">✓ Completed</span>';
  }
  if (s.includes('in progress') || s.includes('progress')) {
    return '<span class="meta-pill" style="background:rgba(6,182,212,0.15); color:var(--cyan); border:1px solid rgba(6,182,212,0.35); font-weight:700; font-size:0.75rem;">⏳ In Progress</span>';
  }
  if (s.includes('review')) {
    return '<span class="meta-pill" style="background:rgba(139,92,246,0.15); color:#a78bfa; border:1px solid rgba(139,92,246,0.35); font-weight:700; font-size:0.75rem;">⚖️ Under Review</span>';
  }
  return '<span class="meta-pill" style="background:rgba(245,158,11,0.15); color:var(--amber); border:1px solid rgba(245,158,11,0.35); font-weight:700; font-size:0.75rem;">⏳ Not Started</span>';
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

// ══════════════════════════════════════════════════════════════════════════════
// ── SCREEN 4: TEAM ASSIGNMENT & TASK DISTRIBUTION ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Open Screen 4: Team Assignment View
 */
export async function openDsarAssignmentView(requestId) {
  currentAssignmentRequestId = requestId || 'DSAR-2026-000125';

  const assignmentSection = document.getElementById('dsar-task-assignment-view');
  const detailSection = document.getElementById('dsar-ticket-detail-view');
  const subtaskSection = document.getElementById('dsar-subtask-detail-view');
  const dashSection = document.getElementById('dsar-dashboard-workspace');
  const pipelineSection = document.getElementById('dsar-deep-pipeline-section');

  if (detailSection) detailSection.classList.add('hidden');
  if (subtaskSection) subtaskSection.classList.add('hidden');
  if (dashSection) dashSection.classList.add('hidden');
  if (pipelineSection) pipelineSection.classList.add('hidden');

  if (assignmentSection) {
    assignmentSection.classList.remove('hidden');
    assignmentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Header lockup
  const backLabel = document.getElementById('assignment-back-label');
  const reqPill = document.getElementById('assignment-request-pill');
  if (backLabel) backLabel.textContent = `← ${currentAssignmentRequestId} > Task Assignment`;
  if (reqPill) reqPill.textContent = currentAssignmentRequestId;

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentAssignmentRequestId)}/assignments`);
    const data = await res.json();

    if (data && data.success) {
      // Banner
      const bannerDesc = document.getElementById('assignment-banner-desc');
      if (bannerDesc && data.banner) {
        bannerDesc.textContent = data.banner.message;
      }

      // Teams list
      renderAssignmentTeamsList(data.teams || []);
    } else {
      showToast(data.message || 'Failed to load task assignments', 'error');
    }
  } catch (err) {
    showToast(`Error loading task assignments: ${err.message}`, 'error');
  }
}

/**
 * Render Screen 4 Teams List (Matching Mockup 4)
 */
function renderAssignmentTeamsList(teams) {
  const container = document.getElementById('assignment-teams-list');
  if (!container) return;

  if (teams.length === 0) {
    container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">No teams assigned yet.</div>';
    return;
  }

  container.innerHTML = teams.map(t => {
    const taskId = escapeHtml(t.taskId);
    const teamName = escapeHtml(t.team);
    const icon = escapeHtml(t.teamIcon || '👥');
    const lead = escapeHtml(t.lead || `${t.assignee} (Lead)`);
    const assignedTask = escapeHtml(t.assignedTask);
    const systems = escapeHtml(t.systems || 'Connected Systems');
    const color = t.teamColor || '#06b6d4';

    return `
      <div class="assignment-team-row" data-task-id="${taskId}" style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--bg-input); border:1px solid var(--border); border-radius:10px; transition:all var(--dur) ease; cursor:pointer;" onmouseover="this.style.borderColor='rgba(6,182,212,0.5)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='none';">
        
        <!-- Left: Team Badge & Lead -->
        <div style="display:flex; align-items:center; gap:16px; min-width:240px;">
          <div style="width:42px; height:42px; border-radius:10px; background:${color}22; border:1px solid ${color}55; color:${color}; font-size:1.25rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            ${icon}
          </div>
          <div>
            <div style="font-weight:700; color:var(--text-bright); font-size:0.95rem;">${teamName}</div>
            <div style="font-size:0.78rem; color:var(--cyan); font-weight:600; margin-top:2px;">${lead}</div>
          </div>
        </div>

        <!-- Middle: Assigned Task & Systems -->
        <div style="flex:1; padding:0 20px; min-width:220px;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.04em;">Assigned Task</div>
          <div style="font-weight:700; color:var(--text-bright); font-size:0.9rem; margin-top:2px;">${assignedTask}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">🗄️ ${systems}</div>
        </div>

        <!-- Right: Status & Action Chevron -->
        <div style="display:flex; align-items:center; gap:14px;">
          ${formatPriorityBadge(t.priority)}
          ${formatStatusBadge(t.status)}
          
          <button type="button" class="btn-open-individual-task" data-task-id="${taskId}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:6px; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Open Task Workspace">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

      </div>
    `;
  }).join('');
}


// ══════════════════════════════════════════════════════════════════════════════
// ── SCREEN 5: TASK DETAIL VIEW (INDIVIDUAL TASK WORKSPACE) ────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Open Screen 5: Individual Task Workspace
 */
export async function openIndividualSubtaskView(requestId, taskId, fromScreen = 'screen4') {
  currentAssignmentRequestId = requestId || currentAssignmentRequestId || 'DSAR-2026-000125';
  currentSubtaskId = taskId || 'task_1';
  returnScreen = fromScreen;

  const assignmentSection = document.getElementById('dsar-task-assignment-view');
  const detailSection = document.getElementById('dsar-ticket-detail-view');
  const subtaskSection = document.getElementById('dsar-subtask-detail-view');
  const dashSection = document.getElementById('dsar-dashboard-workspace');
  const pipelineSection = document.getElementById('dsar-deep-pipeline-section');

  if (assignmentSection) assignmentSection.classList.add('hidden');
  if (detailSection) detailSection.classList.add('hidden');
  if (dashSection) dashSection.classList.add('hidden');
  if (pipelineSection) pipelineSection.classList.add('hidden');

  if (subtaskSection) {
    subtaskSection.classList.remove('hidden');
    subtaskSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentAssignmentRequestId)}/subtasks/${encodeURIComponent(currentSubtaskId)}/detail`);
    const data = await res.json();

    if (data && data.success && data.task) {
      renderSubtaskWorkspace(data.task, data.requester);
    } else {
      showToast(data.message || 'Failed to load subtask details', 'error');
    }
  } catch (err) {
    showToast(`Error loading subtask: ${err.message}`, 'error');
  }
}

/**
 * Populate Screen 5 Workspace fields
 */
function renderSubtaskWorkspace(task, requester) {
  // Title & description
  const titleEl = document.getElementById('subtask-detail-title');
  const descEl = document.getElementById('subtask-detail-desc');
  const iconEl = document.getElementById('subtask-detail-team-icon');
  const statusPill = document.getElementById('subtask-detail-status-pill');

  if (titleEl) titleEl.textContent = task.task;
  if (descEl) descEl.textContent = task.description;
  if (iconEl) iconEl.textContent = task.teamIcon || '📋';
  if (statusPill) {
    statusPill.innerHTML = formatStatusBadge(task.status);
  }

  // Meta Grid
  const metaTeam = document.getElementById('subtask-meta-team');
  const metaAssignee = document.getElementById('subtask-meta-assignee');
  const metaPriority = document.getElementById('subtask-meta-priority');
  const metaDueDate = document.getElementById('subtask-meta-due-date');
  const metaDataSources = document.getElementById('subtask-meta-datasources');
  const metaSystems = document.getElementById('subtask-meta-systems');
  const footerOperator = document.getElementById('subtask-footer-operator');

  if (metaTeam) metaTeam.textContent = task.team;
  if (metaAssignee) metaAssignee.textContent = task.assignee;
  if (metaPriority) metaPriority.innerHTML = formatPriorityBadge(task.priority);
  if (metaDueDate) metaDueDate.textContent = task.due_date;
  if (metaDataSources) metaDataSources.textContent = task.dataSources || 'CRM, Customer DB';
  if (metaSystems) metaSystems.textContent = task.systems || 'Salesforce, Oracle';
  if (footerOperator) footerOperator.textContent = `${task.assignee} (${task.team} Lead)`;

  // Complete button state
  const completeBtn = document.getElementById('btn-mark-subtask-complete');
  if (completeBtn) {
    if (task.status === 'Completed') {
      completeBtn.disabled = true;
      completeBtn.innerHTML = '<span>Task Completed ✓</span>';
      completeBtn.style.opacity = '0.7';
    } else {
      completeBtn.disabled = false;
      completeBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Mark as Complete</span>';
      completeBtn.style.opacity = '1';
    }
  }

  // Render Inner Tab 1: Instructions Checklist
  renderInstructionsChecklist(task.instructions || []);

  // Render Inner Tab 2: Evidence List
  renderEvidenceList(task.evidence || []);

  // Render Inner Tab 3: Comments List
  renderCommentsList(task.comments || []);

  // Render Inner Tab 4: History List
  renderHistoryList(task.history || []);

  // Set default tab to instructions
  switchSubtaskTab('instructions');
}

/**
 * Render Instructions Checklist (Matching Mockup 5)
 */
function renderInstructionsChecklist(instructions) {
  const container = document.getElementById('subtask-instructions-list');
  if (!container) return;

  if (instructions.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No instructions assigned for this task.</div>';
    return;
  }

  container.innerHTML = instructions.map((item, idx) => {
    const isDone = Boolean(item.done);
    const num = idx + 1;
    return `
      <label style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--bg-card); border:1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'var(--border)'}; border-radius:8px; cursor:pointer; transition:all var(--dur) ease;">
        <input type="checkbox" class="instruction-checkbox" data-index="${idx}" ${isDone ? 'checked' : ''} style="margin-top:3px; accent-color:var(--cyan); cursor:pointer; width:16px; height:16px;">
        <div style="flex:1;">
          <div style="font-size:0.86rem; color:${isDone ? 'var(--text-muted)' : 'var(--text-bright)'}; text-decoration:${isDone ? 'line-through' : 'none'}; font-weight:${isDone ? '500' : '600'}; line-height:1.4;">
            <strong style="color:var(--cyan); margin-right:4px;">${num}.</strong> ${escapeHtml(item.text)}
          </div>
        </div>
      </label>
    `;
  }).join('');
}

/**
 * Render Evidence Files
 */
function renderEvidenceList(evidence) {
  const container = document.getElementById('subtask-evidence-list');
  if (!container) return;

  if (evidence.length === 0) {
    container.innerHTML = `
      <div style="padding:20px; text-align:center; background:var(--bg-input); border:1px dashed var(--border); border-radius:8px; color:var(--text-muted); font-size:0.85rem;">
        No evidence files attached yet. Click "+ Attach Verification Export" to upload database query logs or CSV dumps.
      </div>
    `;
    return;
  }

  container.innerHTML = evidence.map(ev => {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.2rem;">📎</span>
          <div>
            <div style="font-weight:700; color:var(--text-bright); font-size:0.85rem;">${escapeHtml(ev.name)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(ev.size)} • Uploaded by ${escapeHtml(ev.uploadedBy)} • ${escapeHtml(ev.uploadedAt)}</div>
          </div>
        </div>
        <span class="meta-pill badge-verified" style="font-size:0.72rem;">✓ Verified</span>
      </div>
    `;
  }).join('');
}

/**
 * Render Comments Stream
 */
function renderCommentsList(comments) {
  const container = document.getElementById('subtask-comments-list');
  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">No comments added to this task yet.</div>';
    return;
  }

  container.innerHTML = comments.map(c => {
    return `
      <div style="padding:12px 14px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; border-left:3px solid var(--cyan);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:var(--text-bright); font-size:0.85rem;">${escapeHtml(c.author)} <span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">(${escapeHtml(c.role)})</span></strong>
          <span style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(c.time)}</span>
        </div>
        <div style="font-size:0.84rem; color:var(--text-secondary); line-height:1.4;">${escapeHtml(c.text)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render Audit History
 */
function renderHistoryList(history) {
  const container = document.getElementById('subtask-history-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No history recorded.</div>';
    return;
  }

  container.innerHTML = history.map(h => {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-card); border-radius:6px; font-size:0.8rem;">
        <span style="color:var(--text-bright); font-weight:600;">${escapeHtml(h.action)}</span>
        <span style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(h.timestamp)} • ${escapeHtml(h.actor || 'System')}</span>
      </div>
    `;
  }).join('');
}

/**
 * Switch Screen 5 Subtask Inner Tabs
 */
function switchSubtaskTab(tabKey) {
  document.querySelectorAll('.subtask-inner-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabKey) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const tabPanels = {
    instructions: document.getElementById('subtask-panel-instructions'),
    evidence: document.getElementById('subtask-panel-evidence'),
    comments: document.getElementById('subtask-panel-comments'),
    history: document.getElementById('subtask-panel-history')
  };

  Object.entries(tabPanels).forEach(([key, panel]) => {
    if (panel) {
      if (key === tabKey) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    }
  });
}

/**
 * Initialize Screen 4 & Screen 5 Event Listeners
 */
export function initDsarAssignment() {
  // Screen 4: Back button
  const assignmentBackBtn = document.getElementById('btn-assignment-back');
  if (assignmentBackBtn) {
    assignmentBackBtn.addEventListener('click', () => {
      const assignmentSection = document.getElementById('dsar-task-assignment-view');
      const detailSection = document.getElementById('dsar-ticket-detail-view');
      if (assignmentSection) assignmentSection.classList.add('hidden');
      if (detailSection) {
        detailSection.classList.remove('hidden');
        detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Screen 4: "View Generated Tasks" button
  const viewTasksBtn = document.getElementById('btn-assignment-view-tasks');
  if (viewTasksBtn) {
    viewTasksBtn.addEventListener('click', () => {
      openIndividualSubtaskView(currentAssignmentRequestId, 'task_1', 'screen4');
    });
  }

  // Screen 4: Click delegation on team rows / chevrons -> open Screen 5
  document.addEventListener('click', (e) => {
    const teamRow = e.target.closest('.assignment-team-row');
    if (teamRow && !e.target.closest('select')) {
      const taskId = teamRow.dataset.taskId;
      if (taskId) {
        openIndividualSubtaskView(currentAssignmentRequestId, taskId, 'screen4');
      }
    }
  });

  // Screen 5: Back button
  const subtaskBackBtn = document.getElementById('btn-subtask-back');
  if (subtaskBackBtn) {
    subtaskBackBtn.addEventListener('click', () => {
      const subtaskSection = document.getElementById('dsar-subtask-detail-view');
      if (subtaskSection) subtaskSection.classList.add('hidden');

      if (returnScreen === 'screen3') {
        const detailSection = document.getElementById('dsar-ticket-detail-view');
        if (detailSection) {
          detailSection.classList.remove('hidden');
          detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        const assignmentSection = document.getElementById('dsar-task-assignment-view');
        if (assignmentSection) {
          assignmentSection.classList.remove('hidden');
          assignmentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // Screen 5: Inner tab buttons
  document.querySelectorAll('.subtask-inner-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.tab;
      if (tabKey) switchSubtaskTab(tabKey);
    });
  });

  // Screen 5: Instruction checkbox toggles
  document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('instruction-checkbox')) {
      const idx = e.target.dataset.index;
      const completed = e.target.checked;
      if (currentAssignmentRequestId && currentSubtaskId && idx !== undefined) {
        try {
          const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentAssignmentRequestId)}/subtasks/${encodeURIComponent(currentSubtaskId)}/instructions/${idx}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed })
          });
          const data = await res.json();
          if (data && data.success && data.task) {
            renderInstructionsChecklist(data.task.instructions || []);
            renderHistoryList(data.task.history || []);
            showToast('✓ Step updated', 'success');
          }
        } catch (err) {
          showToast(`Error updating checklist: ${err.message}`, 'error');
        }
      }
    }
  });

  // Screen 5: Mark as Complete button
  const completeBtn = document.getElementById('btn-mark-subtask-complete');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      if (!currentAssignmentRequestId || !currentSubtaskId) return;
      try {
        const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentAssignmentRequestId)}/subtasks/${encodeURIComponent(currentSubtaskId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Completed' })
        });
        const data = await res.json();
        if (data && data.success) {
          showToast('✓ Subtask marked as COMPLETED!', 'success');
          openIndividualSubtaskView(currentAssignmentRequestId, currentSubtaskId, returnScreen);
        } else {
          showToast(data.message || 'Failed to complete subtask', 'error');
        }
      } catch (err) {
        showToast(`Error completing subtask: ${err.message}`, 'error');
      }
    });
  }

  // Screen 5: Post Comment button
  const postCommentBtn = document.getElementById('btn-submit-subtask-comment');
  const commentInput = document.getElementById('subtask-comment-input');
  if (postCommentBtn && commentInput) {
    const handleAddComment = async () => {
      const text = commentInput.value.trim();
      if (!text) return;
      try {
        const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentAssignmentRequestId)}/subtasks/${encodeURIComponent(currentSubtaskId)}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, author: 'Current Operator', role: 'Privacy Team' })
        });
        const data = await res.json();
        if (data && data.success && data.task) {
          commentInput.value = '';
          renderCommentsList(data.task.comments || []);
          renderHistoryList(data.task.history || []);
          showToast('✓ Comment added', 'success');
        }
      } catch (err) {
        showToast(`Error posting comment: ${err.message}`, 'error');
      }
    };

    postCommentBtn.addEventListener('click', handleAddComment);
    commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAddComment();
    });
  }

  // Screen 5: Attach Sample Evidence button
  const addEvBtn = document.getElementById('btn-add-sample-evidence');
  if (addEvBtn) {
    addEvBtn.addEventListener('click', async () => {
      if (!currentAssignmentRequestId || !currentSubtaskId) return;
      try {
        const sampleName = `${currentSubtaskId}_database_audit_dump_${Date.now().toString().slice(-4)}.csv`;
        const res = await fetch(`${window.location.origin}/api/dsar/requests/${encodeURIComponent(currentAssignmentRequestId)}/subtasks/${encodeURIComponent(currentSubtaskId)}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sampleName, size: '28.2 KB', uploadedBy: 'Current Operator' })
        });
        const data = await res.json();
        if (data && data.success && data.task) {
          renderEvidenceList(data.task.evidence || []);
          renderHistoryList(data.task.history || []);
          showToast(`✓ Attached evidence: ${sampleName}`, 'success');
        }
      } catch (err) {
        showToast(`Error attaching evidence: ${err.message}`, 'error');
      }
    });
  }

  // Expose global hooks
  window.openDsarAssignmentView = openDsarAssignmentView;
  window.openIndividualSubtaskView = openIndividualSubtaskView;
}
