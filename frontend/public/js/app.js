/**
 * app.js — Main orchestrator
 * Wires up upload, operations, download, privacy scan, compatibility indicator, and formats.
 */

import { initUpload }     from './upload.js';
import { initOperations } from './operations.js';
import { initDownload }   from './download.js';
import { initHistory, refreshHistory } from './history.js';
import { initDbProtection } from './db-protection.js';
import { initPrivacyDeletion } from './privacy-deletion.js';
import { initTheme } from './theme.js';
import { initDashboardStats } from './dashboard-stats.js';
import { initSearch } from './search.js';
import { showToast } from './toast.js';
import { updateWorkflowProgress } from './workflow-step.js';
import { initDemoModal } from './demo-modal.js';
import { initProtectionPreview, renderPreviewComparison } from './protection-preview.js';

const API_BASE_URL = window.location.origin;
// State
let currentFile   = null;
let currentFormat = null;

// ── DOM refs ──────────────────────────────────────────────────────────
const operationSection  = document.getElementById('operation-section');
const processBtn        = document.getElementById('process-btn');
const processBtnText    = document.getElementById('process-btn-text');
const processingOverlay = document.getElementById('processing-overlay');
const processingLabel   = document.getElementById('processing-sublabel');
const errorBanner       = document.getElementById('error-banner');
const errorMessage      = document.getElementById('error-message');
const errorClose        = document.getElementById('error-close');

// Scan
const scanPanel   = document.getElementById('scan-panel');
const scanBtn     = document.getElementById('scan-btn');
const scanLoading = document.getElementById('scan-loading');
const scanResults = document.getElementById('scan-results');
const scanCounts  = document.getElementById('scan-counts');
const scanNote    = document.getElementById('scan-note');
const riskBadge   = document.getElementById('scan-risk-badge');
const scanPreviewWrap = document.getElementById('scan-preview-trigger-wrap');

// Compatibility indicator
const compatIndicator   = document.getElementById('compat-indicator');
const compatFormatLabel = document.getElementById('compat-format-label');
const compatOps         = document.getElementById('compat-ops');

// Format compatibility map (which operations are fully supported per format)
const FORMAT_COMPAT = {
  csv:     { mask: true,  hash: true,  encrypt: true  },
  tsv:     { mask: true,  hash: true,  encrypt: true  },
  json:    { mask: true,  hash: true,  encrypt: true  },
  jsonl:   { mask: true,  hash: true,  encrypt: true  },
  yaml:    { mask: true,  hash: true,  encrypt: true  },
  xml:     { mask: true,  hash: true,  encrypt: true  },
  html:    { mask: true,  hash: true,  encrypt: true  },
  pdf:     { mask: 'visual', hash: 'visual', encrypt: true },
  parquet: { mask: true,  hash: true,  encrypt: true  },
  avro:    { mask: true,  hash: true,  encrypt: true  },
  orc:     { mask: true,  hash: true,  encrypt: true  },
  image:   { mask: 'ocr', hash: 'digest', encrypt: true },
};

const COMPAT_NOTES = {
  'visual': 'Visual overlay only — text layer may still be present in PDF binary',
  'ocr':    'Requires tesseract.js for OCR; falls back gracefully if unavailable',
  'digest': 'Returns a whole-file hash digest report, not a modified image',
};

// ── Init modules ──────────────────────────────────────────────────────
initTheme();
initDashboardStats();
initSearch();
initDemoModal();
const uploader   = initUpload(onFileReady);
const operations = initOperations();
const downloader = initDownload();
initHistory();
initDbProtection();
initPrivacyDeletion();

initProtectionPreview((method) => {
  const targetOp = (method === 'tokenize') ? 'mask' : method;
  operations.selectOperation(targetOp);
  if (operationSection) {
    operationSection.classList.remove('hidden');
    operationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const methodNames = {
    mask: 'Masking',
    tokenize: 'Tokenization',
    hash: 'Hashing',
    encrypt: 'Encryption'
  };
  showToast(`✓ Selected ${methodNames[method] || method} operation`, 'success');
});

// ── File ready callback ───────────────────────────────────────────────
function onFileReady(file) {
  currentFile = file;
  if (file) {
    operationSection.classList.remove('hidden');
    operationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showScanPanel(file);
    showCompatIndicator(file);
  } else {
    operationSection.classList.add('hidden');
    scanPanel.classList.add('hidden');
    compatIndicator.classList.add('hidden');
  }
  downloader.reset();
  hideError();
}

// ── Privacy scan panel ────────────────────────────────────────────────
function showScanPanel(file) {
  // Only show for text-based formats
  const ext = file.name.split('.').pop().toLowerCase();
  const textFormats = new Set(['csv','tsv','json','jsonl','ndjson','yaml','yml','xml','html','htm','pdf']);
  if (textFormats.has(ext)) {
    scanPanel.classList.remove('hidden');
    scanResults.classList.add('hidden');
    scanLoading.classList.add('hidden');
    if (riskBadge) riskBadge.classList.add('hidden');
    scanBtn.disabled = false;
    scanBtn.textContent = ''; // reset
    scanBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg> Scan for Sensitive Data`;
  } else {
    scanPanel.classList.add('hidden');
  }
}

// ── Compatibility indicator ───────────────────────────────────────────
function showCompatIndicator(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const extToFormat = {
    csv:'csv', tsv:'tsv', json:'json', jsonl:'jsonl', ndjson:'jsonl',
    yaml:'yaml', yml:'yaml', xml:'xml', html:'html', htm:'html',
    pdf:'pdf', parquet:'parquet', avro:'avro', orc:'orc',
    jpg:'image', jpeg:'image', png:'image',
  };
  const fmt = extToFormat[ext] || null;
  currentFormat = fmt;

  if (!fmt || !FORMAT_COMPAT[fmt]) {
    compatIndicator.classList.add('hidden');
    return;
  }

  const compat = FORMAT_COMPAT[fmt];
  const labelMap = { csv:'CSV', tsv:'TSV', json:'JSON', jsonl:'JSONL', yaml:'YAML', xml:'XML',
    html:'HTML', pdf:'PDF', parquet:'Parquet', avro:'Avro', orc:'ORC', image:'Image (JPEG/PNG)' };
  compatFormatLabel.textContent = labelMap[fmt] || fmt.toUpperCase();

  const ops = [
    { key: 'mask',    label: 'Mask' },
    { key: 'hash',    label: 'Hash' },
    { key: 'encrypt', label: 'Encrypt' },
  ];

  compatOps.innerHTML = ops.map(op => {
    const support = compat[op.key];
    const isOk = support === true;
    const isPartial = typeof support === 'string';
    const icon = isOk ? '✓' : (isPartial ? '⚠' : '✗');
    const cls  = isOk ? 'compat-ok' : (isPartial ? 'compat-partial' : 'compat-no');
    const title = isPartial && COMPAT_NOTES[support] ? COMPAT_NOTES[support] : '';
    return `<div class="compat-op ${cls}" title="${title}">
      <span class="compat-op-icon">${icon}</span>
      <span>${op.label}</span>
    </div>`;
  }).join('');

  compatIndicator.classList.remove('hidden');
}

// ── Scan button ───────────────────────────────────────────────────────
if (scanBtn) {
  scanBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    scanLoading.classList.remove('hidden');
    scanResults.classList.add('hidden');
    scanBtn.disabled = true;
    if (riskBadge) riskBadge.classList.add('hidden');

    const formData = new FormData();
    formData.append('file', currentFile);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/scan-file`, { method: 'POST', body: formData });
      const data = await resp.json();

      scanLoading.classList.add('hidden');

      if (!resp.ok || !data.success) {
        scanNote.textContent = data.error || 'Scan failed.';
        scanResults.classList.remove('hidden');
        showToast(data.error || 'Scan failed', 'error');
        return;
      }

      // Category Icon Map
      const catIcons = {
        name: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        email: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>`,
        phone_in: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        phone_intl: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        aadhaar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="16" x2="10" y2="16"/></svg>`,
        pan: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="16" x2="10" y2="16"/></svg>`,
        passport: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="16" x2="10" y2="16"/></svg>`,
        credit_card: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
        dob: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        ipv4: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        ipv6: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        generic: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      };

      // Show counts
      const countEntries = Object.entries(data.counts || {});
      if (countEntries.length === 0) {
        scanCounts.innerHTML = '<span class="scan-no-result">No sensitive data patterns detected.</span>';
      } else {
        const typeLabels = {
          email:'Emails', name:'Names', phone_in:'Phones (India)',
          phone_intl:'Phones (Intl)', aadhaar:'Aadhaar Numbers', pan:'PAN Numbers',
          credit_card:'Credit Cards', dob:'Dates of Birth',
          ipv4:'IPv4 Addresses', ipv6:'IPv6 Addresses', passport:'Passport IDs', generic:'Other PII',
        };
        scanCounts.innerHTML = countEntries.map(([type, cnt]) => {
          const label = typeLabels[type] || type;
          const icon = catIcons[type] || catIcons.generic;
          return `<div class="scan-count-item">
            <span class="scan-count-icon">${icon}</span>
            <span class="scan-count-label">${escapeHtml(label)}</span>
            <span class="scan-count-val">${cnt}</span>
          </div>`;
        }).join('');
      }

      // Risk badge
      if (riskBadge && data.riskScore) {
        riskBadge.textContent = data.riskScore + ' Risk';
        riskBadge.className = `risk-badge risk-${data.riskScore.toLowerCase()}`;
        riskBadge.classList.remove('hidden');
      }

      scanNote.textContent = data.note || `Total sensitive items detected: ${data.total || 0}. Full values are not shown.`;
      scanResults.classList.remove('hidden');

      // Update and show Protection Preview trigger
      renderPreviewComparison(data.counts || {});
      if (scanPreviewWrap) scanPreviewWrap.classList.remove('hidden');

      showToast('✓ Privacy scan completed', 'success');
      updateWorkflowProgress('scanned');
    } catch (e) {
      scanLoading.classList.add('hidden');
      scanNote.textContent = 'Scan error: ' + e.message;
      scanResults.classList.remove('hidden');
      showToast('Scan error: ' + e.message, 'error');
    } finally {
      scanBtn.disabled = false;
    }
  });
}

// ── Process button ────────────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
  if (!currentFile) {
    showError('Please upload a file first.');
    return;
  }

  const op = operations.getOperation();
  if (!op) {
    showError('Please select an operation: Mask, Hash, or Encrypt.');
    return;
  }

  const opts = operations.getOptions();
  if (op === 'encrypt' && !opts.password) {
    showError('Please enter a password for encryption.');
    return;
  }

  await processFile(currentFile, op, opts);
});

async function processFile(file, operation, opts) {
  showProcessing(true, operation);
  hideError();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('operation', operation);
  if (opts.algorithm)    formData.append('algorithm', opts.algorithm);
  if (opts.hashMode)     formData.append('hashMode', opts.hashMode);
  if (opts.maskingType)  formData.append('maskingType', opts.maskingType);
  if (opts.encAlgorithm) formData.append('encAlgorithm', opts.encAlgorithm);
  if (operation === 'encrypt' && opts.password) formData.append('password', opts.password);

  try {
    const resp = await fetch(`${API_BASE_URL}/api/process-file`, { method: 'POST', body: formData });
    const data = await resp.json();

    if (!resp.ok || !data.success) {
      showError(data.error || 'Processing failed.');
      showToast(data.error || 'Processing failed', 'error');
      return;
    }

    downloader.showResult(data);
    refreshHistory();
    hideError();
    showToast('✓ File processed successfully', 'success');
    updateWorkflowProgress('protected');
  } catch (e) {
    showError('Network error: ' + e.message);
    showToast('Network error: ' + e.message, 'error');
  } finally {
    showProcessing(false);
  }
}

// ── Reset ─────────────────────────────────────────────────────────────
window.addEventListener('udps:reset', () => {
  currentFile   = null;
  currentFormat = null;
  uploader.reset();
  operations.reset();
  downloader.reset();
  operationSection.classList.add('hidden');
  scanPanel.classList.add('hidden');
  compatIndicator.classList.add('hidden');
  hideError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── UI helpers ────────────────────────────────────────────────────────
function showProcessing(visible, operation) {
  processingOverlay.classList.toggle('hidden', !visible);
  processBtn.disabled = visible;
  if (visible) {
    const labels = {
      mask:    'Detecting sensitive fields and applying masking…',
      hash:    'Hashing sensitive values with cryptographic functions…',
      encrypt: 'Deriving encryption key and encrypting file…',
    };
    processingLabel.textContent = labels[operation] || 'Processing…';
    processBtnText.textContent = 'Processing…';
  } else {
    processBtnText.textContent = 'Process File';
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

errorClose.addEventListener('click', hideError);

// ── Formats search + filter ───────────────────────────────────────────
let allFormats = [];

async function loadFormats() {
  const grid  = document.getElementById('formats-grid');
  const empty = document.getElementById('formats-empty');
  try {
    const resp = await fetch(`${API_BASE_URL}/api/formats`);
    const data = await resp.json();
    allFormats = data.formats || [];
    renderFormats(allFormats);
  } catch {
    grid.innerHTML = '<p style="color:var(--text-muted)">Could not load formats.</p>';
  }

  // Compact Formats Explorer controls
  const exploreBtn   = document.getElementById('btn-explore-formats');
  const drawer       = document.getElementById('formats-drawer');
  const quickSearch  = document.getElementById('format-quick-search');
  const quickFilter  = document.getElementById('format-quick-filter');
  const quickResult  = document.getElementById('format-quick-result');

  if (exploreBtn && drawer) {
    exploreBtn.addEventListener('click', () => {
      const isHidden = drawer.classList.contains('hidden');
      drawer.classList.toggle('hidden', !isHidden);
      exploreBtn.textContent = isHidden ? 'Hide Formats ▲' : 'View Formats ▾';
    });
  }

  function handleQuickFormatSearch() {
    if (!quickSearch || !quickResult) return;
    const val = quickSearch.value.trim().toLowerCase();

    if (!val) {
      quickResult.classList.add('hidden');
      return;
    }

    const cleanExt = val.startsWith('.') ? val.slice(1) : val;

    const matched = allFormats.find(f =>
      f.key.toLowerCase() === cleanExt ||
      f.label.toLowerCase().includes(val) ||
      (f.ext || []).some(e => e.toLowerCase() === cleanExt || e.toLowerCase() === val)
    );

    quickResult.classList.remove('hidden');
    if (matched) {
      const opsText = 'Mask • Hash • Encrypt';
      quickResult.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-weight:700; color:var(--cyan);">${escapeHtml(matched.label)} (${matched.ext.join(', ')})</span>
            <span style="font-size:0.8rem; color:var(--text-muted); margin-left:8px;">Category: ${escapeHtml(matched.category || '')}</span>
          </div>
          <div style="font-size:0.8rem; font-weight:600; color:var(--green);">
            Supported operations: ${escapeHtml(opsText)}
          </div>
        </div>
      `;
    } else {
      quickResult.innerHTML = `
        <div style="font-size:0.85rem; color:var(--red); font-weight:600;">
          This format is not currently supported.
        </div>
      `;
    }
  }

  if (quickSearch) {
    quickSearch.addEventListener('input', handleQuickFormatSearch);
  }

  if (quickFilter) {
    quickFilter.addEventListener('change', () => {
      const cat = quickFilter.value;
      const tabs = document.querySelectorAll('.format-filter-chip');
      tabs.forEach(tab => {
        if ((tab.dataset.cat || 'all').toLowerCase() === cat) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
      if (drawer) drawer.classList.remove('hidden');
      if (exploreBtn) exploreBtn.textContent = 'Hide Formats ▲';
      filterFormats();
    });
  }

  // Search
  const searchInput = document.getElementById('format-search-input') || document.getElementById('formats-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterFormats());
  }

  // Category tabs
  const tabs = document.querySelectorAll('.format-filter-chip, .filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterFormats();
    });
  });
}

function filterFormats() {
  const searchInput = document.getElementById('format-search-input') || document.getElementById('formats-search');
  const searchVal  = (searchInput?.value || '').toLowerCase().trim();
  const activeTab  = document.querySelector('.format-filter-chip.active, .filter-tab.active');
  const activeCat  = activeTab ? (activeTab.dataset.cat || 'all').toLowerCase() : 'all';

  const filtered = allFormats.filter(f => {
    const matchSearch = !searchVal ||
      f.label.toLowerCase().includes(searchVal) ||
      f.key.toLowerCase().includes(searchVal) ||
      (f.ext || []).some(e => e.toLowerCase().includes(searchVal));
    const catLower = (f.category || '').toLowerCase();
    const matchCat = activeCat === 'all' || catLower === activeCat;
    return matchSearch && matchCat;
  });

  renderFormats(filtered);
}

function renderFormats(formats) {
  const grid = document.getElementById('formats-grid');
  if (!grid) return;
  grid.innerHTML = formats.map(f => `
    <div class="format-card" title="${escapeHtml(f.label)}">
      <div class="format-ext">${f.ext.join(' / ')}</div>
      <div class="format-label">${escapeHtml(f.label)}</div>
      <div class="format-cat">${escapeHtml(f.category || '')}</div>
      ${f.note ? `<div class="format-note">${escapeHtml(f.note)}</div>` : ''}
    </div>
  `).join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

loadFormats();

// Mobile Navigation Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const headerNav = document.getElementById('header-nav');
if (mobileMenuBtn && headerNav) {
  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headerNav.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!mobileMenuBtn.contains(e.target) && !headerNav.contains(e.target)) {
      headerNav.classList.remove('active');
    }
  });
}
