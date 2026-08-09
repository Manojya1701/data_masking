/**
 * download.js
 * Handles result display, file download, and the Restore Encrypted File flow.
 * Exports: initDownload(), showResult(), showRestoreResult()
 */

export function initDownload() {
  const downloadBtn  = document.getElementById('download-btn');
  const newFileBtn   = document.getElementById('new-file-btn');
  const resultSection = document.getElementById('result-section');

  let currentToken = null;

  downloadBtn.addEventListener('click', () => {
    if (currentToken) triggerDownload(currentToken);
  });

  newFileBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('udps:reset'));
  });

  function triggerDownload(token) {
    const a = document.createElement('a');
    a.href = `/api/download/${token}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Restore flow
  const restoreDropZone   = document.getElementById('restore-drop-zone');
  const restoreFileInput  = document.getElementById('restore-file-input');
  const restoreFileInfo   = document.getElementById('restore-file-info');
  const restoreFileName   = document.getElementById('restore-file-name');
  const restorePassword   = document.getElementById('restore-password');
  const restoreBtn        = document.getElementById('restore-btn');
  const restoreBtnText    = document.getElementById('restore-btn-text');
  const restoreResult     = document.getElementById('restore-result');
  const restoreError      = document.getElementById('restore-error');
  const restoreErrorMsg   = document.getElementById('restore-error-message');
  const restoreDownloadBtn = document.getElementById('restore-download-btn');
  const toggleRestorePw   = document.getElementById('toggle-restore-password');
  const restoreEyeOpen    = document.getElementById('restore-eye-open');
  const restoreEyeClosed  = document.getElementById('restore-eye-closed');

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

    const formData = new FormData();
    formData.append('file', restoreFile);
    formData.append('password', pw);

    try {
      const resp = await fetch('/api/restore-file', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        showRestoreError(data.error || 'Decryption failed.');
      } else {
        restoreToken = data.token;
        restoreResult.classList.remove('hidden');
        restorePassword.value = '';
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

  return {
    showResult(data) {
      currentToken = data.token;

      document.getElementById('result-format').textContent    = data.formatLabel || data.format;
      document.getElementById('result-operation').textContent = capitalize(data.operation);

      const algoRow = document.getElementById('result-algo-row');
      const algoVal = document.getElementById('result-algorithm');
      if (data.algorithm && data.operation === 'hash') {
        algoVal.textContent = data.algorithm.toUpperCase();
        algoRow.classList.remove('hidden');
      } else {
        algoRow.classList.add('hidden');
      }

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

      resultSection.classList.remove('hidden');
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    reset() {
      currentToken = null;
      resultSection.classList.add('hidden');
      restoreResult.classList.add('hidden');
      restoreError.classList.add('hidden');
      restoreFileInfo.classList.add('hidden');
      restoreFile = null;
      restoreToken = null;
      restoreFileInput.value = '';
      restorePassword.value = '';
    }
  };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
