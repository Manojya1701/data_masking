'use strict';

/**
 * Creative Privacy Data Management Workspace Module
 * Supports ALL 8 Privacy Techniques (Mask, Token, Anonymize, Pseudonym, Redact, Encrypt, Hash, Delete)
 * Live Before vs After previews, interactive operation workspace modal, and parameterized database updates.
 */

import { showToast } from './toast.js';

let pendingRecord = null; // { id, firstName, lastName, email }
let currentOpMode = 'masking';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function computeClientPreview(fName, lName, emailVal, op) {
  const customerId = pendingRecord ? pendingRecord.id : 1;
  let newF = fName;
  let newL = lName;
  let newE = emailVal;
  let tag = op.toUpperCase();

  if (op === 'masking') {
    newF = fName ? `${fName[0]}***${fName[fName.length - 1] || ''}` : '***';
    newL = lName ? `${lName[0]}***${lName[lName.length - 1] || ''}` : '***';
    const parts = (emailVal || '').split('@');
    if (parts.length === 2) {
      newE = `${parts[0][0]}****@${parts[1]}`;
    } else {
      newE = '****@privacy.invalid';
    }
  } else if (op === 'tokenization') {
    newF = `TKN_FIRST_${customerId}A9`;
    newL = `TKN_LAST_${customerId}A9`;
    newE = `TKN_EMAIL_${customerId}A9@token.invalid`;
  } else if (op === 'anonymization') {
    newF = 'Anonymous';
    newL = 'User';
    newE = `anonymized_${customerId}@privacy.invalid`;
  } else if (op === 'pseudonymization') {
    const num = String(customerId).padStart(3, '0');
    newF = `PERSON_${num}`;
    newL = `USER_${num}`;
    newE = `EMAIL_${num}@domain.invalid`;
  } else if (op === 'redaction') {
    newF = '[REDACTED]';
    newL = '[REDACTED]';
    newE = '[REDACTED]';
  } else if (op === 'encryption') {
    newF = `ENC_AES256_9a8f:${customerId}e1…`;
    newL = `ENC_AES256_9a8f:${customerId}e2…`;
    newE = `ENC_AES256_9a8f:${customerId}e3…`;
  } else if (op === 'hashing') {
    newF = `e3b0c44298fc1c14...`;
    newL = `e3b0c44298fc1c14...`;
    newE = `8f4b68f3a2c91b5c...`;
  } else if (op === 'deletion') {
    newF = '❌ DELETED FROM DB';
    newL = '❌ DELETED FROM DB';
    newE = '❌ DELETED FROM DB';
    tag = 'PERMANENT DELETION';
  }

  return { newF, newL, newE, tag };
}

function renderDeletionTable(records) {
  const tableBody = document.getElementById('privacy-deletion-table-body');
  if (!tableBody) return;

  if (!records || records.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="history-empty">No customer records in database table. All personal data processed.</td></tr>';
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
                class="btn-primary btn-sm btn-open-privacy-workspace" 
                data-id="${escapeHtml(rec.id)}" 
                data-email="${escapeHtml(rec.email)}" 
                data-firstname="${escapeHtml(rec.first_name)}" 
                data-lastname="${escapeHtml(rec.last_name)}"
                style="padding: 5px 12px; font-size:0.78rem;">
          ⚡ Apply Technique
        </button>
        <button type="button" 
                class="btn-danger btn-sm btn-delete-privacy-customer" 
                data-id="${escapeHtml(rec.id)}" 
                data-email="${escapeHtml(rec.email)}" 
                data-firstname="${escapeHtml(rec.first_name)}" 
                data-lastname="${escapeHtml(rec.last_name)}"
                style="margin-left: 6px; padding: 5px 10px; font-size:0.78rem;">
          Delete
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
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="history-empty">Failed to load customer records.</td></tr>`;
    }
  } catch (err) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="history-empty">Error fetching customers (${escapeHtml(err.message)})</td></tr>`;
  }
}

export function updateModalPreview(op) {
  currentOpMode = op;

  // Update tabs active state
  const tabs = document.querySelectorAll('.privacy-op-tab');
  tabs.forEach(t => {
    if (t.getAttribute('data-op') === op) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  if (!pendingRecord) return;

  const { firstName, lastName, email } = pendingRecord;
  const { newF, newL, newE, tag } = computeClientPreview(firstName, lastName, email, op);

  const tagEl = document.getElementById('privacy-preview-technique-tag');
  const afterFname = document.getElementById('privacy-preview-after-fname');
  const afterLname = document.getElementById('privacy-preview-after-lname');
  const afterEmail = document.getElementById('privacy-preview-after-email');
  const promptText = document.getElementById('privacy-deletion-prompt-text');
  const confirmBtn = document.getElementById('btn-confirm-privacy-delete');

  if (tagEl) tagEl.textContent = tag;
  if (afterFname) afterFname.textContent = newF;
  if (afterLname) afterLname.textContent = newL;
  if (afterEmail) afterEmail.textContent = newE;

  if (op === 'deletion') {
    if (promptText) promptText.textContent = '⚠️ Permanent Erasure: Clicking confirm will permanently DELETE this customer record from PostgreSQL database tables.';
    if (confirmBtn) {
      confirmBtn.className = 'btn-danger btn-sm';
      confirmBtn.innerHTML = '<span>CONFIRM PERMANENT DELETION</span>';
    }
  } else {
    if (promptText) promptText.textContent = `Clicking confirm will apply ${op.toUpperCase()} and save updated protected values directly to the database.`;
    if (confirmBtn) {
      confirmBtn.className = 'btn-primary btn-sm';
      confirmBtn.innerHTML = `<span>CONFIRM ${op.toUpperCase()} & SAVE</span>`;
    }
  }
}

export function openPrivacyActionModal(initialOp, id, email, firstName, lastName) {
  pendingRecord = { id, email, firstName, lastName };
  
  const modal = document.getElementById('privacy-deletion-modal');
  const idLabel = document.getElementById('privacy-deletion-selected-id');
  const beforeFname = document.getElementById('privacy-preview-before-fname');
  const beforeLname = document.getElementById('privacy-preview-before-lname');
  const selectedEmail = document.getElementById('privacy-deletion-selected-email');

  if (idLabel) idLabel.textContent = String(id);
  if (beforeFname) beforeFname.textContent = firstName || '—';
  if (beforeLname) beforeLname.textContent = lastName || '—';
  if (selectedEmail) selectedEmail.textContent = email || '—';

  updateModalPreview(initialOp || 'masking');

  if (modal) modal.classList.remove('hidden');
}

export function closePrivacyActionModal() {
  pendingRecord = null;
  const modal = document.getElementById('privacy-deletion-modal');
  if (modal) modal.classList.add('hidden');
}

export async function confirmPrivacyCustomerAction() {
  if (!pendingRecord || !pendingRecord.id) {
    closePrivacyActionModal();
    return;
  }

  const { id } = pendingRecord;
  const op = currentOpMode;
  const confirmBtn = document.getElementById('btn-confirm-privacy-delete');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const endpoint = `${window.location.origin}/api/privacy-deletion/customers/${id}/apply-operation`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: op }),
    });

    const data = await resp.json();

    if (resp.ok && data.success) {
      closePrivacyActionModal();
      showToast(`✓ ${op.toUpperCase()} applied & saved to database successfully!`, 'success');
      await loadPrivacyDeletionCustomers();
    } else {
      showToast(`Operation Failed: ${data.message || data.error || 'Action failed'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

export function initPrivacyDeletion() {
  document.addEventListener('click', (e) => {
    // 1. Open Workspace button on row
    const openBtn = e.target.closest('.btn-open-privacy-workspace');
    if (openBtn) {
      e.preventDefault();
      const id = openBtn.getAttribute('data-id');
      const email = openBtn.getAttribute('data-email');
      const fName = openBtn.getAttribute('data-firstname');
      const lName = openBtn.getAttribute('data-lastname');
      openPrivacyActionModal('masking', id, email, fName, lName);
      return;
    }

    // 2. Delete button on row
    const deleteBtn = e.target.closest('.btn-delete-privacy-customer');
    if (deleteBtn) {
      e.preventDefault();
      const id = deleteBtn.getAttribute('data-id');
      const email = deleteBtn.getAttribute('data-email');
      const fName = deleteBtn.getAttribute('data-firstname');
      const lName = deleteBtn.getAttribute('data-lastname');
      openPrivacyActionModal('deletion', id, email, fName, lName);
      return;
    }

    // 3. Privacy Operation Tab click inside modal
    const opTab = e.target.closest('.privacy-op-tab');
    if (opTab) {
      e.preventDefault();
      const selectedOp = opTab.getAttribute('data-op');
      if (selectedOp) updateModalPreview(selectedOp);
      return;
    }

    // 4. Cancel / Close buttons on modal
    const cancelTrigger = e.target.closest('#btn-cancel-privacy-delete, #btn-cancel-privacy-delete-x, #privacy-deletion-backdrop');
    if (cancelTrigger) {
      e.preventDefault();
      closePrivacyActionModal();
      return;
    }

    // 5. Confirm button
    const confirmTrigger = e.target.closest('#btn-confirm-privacy-delete');
    if (confirmTrigger) {
      e.preventDefault();
      confirmPrivacyCustomerAction();
      return;
    }

    // 6. Refresh Records button
    const refreshTrigger = e.target.closest('#btn-refresh-privacy-deletion');
    if (refreshTrigger) {
      e.preventDefault();
      showToast('Refreshing customer records…', 'info');
      loadPrivacyDeletionCustomers();
      return;
    }

    // 7. Reset 8 Sample Records button
    const resetTrigger = e.target.closest('#btn-reset-privacy-deletion');
    if (resetTrigger) {
      e.preventDefault();
      showToast('Resetting 8 sample customer records in database…', 'info');
      fetch(`${window.location.origin}/api/privacy-deletion/customers/reset`, { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            showToast('✓ All 8 sample customer records restored!', 'success');
            loadPrivacyDeletionCustomers();
          } else {
            showToast('Failed to reset records', 'error');
          }
        })
        .catch(err => showToast(`Error resetting records: ${err.message}`, 'error'));
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
