'use strict';

/**
 * Privacy Data Deletion Module (Dedicated Section & Confirmation Modal)
 * Fetches records from privacy_deletion_customers table, renders separate table,
 * opens confirmation modal with auto-populated email, executes DELETE /api/privacy-deletion/customers/:id,
 * displays toast notification, and reloads table state upon success.
 */

import { showToast } from './toast.js';

let pendingDeleteCustomer = null;

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
    tableBody.innerHTML = '<tr><td colspan="5" class="history-empty">No customer records in deletion database. All personal data erased.</td></tr>';
    return;
  }

  const rowsHtml = records.map(rec => `
    <tr data-customer-id="${escapeHtml(rec.id)}">
      <td style="font-weight: 700; color: var(--text-muted);">${escapeHtml(rec.id)}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.first_name)}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.last_name)}</td>
      <td><code style="color: var(--cyan);">${escapeHtml(rec.email)}</code></td>
      <td>
        <button type="button" 
                class="btn-danger btn-sm btn-delete-privacy-customer" 
                data-id="${escapeHtml(rec.id)}" 
                data-email="${escapeHtml(rec.email)}" 
                data-firstname="${escapeHtml(rec.first_name)}" 
                data-lastname="${escapeHtml(rec.last_name)}">
          DELETE
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

export function openPrivacyDeleteModal(id, email, firstName, lastName) {
  pendingDeleteCustomer = { id, email, firstName, lastName };
  const modal = document.getElementById('privacy-deletion-modal');
  const emailEl = document.getElementById('privacy-deletion-selected-email');
  const idLabel = document.getElementById('privacy-deletion-selected-id');

  if (emailEl) emailEl.textContent = email || '—';
  if (idLabel) idLabel.textContent = String(id);
  if (modal) modal.classList.remove('hidden');
}

export function closePrivacyDeleteModal() {
  pendingDeleteCustomer = null;
  const modal = document.getElementById('privacy-deletion-modal');
  if (modal) modal.classList.add('hidden');
}

export async function confirmPrivacyCustomerDeletion() {
  if (!pendingDeleteCustomer || !pendingDeleteCustomer.id) {
    closePrivacyDeleteModal();
    return;
  }

  const targetId = pendingDeleteCustomer.id;
  const confirmBtn = document.getElementById('btn-confirm-privacy-delete');

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const resp = await fetch(`${window.location.origin}/api/privacy-deletion/customers/${targetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      closePrivacyDeleteModal();
      showToast('Personal data deleted successfully.', 'success');
      await loadPrivacyDeletionCustomers();
    } else {
      showToast(`Deletion Failed: ${data.message || data.error || 'Failed to delete customer'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error during deletion: ${err.message}`, 'error');
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

export function initPrivacyDeletion() {
  // Document-level delegated click listener for all Privacy Data Deletion actions
  document.addEventListener('click', (e) => {
    // 1. Delete button on row
    const deleteBtn = e.target.closest('.btn-delete-privacy-customer');
    if (deleteBtn) {
      e.preventDefault();
      const id = deleteBtn.getAttribute('data-id');
      const email = deleteBtn.getAttribute('data-email');
      const fName = deleteBtn.getAttribute('data-firstname');
      const lName = deleteBtn.getAttribute('data-lastname');
      openPrivacyDeleteModal(id, email, fName, lName);
      return;
    }

    // 2. Cancel / Close buttons on modal
    const cancelTrigger = e.target.closest('#btn-cancel-privacy-delete, #btn-cancel-privacy-delete-x, #privacy-deletion-backdrop');
    if (cancelTrigger) {
      e.preventDefault();
      closePrivacyDeleteModal();
      return;
    }

    // 3. Confirm Delete button
    const confirmTrigger = e.target.closest('#btn-confirm-privacy-delete');
    if (confirmTrigger) {
      e.preventDefault();
      confirmPrivacyCustomerDeletion();
      return;
    }

    // 4. Refresh Records button
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
        closePrivacyDeleteModal();
      }
    }
  });

  // Initial table load
  loadPrivacyDeletionCustomers();
}
