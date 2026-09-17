'use strict';

/**
 * Screen 6: Team Configuration & Statutory SLA Hub Controller
 * Manages:
 * - 8 Department Teams & Responsibilities matrix (Privacy, Data Eng, CRM, HR, Marketing, Legal, Vendor, Security)
 * - Live inline Statutory SLA Turnaround adjustment
 * - New Department Team registration modal
 * - Reset configuration to default master teams
 */

let allTeamsConfig = [];

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
 * Fetch and Render Team Configuration Table
 */
export async function loadTeamsConfig() {
  const tbody = document.getElementById('dsar-teams-config-tbody');
  const countBadge = document.getElementById('teams-config-count-badge');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/teams/config`);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.teams)) {
      allTeamsConfig = data.teams;
      if (countBadge) countBadge.textContent = `${allTeamsConfig.length} Teams`;
      renderTeamsConfigTable();
    } else {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No department teams configured yet.</td></tr>';
      }
    }
  } catch (err) {
    console.error('Error fetching team configurations:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--red);">Error loading teams: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

/**
 * Render Team Configuration Rows
 */
export function renderTeamsConfigTable() {
  const tbody = document.getElementById('dsar-teams-config-tbody');
  if (!tbody) return;

  if (allTeamsConfig.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No teams configured. Click "+ Add Team" to register a team.</td></tr>';
    return;
  }

  tbody.innerHTML = allTeamsConfig.map(team => {
    const teamId = escapeHtml(team.id || '');
    const icon = escapeHtml(team.icon || '👥');
    const name = escapeHtml(team.name || 'Department Team');
    const membersCount = parseInt(team.membersCount, 10) || 3;
    const systems = escapeHtml(team.systems || 'Internal Systems');
    const slaDays = parseInt(team.slaDays, 10) || 5;
    const desc = escapeHtml(team.description || '');

    return `
      <tr data-team-id="${teamId}" style="border-bottom:1px solid var(--border); transition:background 0.15s ease; vertical-align:middle;">
        <!-- Team Name & Icon -->
        <td style="padding:14px 16px;">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="font-size:1.35rem; line-height:1; padding-top:2px;">${icon}</div>
            <div>
              <div style="font-weight:700; color:var(--text-bright); font-size:0.92rem;">${name}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; line-height:1.4;">${desc}</div>
            </div>
          </div>
        </td>

        <!-- Members Allocation -->
        <td style="padding:14px 16px;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <span class="meta-pill" style="background:rgba(6,182,212,0.12); color:var(--cyan); border:1px solid rgba(6,182,212,0.25); font-weight:700; font-size:0.78rem;">
              👤 ${membersCount} Members
            </span>
          </div>
        </td>

        <!-- Connected Systems -->
        <td style="padding:14px 16px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-weight:600; color:var(--text-bright); font-size:0.85rem;">
              ${systems}
            </span>
          </div>
        </td>

        <!-- Statutory SLA Turnaround (Inline Editable) -->
        <td style="padding:14px 16px;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <input type="number" 
                   class="input-field input-team-sla" 
                   data-team-id="${teamId}" 
                   min="1" 
                   max="60" 
                   value="${slaDays}" 
                   style="width:64px; padding:5px 8px; font-weight:700; font-size:0.85rem; text-align:center; border-color:rgba(6,182,212,0.35); color:var(--cyan);">
            <span style="font-size:0.82rem; color:var(--text-secondary); font-weight:600;">days</span>
          </div>
        </td>

        <!-- Actions -->
        <td style="padding:14px 16px; text-align:right;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" 
                    class="btn-ghost btn-sm btn-save-team-sla" 
                    data-team-id="${teamId}" 
                    style="font-size:0.75rem; font-weight:700; color:var(--cyan); border-color:rgba(6,182,212,0.3); display:inline-flex; align-items:center; gap:4px; padding:5px 10px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Save SLA</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Handle Save SLA Turnaround for a Team
 */
async function saveTeamSla(teamId, newSlaDays) {
  const slaNum = parseInt(newSlaDays, 10);
  if (isNaN(slaNum) || slaNum <= 0) {
    showToast('Please enter a valid positive number of SLA days', 'error');
    return;
  }

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/teams/config/${encodeURIComponent(teamId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slaDays: slaNum })
    });
    const data = await res.json();

    if (data && data.success) {
      showToast(`✓ SLA turnaround updated to ${slaNum} days`, 'success');
      await loadTeamsConfig();
    } else {
      showToast(data.message || 'Failed to update SLA turnaround', 'error');
    }
  } catch (err) {
    showToast(`Network error saving SLA: ${err.message}`, 'error');
  }
}

/**
 * Open/Close Add Team Modal
 */
function openAddTeamModal() {
  const modal = document.getElementById('modal-add-team');
  if (modal) {
    modal.classList.remove('hidden');
    const nameInput = document.getElementById('new-team-name');
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
    const systemsInput = document.getElementById('new-team-systems');
    if (systemsInput) systemsInput.value = '';
    const descInput = document.getElementById('new-team-desc');
    if (descInput) descInput.value = '';
    const membersInput = document.getElementById('new-team-members-count');
    if (membersInput) membersInput.value = '3';
    const slaInput = document.getElementById('new-team-sla');
    if (slaInput) slaInput.value = '5';
  }
}

function closeAddTeamModal() {
  const modal = document.getElementById('modal-add-team');
  if (modal) modal.classList.add('hidden');
}

/**
 * Handle Submit New Team
 */
async function handleCreateTeam() {
  const name = document.getElementById('new-team-name')?.value?.trim();
  const icon = document.getElementById('new-team-icon')?.value || '👥';
  const membersCount = parseInt(document.getElementById('new-team-members-count')?.value, 10) || 3;
  const slaDays = parseInt(document.getElementById('new-team-sla')?.value, 10) || 5;
  const systems = document.getElementById('new-team-systems')?.value?.trim() || 'Internal Systems';
  const description = document.getElementById('new-team-desc')?.value?.trim() || 'Departmental privacy and data compliance team.';

  if (!name) {
    showToast('Please enter a team name', 'error');
    return;
  }

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/teams/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, membersCount, slaDays, systems, description })
    });
    const data = await res.json();

    if (data && data.success) {
      showToast(`✓ Department team '${name}' created successfully`, 'success');
      closeAddTeamModal();
      await loadTeamsConfig();
    } else {
      showToast(data.message || 'Failed to create team', 'error');
    }
  } catch (err) {
    showToast(`Error creating team: ${err.message}`, 'error');
  }
}

/**
 * Handle Reset Teams Configuration to Default 8 Master Teams
 */
async function handleResetTeamsConfig() {
  try {
    showToast('Resetting team configurations to default 8 master teams…', 'info');
    const res = await fetch(`${window.location.origin}/api/dsar/teams/config/reset`, { method: 'POST' });
    const data = await res.json();

    if (data && data.success) {
      showToast('✓ Teams configuration reset to defaults', 'success');
      await loadTeamsConfig();
    } else {
      showToast(data.message || 'Failed to reset teams', 'error');
    }
  } catch (err) {
    showToast(`Error resetting teams: ${err.message}`, 'error');
  }
}

/**
 * Initialize Screen 6 Controller
 */
export function initDsarTeamConfig() {
  // Add Team Modal Triggers
  const openModalBtn = document.getElementById('btn-open-add-team-modal');
  if (openModalBtn) openModalBtn.addEventListener('click', openAddTeamModal);

  const closeModalBtn = document.getElementById('btn-close-add-team-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeAddTeamModal);

  const cancelModalBtn = document.getElementById('btn-cancel-add-team');
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeAddTeamModal);

  const modalBackdrop = document.getElementById('modal-add-team-backdrop');
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeAddTeamModal);

  const submitAddTeamBtn = document.getElementById('btn-submit-add-team');
  if (submitAddTeamBtn) submitAddTeamBtn.addEventListener('click', handleCreateTeam);

  // Reset Teams Config Trigger
  const resetBtn = document.getElementById('btn-reset-teams-config');
  if (resetBtn) resetBtn.addEventListener('click', handleResetTeamsConfig);

  // Delegated event for Save SLA button
  document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.btn-save-team-sla');
    if (saveBtn) {
      const teamId = saveBtn.dataset.teamId;
      const row = saveBtn.closest('tr');
      const slaInput = row ? row.querySelector('.input-team-sla') : null;
      if (teamId && slaInput) {
        saveTeamSla(teamId, slaInput.value);
      }
    }
  });

  // Delegated event for SLA input Enter key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('input-team-sla')) {
      const teamId = e.target.dataset.teamId;
      if (teamId) {
        saveTeamSla(teamId, e.target.value);
      }
    }
  });

  // Expose global methods
  window.openDsarTeamConfig = () => {
    if (window.switchDsarSubView) {
      window.switchDsarSubView('team_config');
    }
  };
  window.loadTeamsConfig = loadTeamsConfig;

  // Initial load
  loadTeamsConfig();
}
