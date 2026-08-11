'use strict';

/**
 * Frontend History Module
 * Fetches recent processing history from GET /api/history and renders the UI table.
 */

let currentFilter = 'all';

function formatOpDetails(rec) {
  if (rec.operation === 'mask') {
    return rec.maskingType ? rec.maskingType.toUpperCase() : 'MASK';
  }
  if (rec.operation === 'hash') {
    const mode = rec.hashMode ? ` (${rec.hashMode})` : '';
    return `${(rec.hashAlgorithm || 'SHA-256').toUpperCase()}${mode}`;
  }
  if (rec.operation === 'encrypt') {
    return (rec.encryptionAlgorithm || 'AES-256-GCM').toUpperCase();
  }
  return '—';
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
    return isoStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchHistory(filter = 'all') {
  const tableBody = document.getElementById('history-table-body');
  if (!tableBody) return;

  const url = new URL(`${window.location.origin}/api/history`);
  url.searchParams.set('limit', '20');
  if (filter !== 'all') {
    url.searchParams.set('operation', filter);
  }

  try {
    const resp = await fetch(url.toString());
    const data = await resp.json();

    if (!data.success || !Array.isArray(data.records) || data.records.length === 0) {
      const msg = data.configured === false
        ? 'PostgreSQL not connected (offline mode). Set DATABASE_URL to enable history.'
        : 'No processing history recorded yet.';
      tableBody.innerHTML = `<tr><td colspan="7" class="history-empty">${escapeHtml(msg)}</td></tr>`;
      return;
    }

    const rowsHtml = data.records.map(rec => {
      const isSuccess = rec.status === 'success';
      const statusBadge = isSuccess
        ? `<span class="badge-status-success">✓ Success</span>`
        : `<span class="badge-status-failed">✕ Failed</span>`;

      return `
        <tr>
          <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(rec.fileName)}</td>
          <td><span class="meta-pill neutral">${escapeHtml((rec.format || 'bin').toUpperCase())}</span></td>
          <td><span class="op-badge op-badge-${rec.operation}">${escapeHtml(rec.operation.toUpperCase())}</span></td>
          <td><code>${escapeHtml(formatOpDetails(rec))}</code></td>
          <td>${rec.processedCount || 0} items</td>
          <td>${statusBadge}</td>
          <td>${escapeHtml(formatDate(rec.createdAt))}</td>
        </tr>
      `;
    }).join('');

    tableBody.innerHTML = rowsHtml;
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="history-empty">Unable to load history (${escapeHtml(err.message)})</td></tr>`;
  }
}

export function initHistory() {
  const filterBtns = document.querySelectorAll('.history-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      fetchHistory(currentFilter);
    });
  });

  const refreshBtn = document.getElementById('btn-refresh-history');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => fetchHistory(currentFilter));
  }

  // Load initial history
  fetchHistory(currentFilter);
}

export function refreshHistory() {
  fetchHistory(currentFilter);
}
