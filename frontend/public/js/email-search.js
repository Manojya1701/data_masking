'use strict';

/**
 * Database Email Lookup Module
 * Handles searching for an email address across all database tables.
 * Displays match count, table breakdown, record details, or a clean "Not Found" state.
 */

import { showToast } from './toast.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function executeEmailSearch(searchEmail) {
  const query = (searchEmail || '').trim();
  const inputEl = document.getElementById('email-search-input');
  const resultsContainer = document.getElementById('email-search-results');
  const searchBtn = document.getElementById('btn-email-search-submit');

  if (!query) {
    showToast('Please enter an email address to search.', 'warning');
    if (inputEl) inputEl.focus();
    return;
  }

  if (inputEl) inputEl.value = query;
  if (searchBtn) searchBtn.disabled = true;
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--cyan);">
        <span class="spinner-small" style="display:inline-block; margin-right:8px;"></span> Searching database tables for <code>${escapeHtml(query)}</code>…
      </div>
    `;
    resultsContainer.classList.remove('hidden');
  }

  try {
    const resp = await fetch(`${window.location.origin}/api/database/search-email?email=${encodeURIComponent(query)}`);
    const data = await resp.json();

    if (!resp.ok || !data.success) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="padding:16px; background:rgba(244,63,94,0.1); border:1px solid var(--red); border-radius:var(--radius-md); color:var(--red);">
            ❌ Error searching database: ${escapeHtml(data.error || 'Failed to search email')}
          </div>
        `;
      }
      return;
    }

    renderEmailSearchResults(data);
  } catch (err) {
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div style="padding:16px; background:rgba(244,63,94,0.1); border:1px solid var(--red); border-radius:var(--radius-md); color:var(--red);">
          ❌ Network error: ${escapeHtml(err.message)}
        </div>
      `;
    }
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}

function renderEmailSearchResults(data) {
  const container = document.getElementById('email-search-results');
  if (!container) return;

  const { email, found, totalMatches, tableMatchesCount, tablesSearched, matches } = data;

  if (!found || !matches || matches.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); padding: 20px; text-align: center;">
        <div style="font-size: 1.1rem; font-weight: 700; color: var(--red); display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>Email Not Found in Database</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin: 0;">
          No matching records found for <code style="color: var(--red); font-weight: 700;">${escapeHtml(email)}</code> across ${tablesSearched} database table(s).
        </p>
      </div>
    `;
    container.classList.remove('hidden');
    showToast(`Email "${email}" not found in database`, 'info');
    return;
  }

  // Found matches!
  const tablesHtml = matches.map(match => {
    const { tableName, displayName, matchCount, records } = match;

    const rowsHtml = records.map(rec => {
      const name = rec.name || `${rec.first_name || ''} ${rec.last_name || ''}`.trim() || 'Record';
      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-muted); width: 60px;">#${escapeHtml(rec.id)}</td>
          <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(name)}</td>
          <td><code style="color: var(--cyan); font-weight: 700;">${escapeHtml(rec.email)}</code></td>
          <td style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(rec.phone || rec.operation || rec.created_at || 'Active Record')}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; margin-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="meta-pill primary" style="font-size: 0.75rem; font-weight: 700;">TABLE</span>
            <strong style="color: var(--text-primary); font-size: 0.92rem;">${escapeHtml(displayName)}</strong>
            <code style="font-size: 0.75rem; color: var(--text-muted);">(${escapeHtml(tableName)})</code>
          </div>
          <span class="meta-pill success" style="font-size: 0.75rem; font-weight: 700;">
            ${matchCount} ${matchCount === 1 ? 'record match' : 'record matches'}
          </span>
        </div>
        <div class="history-table-wrap">
          <table class="history-table db-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name / Details</th>
                <th>Matching Email</th>
                <th>Status / Info</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: center; color: var(--green);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--green); margin: 0;">Email Found in Database</h4>
            <p style="font-size: 0.84rem; color: var(--text-secondary); margin: 2px 0 0;">
              Matched <code style="color: var(--cyan); font-weight: 700;">${escapeHtml(email)}</code> in <strong>${totalMatches}</strong> record(s) across <strong>${tableMatchesCount}</strong> table(s).
            </p>
          </div>
        </div>
        <span class="meta-pill success" style="font-size: 0.8rem; font-weight: 700; padding: 6px 12px;">
          ✓ ${totalMatches} Total Matches
        </span>
      </div>

      ${tablesHtml}
    </div>
  `;
  container.classList.remove('hidden');
  showToast(`✓ Found ${totalMatches} record match(es) for "${email}"`, 'success');
}

export function initEmailSearch() {
  const form = document.getElementById('email-search-form');
  const inputEl = document.getElementById('email-search-input');
  const submitBtn = document.getElementById('btn-email-search-submit');
  const clearBtn = document.getElementById('btn-email-search-clear');
  const resultsContainer = document.getElementById('email-search-results');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (inputEl) executeEmailSearch(inputEl.value);
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (inputEl) executeEmailSearch(inputEl.value);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (inputEl) inputEl.value = '';
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
      }
    });
  }

  // Delegated click listener for quick example pills (.email-sample-pill)
  document.addEventListener('click', (e) => {
    const pill = e.target.closest('.email-sample-pill');
    if (pill) {
      e.preventDefault();
      const email = pill.getAttribute('data-email');
      if (email) executeEmailSearch(email);
    }
  });
}
