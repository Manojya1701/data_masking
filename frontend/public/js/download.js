/**
 * download.js
 * Handles result display, file download, integrity badge, privacy report, and the Restore Encrypted File flow.
 * Exports: initDownload()
 */
const API_BASE_URL = window.location.origin;
export function initDownload() {
  const downloadBtn   = document.getElementById('download-btn');
  const reportBtn     = document.getElementById('report-btn');
  const newFileBtn    = document.getElementById('new-file-btn');
  const resultSection = document.getElementById('result-section');

  let currentToken   = null;
  let currentReport  = null;

  downloadBtn.addEventListener('click', () => {
    if (currentToken) triggerDownload(currentToken);
  });

  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      if (currentReport) downloadReportBlob(currentReport);
    });
  }

  newFileBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('udps:reset'));
  });

  function triggerDownload(token) {
    const a = document.createElement('a');
    a.href =
  `${API_BASE_URL}/api/download/${token}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadReportBlob(reportObj) {
    const json = JSON.stringify(reportObj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'privacy_report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Restore flow
  const restoreDropZone    = document.getElementById('restore-drop-zone');
  const restoreFileInput   = document.getElementById('restore-file-input');
  const restoreFileInfo    = document.getElementById('restore-file-info');
  const restoreFileName    = document.getElementById('restore-file-name');
  const restorePassword    = document.getElementById('restore-password');
  const restoreBtn         = document.getElementById('restore-btn');
  const restoreBtnText     = document.getElementById('restore-btn-text');
  const restoreResult      = document.getElementById('restore-result');
  const restoreError       = document.getElementById('restore-error');
  const restoreErrorMsg    = document.getElementById('restore-error-message');
  const restoreDownloadBtn = document.getElementById('restore-download-btn');
  const toggleRestorePw    = document.getElementById('toggle-restore-password');
  const restoreEyeOpen     = document.getElementById('restore-eye-open');
  const restoreEyeClosed   = document.getElementById('restore-eye-closed');
  const integrityBadge     = document.getElementById('integrity-badge');

  let restoreFile  = null;
  let restoreToken = null;

  // Restore drag-and-drop
  restoreDropZone.addEventListener('dragover', e => { e.preventDefault(); restoreDropZone.classList.add('drag-over'); });
  restoreDropZone.addEventListener('dragleave', () => restoreDropZone.classList.remove('drag-over'));
  restoreDropZone.addEventListener('drop', e => {
    e.preventDefault();
    restoreDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setRestoreFile(file);
  });
  restoreDropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restoreFileInput.click(); }
  });
  restoreFileInput.addEventListener('change', () => {
    if (restoreFileInput.files[0]) setRestoreFile(restoreFileInput.files[0]);
  });

  function setRestoreFile(file) {
    restoreFile = file;
    restoreFileName.textContent = file.name;
    restoreFileInfo.classList.remove('hidden');
    restoreResult.classList.add('hidden');
    restoreError.classList.add('hidden');
    if (integrityBadge) integrityBadge.classList.add('hidden');
  }

  // Toggle restore password
  toggleRestorePw.addEventListener('click', () => {
    const isPassword = restorePassword.type === 'password';
    restorePassword.type = isPassword ? 'text' : 'password';
    restoreEyeOpen.classList.toggle('hidden', isPassword);
    restoreEyeClosed.classList.toggle('hidden', !isPassword);
  });

  // Restore button
  restoreBtn.addEventListener('click', async () => {
    if (!restoreFile) {
      showRestoreError('Please upload an encrypted .enc file.');
      return;
    }
    const pw = restorePassword.value;
    if (!pw) {
      showRestoreError('Please enter the decryption password.');
      return;
    }

    restoreBtn.disabled = true;
    restoreBtnText.textContent = 'Decrypting…';
    restoreResult.classList.add('hidden');
    restoreError.classList.add('hidden');
    if (integrityBadge) integrityBadge.classList.add('hidden');

    const formData = new FormData();
    formData.append('file', restoreFile);
    formData.append('password', pw);

    try {
      const resp =
  await fetch(
    `${API_BASE_URL}/api/restore-file`,
    {
      method: 'POST',
      body: formData
    }
  );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        showRestoreError(data.error || 'Decryption failed. Check your password and try again.');
      } else {
        restoreToken = data.token;
        restoreResult.classList.remove('hidden');
        restorePassword.value = '';

        // Show integrity badge
        if (integrityBadge) {
          if (data.integrityVerified === true) {
            integrityBadge.classList.remove('hidden');
          } else {
            integrityBadge.classList.add('hidden');
          }
        }
      }
    } catch (e) {
      showRestoreError('Network error: ' + e.message);
    } finally {
      restoreBtn.disabled = false;
      restoreBtnText.textContent = 'Decrypt & Restore';
    }
  });

  restoreDownloadBtn.addEventListener('click', () => {
    if (restoreToken) triggerDownload(restoreToken);
  });

  function showRestoreError(msg) {
    restoreErrorMsg.textContent = msg;
    restoreError.classList.remove('hidden');
  }

  // Preview Modal Elements
  const previewModal       = document.getElementById('preview-modal');
  const previewBackdrop    = document.getElementById('preview-backdrop');
  const previewCloseBtn    = document.getElementById('preview-close-btn');
  const previewCancelBtn   = document.getElementById('preview-cancel-btn');
  const previewDownloadBtn = document.getElementById('preview-download-btn');
  const previewLoading     = document.getElementById('preview-loading');
  const previewContainer   = document.getElementById('preview-container');
  const previewFormatPill  = document.getElementById('preview-format-pill');
  const previewBtn         = document.getElementById('preview-btn');
  const restorePreviewBtn  = document.getElementById('restore-preview-btn');

  let currentFormatLabel = '';
  let currentDownloadName = '';

  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (currentToken) openPreviewModal(currentToken, currentFormatLabel, currentDownloadName);
    });
  }

  if (restorePreviewBtn) {
    restorePreviewBtn.addEventListener('click', () => {
      if (restoreToken) openPreviewModal(restoreToken, 'Restored File', 'restored_file');
    });
  }

  if (previewCloseBtn)  previewCloseBtn.addEventListener('click', closePreviewModal);
  if (previewCancelBtn) previewCancelBtn.addEventListener('click', closePreviewModal);
  if (previewBackdrop)  previewBackdrop.addEventListener('click', closePreviewModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && previewModal && !previewModal.classList.contains('hidden')) {
      closePreviewModal();
    }
  });

  async function openPreviewModal(token, formatLabel, fileName) {
    if (!previewModal) return;

    previewFormatPill.textContent = formatLabel || 'File Preview';
    previewLoading.classList.remove('hidden');
    previewContainer.innerHTML = '';
    previewModal.classList.remove('hidden');

    previewDownloadBtn.onclick = () => triggerDownload(token);

    const previewUrl = `${API_BASE_URL}/api/preview/${token}`;
    const ext = (fileName || '').split('.').pop().toLowerCase();

    try {
      if (ext === 'pdf') {
        previewContainer.innerHTML = `<iframe src="${previewUrl}" class="preview-iframe" title="PDF Preview"></iframe>`;
      } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
        previewContainer.innerHTML = `<img src="${previewUrl}" class="preview-img" alt="File Preview">`;
      } else if (['json', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'html', 'jsonl', 'ndjson', 'txt'].includes(ext)) {
        const resp = await fetch(previewUrl);
        const text = await resp.text();
        const truncated = text.length > 50000 ? text.slice(0, 50000) + '\n\n… [Preview truncated at 50KB]' : text;
        previewContainer.innerHTML = `<div class="preview-code-wrap"><pre class="preview-code">${escapeHtml(truncated)}</pre></div>`;
      } else {
        previewContainer.innerHTML = `
          <div class="preview-info-box">
            <h4>Encrypted or Binary Container</h4>
            <p>This file is in a binary format (<strong>${escapeHtml(formatLabel || ext.toUpperCase())}</strong>). Direct inline visual preview is not applicable.</p>
            <p style="margin-top:12px;color:var(--text-muted);">Click "Download File" below to save the file to your computer.</p>
          </div>
        `;
      }
    } catch (err) {
      previewContainer.innerHTML = `
        <div class="preview-info-box">
          <h4 style="color:#ef4444;">Preview Failed</h4>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
    } finally {
      previewLoading.classList.add('hidden');
    }
  }

  function closePreviewModal() {
    if (!previewModal) return;
    previewModal.classList.add('hidden');
    previewContainer.innerHTML = '';
  }

  return {
    showResult(data) {
      currentToken = data.token;
      currentFormatLabel = data.formatLabel || data.format || '';
      currentDownloadName = data.downloadName || '';

      // Build privacy report (no sensitive values — metadata only)
      currentReport = {
        fileFormat:     data.formatLabel || data.format,
        operation:      data.operation,
        maskingType:    data.maskingType  || null,
        algorithm:      data.algorithm    || null,
        encAlgorithm:   data.encAlgorithm || null,
        hashMode:       data.hashMode     || null,
        sensitiveValuesProcessed: data.count ?? null,
        processingTimeSec: data.processingTime || null,
        outputFile:     data.downloadName || null,
        generatedAt:    new Date().toISOString(),
      };

      document.getElementById('result-format').textContent    = data.formatLabel || data.format;
      document.getElementById('result-operation').textContent = capitalize(data.operation);
      document.getElementById('result-time').textContent      = data.processingTime ? data.processingTime + ' s' : '—';
      document.getElementById('result-output-name').textContent = data.downloadName || '—';

      // Masking type row
      const maskingRow = document.getElementById('result-masking-row');
      if (data.operation === 'mask' && data.maskingType) {
        document.getElementById('result-masking-type').textContent = capitalize(data.maskingType);
        maskingRow.classList.remove('hidden');
      } else {
        maskingRow.classList.add('hidden');
      }

      // Algorithm row
      const algoRow = document.getElementById('result-algo-row');
      const algoVal = document.getElementById('result-algorithm');
      if (data.algorithm && (data.operation === 'hash')) {
        algoVal.textContent = (data.algorithm || '').toUpperCase();
        algoRow.classList.remove('hidden');
      } else if (data.operation === 'encrypt' && data.encAlgorithm) {
        algoVal.textContent = (data.encAlgorithm || '').toUpperCase();
        algoRow.classList.remove('hidden');
      } else {
        algoRow.classList.add('hidden');
      }

      // Count row
      const countRow = document.getElementById('result-count-row');
      const countVal = document.getElementById('result-count');
      if (data.operation !== 'encrypt') {
        countVal.textContent = data.count != null ? data.count.toLocaleString() : '—';
        countRow.classList.remove('hidden');
      } else {
        countRow.classList.add('hidden');
      }

      // Notes
      const notesEl = document.getElementById('result-notes');
      if (data.notes && data.notes.length > 0) {
        notesEl.innerHTML = data.notes.map(n =>
          `<div class="result-note"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="#f59e0b" stroke-width="1.2"/><path d="M7 5v3M7 10v.3" stroke="#f59e0b" stroke-width="1.3" stroke-linecap="round"/></svg><span>${escapeHtml(n)}</span></div>`
        ).join('');
        notesEl.classList.remove('hidden');
      } else {
        notesEl.classList.add('hidden');
      }

      // Report button
      if (reportBtn) reportBtn.classList.remove('hidden');

      resultSection.classList.remove('hidden');
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    reset() {
      currentToken  = null;
      currentReport = null;
      currentFormatLabel = '';
      currentDownloadName = '';
      resultSection.classList.add('hidden');
      restoreResult.classList.add('hidden');
      restoreError.classList.add('hidden');
      restoreFileInfo.classList.add('hidden');
      restoreFile  = null;
      restoreToken = null;
      restoreFileInput.value  = '';
      restorePassword.value   = '';
      closePreviewModal();
      if (integrityBadge) integrityBadge.classList.add('hidden');
      if (reportBtn) reportBtn.classList.add('hidden');
    }
  };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
