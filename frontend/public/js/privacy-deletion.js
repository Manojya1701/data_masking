'use strict';

/**
 * Privacy Data Deletion & Anonymization Module (Dedicated Section & Interactive Action Modal)
 * Fetches records from privacy_deletion_customers table, renders table with DELETE & ANONYMIZE options,
 * opens interactive modal allowing the user to select or confirm DELETE vs ANONYMIZE action.
 */

import { showToast } from './toast.js';

let pendingPrivacyAction = null; // { mode: 'delete'|'anonymize', id, email, firstName, lastName }

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderDeletionTable(records) {
  const tableBody = document.getElementById('privacy-deletion-table-body');
  if (!tableBody) return;

  if (!records || records.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="history-empty">No customer records in deletion database. All personal data processed.</td></tr>';
    return;
  }

  const rowsHtml = records.map(rec => `
    <tr data-customer-id="${escapeHtml(rec.id)}">
      <td style="font-weight: 700; color: var(--text-muted);">${escapeHtml(rec.id)}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.first_name)}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.last_name)}</td>
      <td><code style="color: var(--cyan);">${escapeHtml(rec.email)}</code></td>
      <td style="white-space: nowrap;">
        <button type="button" 
                class="btn-danger btn-sm btn-delete-privacy-customer" 
                data-id="${escapeHtml(rec.id)}" 
                data-email="${escapeHtml(rec.email)}" 
                data-firstname="${escapeHtml(rec.first_name)}" 
                data-lastname="${escapeHtml(rec.last_name)}">
          DELETE
        </button>
        <button type="button" 
                class="btn-ghost btn-sm btn-anonymize-privacy-customer" 
                data-id="${escapeHtml(rec.id)}" 
                data-email="${escapeHtml(rec.email)}" 
                data-firstname="${escapeHtml(rec.first_name)}" 
                data-lastname="${escapeHtml(rec.last_name)}"
                style="margin-left:6px; color:var(--cyan); border-color:rgba(6,182,212,0.4);">
          ANONYMIZE
        </button>
      </td>
    </tr>
  `).join('');

  tableBody.innerHTML = rowsHtml;
}

export async function loadPrivacyDeletionCustomers() {
  const tableBody = document.getElementById('privacy-deletion-table-body');
  try {
    const resp = await fetch(`${window.location.origin}/api/privacy-deletion/customers`);
    const data = await resp.json();

    if (data.success && Array.isArray(data.records)) {
      renderDeletionTable(data.records);
    } else {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="history-empty">Failed to load deletion customer records.</td></tr>`;
    }
  } catch (err) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="history-empty">Error fetching deletion customers (${escapeHtml(err.message)})</td></tr>`;
  }
}

export function openPrivacyActionModal(mode, id, email, firstName, lastName) {
  pendingPrivacyAction = { mode, id, email, firstName, lastName };
  const modal = document.getElementById('privacy-deletion-modal');
  const titleEl = document.getElementById('privacy-deletion-modal-title');
  const emailEl = document.getElementById('privacy-deletion-selected-email');
  const idLabel = document.getElementById('privacy-deletion-selected-id');
  const confirmBtn = document.getElementById('btn-confirm-privacy-delete');
  const modePromptText = document.getElementById('privacy-deletion-prompt-text');

  if (emailEl) emailEl.textContent = email || '—';
  if (idLabel) idLabel.textContent = String(id);

  if (mode === 'anonymize') {
    if (titleEl) titleEl.textContent = 'Anonymize Personal Data';
    if (modePromptText) modePromptText.textContent = 'Are you sure you want to ANONYMIZE this customer\'s personal data in the database?';
    if (confirmBtn) {
      confirmBtn.className = 'btn-primary btn-sm';
      confirmBtn.innerHTML = '<span>CONFIRM ANONYMIZE</span>';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Delete Personal Data';
    if (modePromptText) modePromptText.textContent = 'Are you sure you want to PERMANENTLY DELETE this customer\'s personal data?';
    if (confirmBtn) {
      confirmBtn.className = 'btn-danger btn-sm';
      confirmBtn.innerHTML = '<span>CONFIRM DELETE</span>';
    }
  }

  if (modal) modal.classList.remove('hidden');
}

export function closePrivacyActionModal() {
  pendingPrivacyAction = null;
  const modal = document.getElementById('privacy-deletion-modal');
  if (modal) modal.classList.add('hidden');
}

export async function confirmPrivacyCustomerAction() {
  if (!pendingPrivacyAction || !pendingPrivacyAction.id) {
    closePrivacyActionModal();
    return;
  }

  const { mode, id } = pendingPrivacyAction;
  const confirmBtn = document.getElementById('btn-confirm-privacy-delete');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const endpoint = mode === 'anonymize'
      ? `${window.location.origin}/api/privacy-deletion/customers/${id}/anonymize`
      : `${window.location.origin}/api/privacy-deletion/customers/${id}`;

    const method = mode === 'anonymize' ? 'PUT' : 'DELETE';

    const resp = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      closePrivacyActionModal();
      const msg = mode === 'anonymize'
        ? 'Personal data anonymized successfully.'
        : 'Personal data deleted successfully.';
      showToast(msg, 'success');
      await loadPrivacyDeletionCustomers();
    } else {
      showToast(`Operation Failed: ${data.message || data.error || 'Action failed'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error during action: ${err.message}`, 'error');
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

export function initPrivacyDeletion() {
  document.addEventListener('click', (e) => {
    // 1. Delete button on row
    const deleteBtn = e.target.closest('.btn-delete-privacy-customer');
    if (deleteBtn) {
      e.preventDefault();
      const id = deleteBtn.getAttribute('data-id');
      const email = deleteBtn.getAttribute('data-email');
      const fName = deleteBtn.getAttribute('data-firstname');
      const lName = deleteBtn.getAttribute('data-lastname');
      openPrivacyActionModal('delete', id, email, fName, lName);
      return;
    }

    // 2. Anonymize button on row
    const anonymizeBtn = e.target.closest('.btn-anonymize-privacy-customer');
    if (anonymizeBtn) {
      e.preventDefault();
      const id = anonymizeBtn.getAttribute('data-id');
      const email = anonymizeBtn.getAttribute('data-email');
      const fName = anonymizeBtn.getAttribute('data-firstname');
      const lName = anonymizeBtn.getAttribute('data-lastname');
      openPrivacyActionModal('anonymize', id, email, fName, lName);
      return;
    }

    // 3. Cancel / Close buttons on modal
    const cancelTrigger = e.target.closest('#btn-cancel-privacy-delete, #btn-cancel-privacy-delete-x, #privacy-deletion-backdrop');
    if (cancelTrigger) {
      e.preventDefault();
      closePrivacyActionModal();
      return;
    }

    // 4. Confirm Delete / Anonymize button
    const confirmTrigger = e.target.closest('#btn-confirm-privacy-delete');
    if (confirmTrigger) {
      e.preventDefault();
      confirmPrivacyCustomerAction();
      return;
    }

    // 5. Refresh Records button
    const refreshTrigger = e.target.closest('#btn-refresh-privacy-deletion');
    if (refreshTrigger) {
      e.preventDefault();
      showToast('Refreshing deletion customer records…', 'info');
      loadPrivacyDeletionCustomers();
      return;
    }
  });

  // Escape key handler to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('privacy-deletion-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closePrivacyActionModal();
      }
    }
  });

  // Initial table load
  loadPrivacyDeletionCustomers();
}
