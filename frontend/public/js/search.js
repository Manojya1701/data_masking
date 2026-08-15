'use strict';

/**
 * Global Search Module
 * Provides header search autocomplete popover for UDPS features, operations, and formats.
 */

const SEARCH_INDEX = [
  // Features & Sections
  { title: 'File Protection Workspace', category: 'Feature', section: 'file-protection-section', desc: 'Upload, scan for PII, and protect structured files' },
  { title: 'Database Table Protection', category: 'Feature', section: 'db-protection-section', desc: 'Apply privacy operations directly to PostgreSQL customer records' },
  { title: 'Restore Encrypted File', category: 'Feature', section: 'restore-section', desc: 'Decrypt and restore AES-256 / ChaCha20 encrypted files' },
  { title: 'Supported Formats Catalog', category: 'Feature', section: 'formats-explorer-wrap', desc: 'Browse supported file formats across tabular, documents, and images' },

  // Operations
  { title: 'Masking', category: 'Operation', section: 'file-protection-section', op: 'mask', desc: 'Redact or replace sensitive fields using partial, character, or pseudonym masking' },
  { title: 'Partial Masking', category: 'Operation', section: 'file-protection-section', op: 'mask', desc: 'Mask string values keeping first and last characters (H****a)' },
  { title: 'Full Redaction', category: 'Operation', section: 'file-protection-section', op: 'mask', desc: 'Replace sensitive string values entirely with [REDACTED]' },
  { title: 'Character Masking', category: 'Operation', section: 'file-protection-section', op: 'mask', desc: 'Replace specific characters with asterisks (A****1234*)' },
  { title: 'Pseudonymization', category: 'Operation', section: 'file-protection-section', op: 'mask', desc: 'Replace real identifiers with consistent pseudonyms (PERSON_001)' },
  { title: 'Tokenization', category: 'Operation', section: 'file-protection-section', op: 'mask', desc: 'Map sensitive data to secure surrogate tokens (TKN_NAME_A7F2)' },

  { title: 'Hashing', category: 'Operation', section: 'file-protection-section', op: 'hash', desc: 'Transform values into one-way cryptographic digests (SHA-256, BLAKE3)' },
  { title: 'Sensitive Data Hashing', category: 'Operation', section: 'file-protection-section', op: 'hash', desc: 'Hash detected PII values while keeping document structure intact' },
  { title: 'Whole-File Integrity Hash', category: 'Operation', section: 'file-protection-section', op: 'hash', desc: 'Generate cryptographic digest verification report for the entire file' },
  { title: 'SHA-256 Algorithm', category: 'Algorithm', section: 'file-protection-section', op: 'hash', desc: 'Standard 256-bit secure hash algorithm' },
  { title: 'BLAKE3 Algorithm', category: 'Algorithm', section: 'file-protection-section', op: 'hash', desc: 'High-performance cryptographic hash algorithm' },

  { title: 'Encryption', category: 'Operation', section: 'file-protection-section', op: 'encrypt', desc: 'Encrypt files using AES-256-GCM, AES-256-CBC, or ChaCha20-Poly1305' },
  { title: 'AES-256-GCM Encryption', category: 'Algorithm', section: 'file-protection-section', op: 'encrypt', desc: 'Recommended authenticated symmetric cipher' },
  { title: 'AES-256-CBC Encryption', category: 'Algorithm', section: 'file-protection-section', op: 'encrypt', desc: 'CBC mode with HMAC integrity verification' },
  { title: 'ChaCha20-Poly1305 Encryption', category: 'Algorithm', section: 'file-protection-section', op: 'encrypt', desc: 'Modern high-speed authenticated stream cipher' },

  // Database 7 Operations
  { title: 'Anonymization — Database', category: 'Database', section: 'db-protection-section', desc: 'Remove identifying information from PostgreSQL table columns' },
  { title: 'Saved Protected Data', category: 'Database', section: 'db-protection-section', desc: 'View records written to protected_customer_data table' },

  // Formats
  { title: 'CSV — Comma-Separated Values', category: 'Format', section: 'formats-explorer-wrap', desc: 'Tabular data format supporting Mask, Hash, and Encrypt' },
  { title: 'PDF — Portable Document Format', category: 'Format', section: 'formats-explorer-wrap', desc: 'Document format supporting Visual Redaction and Encryption' },
  { title: 'JSON / JSONL', category: 'Format', section: 'formats-explorer-wrap', desc: 'Structured data format supporting full privacy operations' },
  { title: 'Parquet / Avro / ORC', category: 'Format', section: 'formats-explorer-wrap', desc: 'Binary columnar data formats supporting Mask, Hash, Encrypt' },
  { title: 'JPEG / PNG Images', category: 'Format', section: 'formats-explorer-wrap', desc: 'Image files supporting OCR Text Masking and Whole-File Hashing' },
];

export function initSearch() {
  const searchInput = document.getElementById('global-search-input');
  const searchPopover = document.getElementById('global-search-popover');
  const searchModal = document.getElementById('search-modal');
  const searchBtn = document.getElementById('nav-btn-search');
  const searchBackdrop = document.getElementById('search-modal-backdrop');

  if (!searchInput || !searchPopover) return;

  let activeIndex = -1;
  let currentResults = [];

  function openSearchModal() {
    if (searchModal) {
      searchModal.classList.remove('hidden');
    }
    searchInput.focus();
    if (searchInput.value.trim()) {
      renderPopover(filterSearch(searchInput.value));
    }
  }

  function closeSearchModal() {
    if (searchModal) {
      searchModal.classList.add('hidden');
    } else {
      searchPopover.classList.add('hidden');
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSearchModal();
    });
  }

  if (searchBackdrop) {
    searchBackdrop.addEventListener('click', () => {
      closeSearchModal();
    });
  }

  // Keyboard shortcut: Ctrl + K or Cmd + K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchModal && !searchModal.classList.contains('hidden')) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    } else if (e.key === 'Escape') {
      closeSearchModal();
    }
  });

  function filterSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return SEARCH_INDEX.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q)
    );
  }

  function renderPopover(results) {
    currentResults = results;
    activeIndex = -1;

    if (results.length === 0) {
      searchPopover.innerHTML = `<div class="search-empty">No features or formats matching "${escapeHtml(searchInput.value)}"</div>`;
      searchPopover.classList.remove('hidden');
      return;
    }

    const html = results.map((item, idx) => `
      <div class="search-result-item" data-idx="${idx}" tabindex="0">
        <div class="search-result-header">
          <span class="search-result-title">${escapeHtml(item.title)}</span>
          <span class="meta-pill neutral" style="font-size:0.7rem;">${escapeHtml(item.category)}</span>
        </div>
        <div class="search-result-desc">${escapeHtml(item.desc)}</div>
      </div>
    `).join('');

    searchPopover.innerHTML = html;
    searchPopover.classList.remove('hidden');

    // Add click listeners to items
    searchPopover.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        selectResult(currentResults[idx]);
      });
    });
  }

  function selectResult(item) {
    if (!item) return;
    closeSearchModal();
    searchInput.value = '';

    const targetEl = document.getElementById(item.section);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Trigger operation card selection if applicable
    if (item.op) {
      const opCard = document.querySelector(`.op-card[data-operation="${item.op}"]`);
      if (opCard) opCard.click();
    }
  }

  function highlightItem(index) {
    const items = searchPopover.querySelectorAll('.search-result-item');
    items.forEach((item, idx) => {
      if (idx === index) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    if (!val.trim()) {
      searchPopover.classList.add('hidden');
      return;
    }
    const results = filterSearch(val);
    renderPopover(results);
  });

  searchInput.addEventListener('keydown', e => {
    if (searchPopover.classList.contains('hidden') || currentResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      highlightItem(activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightItem(activeIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < currentResults.length) {
        selectResult(currentResults[activeIndex]);
      } else if (currentResults.length > 0) {
        selectResult(currentResults[0]);
      }
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
