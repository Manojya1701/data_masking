'use strict';

/**
 * DSAR Intake Controller (Step 1 of Segmento Protect Flow)
 * Manages intake form submission, auto tracking ID generation, and queue rendering.
 */

let activeDsarRequests = [];

function generateRandomDsarId() {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(100000 + Math.random() * 900000);
  return `DSAR-${year}-${randomDigits}`;
}

function updateAutoTrackingId() {
  const pill = document.getElementById('dsar-auto-tracking-id');
  if (pill) {
    pill.textContent = `Tracking ID: ${generateRandomDsarId()}`;
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

function formatDsarRequestType(type) {
  switch (type) {
    case 'full_erasure':
      return '<span class="meta-pill" style="background:rgba(244,63,94,0.12); color:var(--red); border:1px solid rgba(244,63,94,0.3);">🗑️ Full Erasure</span>';
    case 'anonymization':
      return '<span class="meta-pill primary" style="background:rgba(6,182,212,0.12); color:var(--cyan); border:1px solid rgba(6,182,212,0.3);">👤 Anonymization</span>';
    case 'access_export':
      return '<span class="meta-pill" style="background:rgba(59,130,246,0.12); color:var(--blue); border:1px solid rgba(59,130,246,0.3);">📦 Access / Export</span>';
    case 'restrict_processing':
      return '<span class="meta-pill" style="background:rgba(245,158,11,0.12); color:var(--amber); border:1px solid rgba(245,158,11,0.3);">🔒 Legal Hold</span>';
    default:
      return `<span class="meta-pill">${escapeHtml(type)}</span>`;
  }
}

function formatDsarStatus(status) {
  const st = (status || 'RECEIVED').toUpperCase();
  if (st === 'RECEIVED') {
    return '<span class="meta-pill badge-received">RECEIVED</span>';
  } else if (st === 'VERIFIED') {
    return '<span class="meta-pill badge-verified">VERIFIED</span>';
  }
  return `<span class="meta-pill">${escapeHtml(st)}</span>`;
}

function showToast(msg, type = 'info') {
  if (window.showToastMessage) {
    window.showToastMessage(msg, type);
  } else {
    console.log(`[Toast ${type}] ${msg}`);
  }
}

async function loadDsarRequests() {
  const tbody = document.getElementById('dsar-requests-table-body');
  const countEl = document.getElementById('dsar-queue-count');
  if (!tbody) return;

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/requests`);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.records)) {
      activeDsarRequests = data.records;
    } else {
      activeDsarRequests = [];
    }
  } catch (err) {
    console.warn('[DSAR UI Warning] Failed to fetch requests from API:', err.message);
  }

  if (countEl) {
    countEl.textContent = `${activeDsarRequests.length} Request${activeDsarRequests.length === 1 ? '' : 's'}`;
  }

  if (activeDsarRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">
          No DSAR intake requests submitted yet. Submit a request using the form above.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activeDsarRequests.map(r => {
    const dateStr = r.created_at ? new Date(r.created_at).toLocaleString() : 'Just Now';
    return `
      <tr data-request-id="${escapeHtml(r.request_id)}">
        <td style="font-weight:700; color:var(--cyan); font-family:monospace;">${escapeHtml(r.request_id)}</td>
        <td style="font-weight:600; color:var(--text-bright);">${escapeHtml(r.full_name)}</td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(r.email)}</td>
        <td>${formatDsarRequestType(r.request_type)}</td>
        <td style="text-transform:capitalize; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(r.subject_category || 'customer')}</td>
        <td>${formatDsarStatus(r.status)}</td>
        <td style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(dateStr)}</td>
        <td style="text-align:right;">
          <button type="button" class="btn-ghost btn-sm btn-proceed-identity-discovery" data-id="${escapeHtml(r.request_id)}" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; color:var(--cyan); border-color:rgba(6,182,212,0.3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Proceed (Step 2)</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleDsarSubmit(e) {
  e.preventDefault();

  const fullNameInput = document.getElementById('dsar-full-name');
  const emailInput = document.getElementById('dsar-email');
  const phoneInput = document.getElementById('dsar-phone');
  const customerIdInput = document.getElementById('dsar-customer-id');
  const requestTypeInput = document.getElementById('dsar-request-type');
  const subjectCategoryInput = document.getElementById('dsar-subject-category');
  const evidenceInput = document.getElementById('dsar-evidence');
  const submitBtn = document.getElementById('btn-submit-dsar-request');

  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';

  if (!fullName || !email) {
    showToast('Please fill out all required fields (*)', 'error');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const payload = {
      fullName,
      email,
      phone: phoneInput ? phoneInput.value.trim() : '',
      customerId: customerIdInput ? customerIdInput.value.trim() : '',
      requestType: requestTypeInput ? requestTypeInput.value : 'full_erasure',
      subjectCategory: subjectCategoryInput ? subjectCategoryInput.value : 'customer',
      verificationEvidence: evidenceInput ? evidenceInput.value.trim() : ''
    };

    const res = await fetch(`${window.location.origin}/api/dsar/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data && data.success && data.record) {
      showToast(`✓ DSAR Request Submitted! Tracking ID: ${data.record.request_id}`, 'success');
      if (fullNameInput) fullNameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (customerIdInput) customerIdInput.value = '';
      if (evidenceInput) evidenceInput.value = '';
      updateAutoTrackingId();
      await loadDsarRequests();
    } else {
      showToast(data.message || 'Failed to submit DSAR request', 'error');
    }
  } catch (err) {
    showToast(`Error submitting request: ${err.message}`, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

export function initDsarIntake() {
  const form = document.getElementById('dsar-intake-form');
  const refreshBtn = document.getElementById('btn-refresh-dsar-requests');

  if (form) {
    form.addEventListener('submit', handleDsarSubmit);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Refreshing DSAR intake queue…', 'info');
      loadDsarRequests();
    });
  }

  document.addEventListener('click', (e) => {
    const proceedBtn = e.target.closest('.btn-proceed-identity-discovery');
    if (proceedBtn) {
      e.preventDefault();
      const requestId = proceedBtn.getAttribute('data-id');
      showToast(`Step 1 Intake Complete for ${requestId}. Ready for Step 2: Identity Resolution & Discovery!`, 'info');
    }
  });

  updateAutoTrackingId();
  loadDsarRequests();
}
