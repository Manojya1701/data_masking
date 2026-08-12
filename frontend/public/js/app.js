/**
 * app.js — Main orchestrator
 * Wires up upload, operations, download, privacy scan, compatibility indicator, and formats.
 */

import { initUpload }     from './upload.js';
import { initOperations } from './operations.js';
import { initDownload }   from './download.js';
import { initHistory, refreshHistory } from './history.js';
import { initDbProtection } from './db-protection.js';
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
const uploader   = initUpload(onFileReady);
const operations = initOperations();
const downloader = initDownload();
initHistory();
initDbProtection();

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
        return;
      }

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
          return `<div class="scan-count-item"><span class="scan-count-label">${escapeHtml(label)}</span><span class="scan-count-val">${cnt}</span></div>`;
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
    } catch (e) {
      scanLoading.classList.add('hidden');
      scanNote.textContent = 'Scan error: ' + e.message;
      scanResults.classList.remove('hidden');
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
      return;
    }

    downloader.showResult(data);
    refreshHistory();
    hideError();
  } catch (e) {
    showError('Network error: ' + e.message);
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

  // Search
  const searchInput = document.getElementById('formats-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterFormats());
  }

  // Category tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterFormats();
    });
  });
}

function filterFormats() {
  const searchVal  = (document.getElementById('formats-search')?.value || '').toLowerCase();
  const activeTab  = document.querySelector('.filter-tab.active');
  const activeCat  = activeTab ? activeTab.dataset.cat : 'all';

  const filtered = allFormats.filter(f => {
    const matchSearch = !searchVal ||
      f.label.toLowerCase().includes(searchVal) ||
      f.key.toLowerCase().includes(searchVal) ||
      (f.ext || []).some(e => e.toLowerCase().includes(searchVal));
    const matchCat = activeCat => activeCat === 'all' || f.category === activeCat;
    return matchSearch && matchCat(activeTab?.dataset.cat || 'all');
  });

  renderFormats(filtered);

  const empty = document.getElementById('formats-empty');
  if (empty) empty.classList.toggle('hidden', filtered.length > 0);
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
