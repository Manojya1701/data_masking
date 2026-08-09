/**
 * app.js — Main orchestrator
 * Wires up upload, operations, download, and formats.
 */

import { initUpload }     from './upload.js';
import { initOperations } from './operations.js';
import { initDownload }   from './download.js';

// State
let currentFile = null;

// ── DOM refs ──────────────────────────────────────────────────────────
const operationSection  = document.getElementById('operation-section');
const processBtn        = document.getElementById('process-btn');
const processBtnText    = document.getElementById('process-btn-text');
const processingOverlay = document.getElementById('processing-overlay');
const processingLabel   = document.getElementById('processing-sublabel');
const errorBanner       = document.getElementById('error-banner');
const errorMessage      = document.getElementById('error-message');
const errorClose        = document.getElementById('error-close');

// ── Init modules ──────────────────────────────────────────────────────
const uploader   = initUpload(onFileReady);
const operations = initOperations();
const downloader = initDownload();

// ── File ready callback ───────────────────────────────────────────────
function onFileReady(file) {
  currentFile = file;
  if (file) {
    operationSection.classList.remove('hidden');
    operationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    operationSection.classList.add('hidden');
  }
  downloader.reset();
  hideError();
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
  if (opts.algorithm) formData.append('algorithm', opts.algorithm);
  if (operation === 'encrypt' && opts.password) formData.append('password', opts.password);

  try {
    const resp = await fetch('/api/process-file', { method: 'POST', body: formData });
    const data = await resp.json();

    if (!resp.ok || !data.success) {
      showError(data.error || 'Processing failed.');
      return;
    }

    downloader.showResult(data);
    hideError();
  } catch (e) {
    showError('Network error: ' + e.message);
  } finally {
    showProcessing(false);
  }
}

// ── Reset ─────────────────────────────────────────────────────────────
window.addEventListener('udps:reset', () => {
  currentFile = null;
  uploader.reset();
  operations.reset();
  downloader.reset();
  operationSection.classList.add('hidden');
  hideError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── UI helpers ────────────────────────────────────────────────────────
function showProcessing(visible, operation) {
  processingOverlay.classList.toggle('hidden', !visible);
  processBtn.disabled = visible;
  if (visible) {
    const labels = {
      mask:    'Detecting sensitive fields and applying masks…',
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

// ── Load supported formats ────────────────────────────────────────────
async function loadFormats() {
  const grid = document.getElementById('formats-grid');
  try {
    const resp = await fetch('/api/formats');
    const data = await resp.json();
    grid.innerHTML = data.formats.map(f => `
      <div class="format-card" title="${f.label}">
        <div class="format-ext">${f.ext.join(' / ')}</div>
        <div class="format-label">${f.label}</div>
        ${f.note ? `<div class="format-note">${f.note}</div>` : ''}
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '<p style="color:var(--text-muted)">Could not load formats.</p>';
  }
}

loadFormats();
