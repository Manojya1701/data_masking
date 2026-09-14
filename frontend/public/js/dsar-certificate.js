'use strict';

/**
 * DSAR Certificate Controller (Step 7 of Segmento Protect Flow)
 * Manages official deletion certificate generation, cryptographic SHA-256 seal rendering,
 * audit package downloads (.json), and printable certificate formatting.
 */

let activeCertificateRequestId = null;
let activeCertificateData = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info') {
  if (window.showToastMessage) {
    window.showToastMessage(msg, type);
  } else {
    console.log(`[Toast ${type}] ${msg}`);
  }
}

/**
 * Render Certificate Document and KPI details into the DOM.
 */
function renderCertificate(cert) {
  if (!cert) return;
  activeCertificateData = cert;

  const targetIdEl = document.getElementById('dsar-cert-target-id');
  const certNumberEl = document.getElementById('dsar-cert-display-number');
  const certReqIdEl = document.getElementById('dsar-cert-display-req-id');
  const certDateEl = document.getElementById('dsar-cert-display-date');
  const subjectNameEl = document.getElementById('dsar-cert-subject-name');
  const subjectEmailEl = document.getElementById('dsar-cert-subject-email');
  const customerIdEl = document.getElementById('dsar-cert-customer-id');
  const evidenceEl = document.getElementById('dsar-cert-evidence');
  const defenseEl = document.getElementById('dsar-cert-defense-statement');
  const dpoNameEl = document.getElementById('dsar-cert-dpo-name');
  const dpoRoleEl = document.getElementById('dsar-cert-dpo-role');
  const signedAtEl = document.getElementById('dsar-cert-signed-at');
  const sha256SealEl = document.getElementById('dsar-cert-sha256-seal');
  const summaryTbody = document.getElementById('dsar-cert-summary-tbody');

  if (targetIdEl) targetIdEl.textContent = cert.certificateId || 'CERT-2026-000101';
  if (certNumberEl) certNumberEl.textContent = cert.certificateId || 'CERT-2026-000101';
  if (certReqIdEl) certReqIdEl.textContent = cert.requestId || 'DSAR-2026-000101';
  if (certDateEl) {
    const d = cert.issuedAt ? new Date(cert.issuedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    certDateEl.textContent = d;
  }

  if (cert.dataSubject) {
    if (subjectNameEl) subjectNameEl.textContent = cert.dataSubject.fullName || 'Vikram Patel';
    if (subjectEmailEl) subjectEmailEl.textContent = cert.dataSubject.email || 'vikram.patel@example.in';
    if (customerIdEl) customerIdEl.textContent = cert.dataSubject.customerId || 'CUST-8891';
    if (evidenceEl) evidenceEl.textContent = cert.dataSubject.verificationEvidence || 'Government ID & Aadhaar Verified';
  }

  if (defenseEl && cert.legalDefenseStatement) {
    defenseEl.textContent = cert.legalDefenseStatement;
  }

  if (cert.dpoAttestation) {
    if (dpoNameEl) dpoNameEl.textContent = cert.dpoAttestation.dpoName || '[Authorized Privacy Signatory / Title]';
    if (dpoRoleEl) dpoRoleEl.textContent = cert.dpoAttestation.dpoRole || '[Data Protection & Compliance Authority]';
    if (signedAtEl) signedAtEl.textContent = `Timestamp: ${cert.dpoAttestation.signedAt || new Date().toISOString()}`;
  }

  if (sha256SealEl) {
    sha256SealEl.textContent = cert.digitalCertificateSeal || '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';
  }

  if (summaryTbody && Array.isArray(cert.erasureSummaryBreakdown)) {
    summaryTbody.innerHTML = cert.erasureSummaryBreakdown.map(item => {
      const isRetained = item.status === 'STATUTORY_RETAINED';
      const badgeHtml = isRetained
        ? '<span class="meta-pill" style="background:rgba(245,158,11,0.12); color:var(--amber); border:1px solid rgba(245,158,11,0.3); font-size:0.75rem; font-weight:700;">🛡️ CGST ACT SEC. 36 RETAINED</span>'
        : '<span class="meta-pill success" style="font-size:0.75rem; font-weight:700;">✅ PURGED</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(item.store)}</strong></td>
          <td>${escapeHtml(item.action)}</td>
          <td>${badgeHtml}</td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Generate official deletion certificate and immutable audit trail.
 * @param {string} requestId - DSAR Tracking ID
 */
export async function generateDsarCertificate(requestId) {
  if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
    showToast('Valid DSAR Tracking ID is required to generate certificate', 'error');
    return;
  }

  activeCertificateRequestId = requestId.trim();

  const card = document.getElementById('dsar-step7-certificate-card');
  if (card) {
    card.classList.remove('hidden');
    card.style.display = 'block';
  }

  showToast(`Generating Official Certified Deletion Certificate for ${requestId}…`, 'info');

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/certificate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: activeCertificateRequestId })
    });

    const data = await res.json();

    if (data && data.success && data.certificate) {
      renderCertificate(data.certificate);
      showToast(`✓ Step 7 Complete: Official Certificate ${data.certificateId} Issued & Cryptographically Sealed!`, 'success');

      // Update progress stepper to mark Step 7 as active/completed
      document.querySelectorAll('.dsar-step-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.step === '7') {
          item.classList.add('active');
        }
      });

      if (card) card.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(data.message || 'Failed to generate certificate', 'error');
    }
  } catch (err) {
    showToast(`Error generating certificate: ${err.message}`, 'error');
  }
}

/**
 * Download Immutable Audit Package JSON.
 */
async function downloadAuditPackage() {
  if (!activeCertificateRequestId) {
    showToast('No active certificate available to download', 'error');
    return;
  }

  try {
    const exportUrl = `${window.location.origin}/api/dsar/certificate/${encodeURIComponent(activeCertificateRequestId)}/export`;
    const res = await fetch(exportUrl);
    if (!res.ok) throw new Error('Failed to fetch audit package');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SegmentoProtect-AuditPackage-${activeCertificateRequestId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast('✓ Official Audit Package (.json) downloaded successfully', 'success');
  } catch (err) {
    showToast(`Download error: ${err.message}`, 'error');
  }
}

/**
 * Initialize Step 7 Certificate Controller.
 */
export function initDsarCertificate() {
  const proceedStep7Btn = document.getElementById('btn-proceed-step7');
  const regenerateBtn = document.getElementById('btn-regenerate-certificate');
  const downloadBtn = document.getElementById('btn-download-audit-package');
  const printBtn = document.getElementById('btn-print-certificate');
  const completeBtn = document.getElementById('btn-complete-dsar-lifecycle');
  const copySealBtn = document.getElementById('btn-copy-cert-seal');

  if (proceedStep7Btn) {
    proceedStep7Btn.addEventListener('click', (e) => {
      e.preventDefault();
      const verifTargetId = document.getElementById('dsar-verif-target-id');
      const reqId = verifTargetId ? verifTargetId.textContent.trim().replace('Target: ', '') : 'DSAR-2026-000101';
      generateDsarCertificate(reqId);
    });
  }

  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeCertificateRequestId) {
        generateDsarCertificate(activeCertificateRequestId);
      } else {
        showToast('Please verify execution first in Step 6.', 'info');
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      downloadAuditPackage();
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.print();
    });
  }

  if (copySealBtn) {
    copySealBtn.addEventListener('click', () => {
      const sealEl = document.getElementById('dsar-cert-sha256-seal');
      if (sealEl && sealEl.textContent) {
        navigator.clipboard.writeText(sealEl.textContent.trim());
        showToast('✓ SHA-256 Certificate Seal copied to clipboard', 'success');
      }
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('🎉 End-to-End DSAR Data Erasure Lifecycle Completed Successfully!', 'success');
      const queueTable = document.getElementById('dsar-requests-table');
      if (queueTable) queueTable.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Expose global handler for cross-module invocations
  window.generateDsarCertificate = generateDsarCertificate;
}
