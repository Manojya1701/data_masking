'use strict';

/**
 * Frontend Database Table Protection Module
 * Handles customer preview fetching, in-memory protection, optional persistence saving, and saved protected data display.
 */

import { showToast } from './toast.js';

let originalRecords = null;
let currentProtectedPreview = null;
let selectedOperation = 'masking';

export function selectOperation(op) {
  if (!op) return;
  selectedOperation = op;
  const cards = document.querySelectorAll('.db-op-card');
  cards.forEach(card => {
    const isSelected = card.getAttribute('data-op') === op;
    if (isSelected) {
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
    } else {
      card.classList.remove('selected');
      card.setAttribute('aria-pressed', 'false');
    }
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoStr);
  }
}

function renderTable(records, isProtected = false, opName = '') {
  const tableBody = document.getElementById('db-table-body');
  const viewBadge = document.getElementById('db-view-badge');
  if (!tableBody) return;

  if (!records || records.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="history-empty">No customer records found.</td></tr>';
    return;
  }

  if (viewBadge) {
    if (isProtected) {
      viewBadge.textContent = `Protected Customer Data Preview (Operation: ${opName.toUpperCase()})`;
      viewBadge.className = 'meta-pill success';
    } else {
      viewBadge.textContent = 'Original Customer Data (PostgreSQL)';
      viewBadge.className = 'meta-pill neutral';
    }
  }

  const rowsHtml = records.map(rec => {
    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-muted);">${escapeHtml(rec.id)}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.name)}</td>
        <td><code>${escapeHtml(rec.email)}</code></td>
        <td><code>${escapeHtml(rec.phone)}</code></td>
        <td><code>${escapeHtml(rec.aadhaar)}</code></td>
        <td><code>${escapeHtml(rec.pan)}</code></td>
        <td>${escapeHtml(rec.address)}</td>
        <td style="font-size: .78rem; color: var(--text-muted);">${escapeHtml(formatDate(rec.created_at))}</td>
      </tr>
    `;
  }).join('');

  tableBody.innerHTML = rowsHtml;
}

function renderSavedTable(records) {
  const savedBody = document.getElementById('saved-table-body');
  if (!savedBody) return;

  if (!records || records.length === 0) {
    savedBody.innerHTML = '<tr><td colspan="9" class="history-empty">No saved protected data yet. Select an operation card and click "Save to Database".</td></tr>';
    return;
  }

  const rowsHtml = records.map(rec => {
    const opUpper = (rec.operation || 'masking').toUpperCase();
    return `
      <tr>
        <td><span class="meta-pill primary" style="font-size:.75rem;">${escapeHtml(opUpper)}</span></td>
        <td style="font-weight: 700; color: var(--text-muted);">${escapeHtml(rec.source_customer_id || '—')}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.name)}</td>
        <td><code>${escapeHtml(rec.email)}</code></td>
        <td><code>${escapeHtml(rec.phone)}</code></td>
        <td><code>${escapeHtml(rec.aadhaar)}</code></td>
        <td><code>${escapeHtml(rec.pan)}</code></td>
        <td>${escapeHtml(rec.address)}</td>
        <td style="font-size: .78rem; color: var(--text-muted);">${escapeHtml(formatDate(rec.created_at))}</td>
      </tr>
    `;
  }).join('');

  savedBody.innerHTML = rowsHtml;
}

export async function loadOriginalCustomers() {
  const tableBody = document.getElementById('db-table-body');
  const statusBanner = document.getElementById('db-status-banner');
  const savePrompt = document.getElementById('db-save-prompt');

  if (statusBanner) statusBanner.classList.add('hidden');
  if (savePrompt) savePrompt.classList.add('hidden');
  currentProtectedPreview = null;

  try {
    const resp = await fetch(`${window.location.origin}/api/database/customers`);
    const data = await resp.json();

    if (data.success && Array.isArray(data.records)) {
      originalRecords = data.records;
      renderTable(originalRecords, false);
    } else {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="history-empty">Failed to load customer data.</td></tr>`;
    }
  } catch (err) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" class="history-empty">Error fetching customers (${escapeHtml(err.message)})</td></tr>`;
  }
}

export async function loadSavedProtectedData() {
  const savedBody = document.getElementById('saved-table-body');
  try {
    const resp = await fetch(`${window.location.origin}/api/database/protected-data`);
    const data = await resp.json();
    if (data.success && Array.isArray(data.records)) {
      renderSavedTable(data.records);
    }
  } catch (err) {
    console.warn('Error fetching saved protected data:', err.message);
  }
}

export async function applyDbProtection() {
  const applyBtn = document.getElementById('btn-db-apply');
  const statusBanner = document.getElementById('db-status-banner');
  const statusText = document.getElementById('db-status-text');
  const savePrompt = document.getElementById('db-save-prompt');

  if (!selectedOperation) {
    showToast('Please select a privacy operation first.', 'warning');
    return;
  }
  const operation = selectedOperation;

  if (applyBtn) applyBtn.disabled = true;

  try {
    const resp = await fetch(`${window.location.origin}/api/database/customers/protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation }),
    });

    const data = await resp.json();

    if (data.success && Array.isArray(data.records)) {
      currentProtectedPreview = {
        operation: data.operation || operation,
        records: data.records,
      };

      renderTable(data.records, true, data.operation || operation);

      if (statusBanner && statusText) {
        const fieldCount = (data.sensitiveFields || []).length;
        statusText.textContent = `✓ ${(data.operation || operation).toUpperCase()} preview applied to ${fieldCount} sensitive fields across ${data.recordCount} records (In-Memory)`;
        statusBanner.classList.remove('hidden');
      }

      if (savePrompt) {
        savePrompt.classList.remove('hidden');
      }

      showToast(`✓ ${(data.operation || operation).toUpperCase()} applied to database records`, 'success');

      // Also trigger history section refresh so audit log updates
      const historyBtn = document.getElementById('btn-refresh-history');
      if (historyBtn) historyBtn.click();
    } else {
      showToast(`Database Protection Error: ${data.error || 'Failed to apply operation'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error applying operation: ${err.message}`, 'error');
  } finally {
    if (applyBtn) applyBtn.disabled = false;
  }
}

export async function saveProtectedData() {
  const saveBtn = document.getElementById('btn-db-save');
  const savePrompt = document.getElementById('db-save-prompt');
  const statusText = document.getElementById('db-status-text');

  if (!currentProtectedPreview || !currentProtectedPreview.records) {
    showToast('No active protected preview to save.', 'warning');
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  try {
    const resp = await fetch(`${window.location.origin}/api/database/customers/save-protected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: currentProtectedPreview.operation,
        records: currentProtectedPreview.records,
      }),
    });

    const data = await resp.json();

    if (data.success) {
      if (statusText) {
        statusText.textContent = `✓ Protected data saved to PostgreSQL (${data.savedCount || currentProtectedPreview.records.length} records written to protected_customer_data)`;
      }
      if (savePrompt) {
        savePrompt.classList.add('hidden');
      }
      showToast('✓ Protected records saved to database', 'success');
      await loadSavedProtectedData();
    } else {
      showToast(`Save Failed: ${data.error || 'Failed to save protected data'}`, 'error');
    }
  } catch (err) {
    showToast(`Network error saving data: ${err.message}`, 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

export function discardProtectedData() {
  currentProtectedPreview = null;
  showToast('Protected preview discarded', 'info');
  loadOriginalCustomers();
}

export function initDbProtection() {
  const applyBtn = document.getElementById('btn-db-apply');
  const resetBtn = document.getElementById('btn-db-reset');
  const saveBtn = document.getElementById('btn-db-save');
  const discardBtn = document.getElementById('btn-db-discard');

  // Operation card selection listeners
  const opCards = document.querySelectorAll('.db-op-card');
  opCards.forEach(card => {
    card.addEventListener('click', () => {
      const op = card.getAttribute('data-op');
      if (op) selectOperation(op);
    });
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', applyDbProtection);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', loadOriginalCustomers);
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', saveProtectedData);
  }

  if (discardBtn) {
    discardBtn.addEventListener('click', discardProtectedData);
  }

  // Initial loads
  loadOriginalCustomers();
  loadSavedProtectedData();
}
