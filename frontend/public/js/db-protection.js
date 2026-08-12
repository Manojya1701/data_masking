'use strict';

/**
 * Frontend Database Table Protection Module
 * Manages fetching customer records from PostgreSQL and applying in-memory privacy operations.
 */

let originalRecords = null;

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
      viewBadge.textContent = `Protected Customer Data (Operation: ${opName.toUpperCase()})`;
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

export async function loadOriginalCustomers() {
  const tableBody = document.getElementById('db-table-body');
  const statusBanner = document.getElementById('db-status-banner');
  if (statusBanner) statusBanner.classList.add('hidden');

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

export async function applyDbProtection() {
  const select = document.getElementById('db-op-select');
  const applyBtn = document.getElementById('btn-db-apply');
  const statusBanner = document.getElementById('db-status-banner');
  const statusText = document.getElementById('db-status-text');

  if (!select) return;
  const operation = select.value || 'masking';

  if (applyBtn) applyBtn.disabled = true;

  try {
    const resp = await fetch(`${window.location.origin}/api/database/customers/protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation }),
    });

    const data = await resp.json();

    if (data.success && Array.isArray(data.records)) {
      renderTable(data.records, true, data.operation || operation);

      if (statusBanner && statusText) {
        const fieldCount = (data.sensitiveFields || []).length;
        statusText.textContent = `✓ ${data.operation.toUpperCase()} applied to ${fieldCount} sensitive fields across ${data.recordCount} records (In-Memory Preview)`;
        statusBanner.classList.remove('hidden');
      }

      // Also trigger history section refresh so the audit log updates
      const historyBtn = document.getElementById('btn-refresh-history');
      if (historyBtn) historyBtn.click();
    } else {
      alert(`Database Protection Error: ${data.error || 'Failed to apply operation'}`);
    }
  } catch (err) {
    alert(`Network error applying operation: ${err.message}`);
  } finally {
    if (applyBtn) applyBtn.disabled = false;
  }
}

export function initDbProtection() {
  const applyBtn = document.getElementById('btn-db-apply');
  const resetBtn = document.getElementById('btn-db-reset');

  if (applyBtn) {
    applyBtn.addEventListener('click', applyDbProtection);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', loadOriginalCustomers);
  }

  // Initial load
  loadOriginalCustomers();
}
