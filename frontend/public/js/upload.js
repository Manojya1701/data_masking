/**
 * upload.js
 * Handles drag-and-drop, file input, validation, and file info display.
 * Exports: initUpload()
 */

export function initUpload(onFileReady) {
  const dropZone   = document.getElementById('drop-zone');
  const fileInput  = document.getElementById('file-input');
  const fileInfo   = document.getElementById('file-info-card');
  const fileName   = document.getElementById('file-name-display');
  const formatPill = document.getElementById('file-format-pill');
  const sizePill   = document.getElementById('file-size-pill');
  const iconWrap   = document.getElementById('file-icon-wrap');
  const changeBtn  = document.getElementById('change-file-btn');

  const ALLOWED_EXTS = new Set([
    'csv','tsv','json','jsonl','ndjson','yaml','yml','xml','html','htm',
    'pdf','parquet','avro','orc','jpg','jpeg','png'
  ]);

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function getExt(name) {
    return name.split('.').pop().toLowerCase();
  }

  function getFormatLabel(ext) {
    const map = {
      csv:'CSV', tsv:'TSV', json:'JSON', jsonl:'JSONL', ndjson:'NDJSON',
      yaml:'YAML', yml:'YAML', xml:'XML', html:'HTML', htm:'HTML',
      pdf:'PDF', parquet:'Parquet', avro:'Avro', orc:'ORC',
      jpg:'JPEG Image', jpeg:'JPEG Image', png:'PNG Image'
    };
    return map[ext] || ext.toUpperCase();
  }

  function getFileIcon(ext) {
    const iconMap = {
      csv: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#6366f1" stroke-width="1.5"/><path d="M6 8h10M6 11h10M6 14h6" stroke="#6366f1" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      tsv: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#6366f1" stroke-width="1.5"/><path d="M6 8h10M6 11h10M6 14h6" stroke="#6366f1" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      json: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#22d3ee" stroke-width="1.5"/><path d="M8 8c-1.5 0-2 1-2 3s.5 3 2 3M14 8c1.5 0 2 1 2 3s-.5 3-2 3" stroke="#22d3ee" stroke-width="1.3" stroke-linecap="round"/><circle cx="11" cy="11" r="1" fill="#22d3ee"/></svg>`,
      pdf: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#f43f5e" stroke-width="1.5"/><path d="M7 15V7h5l3 3v5H7z" stroke="#f43f5e" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 7v3h3" stroke="#f43f5e" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
      default: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#a855f7" stroke-width="1.5"/><path d="M7 15V7h6l3 3v5H7z" stroke="#a855f7" stroke-width="1.2" stroke-linejoin="round"/><path d="M13 7v3h3" stroke="#a855f7" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
    };
    if (['jpg','jpeg','png'].includes(ext)) {
      return `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#22c55e" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="#22c55e"/><path d="M2 15l5-5 3 3 3-4 5 6" stroke="#22c55e" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return iconMap[ext] || iconMap.default;
  }

  function showFile(file) {
    const ext = getExt(file.name);
    if (!ALLOWED_EXTS.has(ext)) {
      alert(`Unsupported file type: .${ext}`);
      return;
    }
    if (file.size > 104857600) {
      alert('File exceeds maximum size of 100 MB.');
      return;
    }
    fileName.textContent   = file.name;
    formatPill.textContent = getFormatLabel(ext);
    sizePill.textContent   = formatBytes(file.size);
    iconWrap.innerHTML     = getFileIcon(ext);
    fileInfo.classList.remove('hidden');
    dropZone.classList.add('hidden');
    onFileReady(file);
  }

  // Drag-and-drop
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) showFile(file);
  });

  // Keyboard
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

  // File input
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showFile(fileInput.files[0]);
  });

  // Change file button
  changeBtn.addEventListener('click', () => {
    fileInfo.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
    onFileReady(null);
  });

  return {
    reset() {
      fileInfo.classList.add('hidden');
      dropZone.classList.remove('hidden');
      fileInput.value = '';
    }
  };
}
