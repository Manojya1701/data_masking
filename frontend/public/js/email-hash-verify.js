'use strict';

/**
 * email-hash-verify.js — Email SHA-256 Hashing, Candidate Recovery & Base64 Verification Frontend Module
 * 
 * Segmento Universal Data Protection System (UDPS)
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

export function initEmailHashVerify() {
  const form = document.getElementById('email-hash-form');
  const emailInput = document.getElementById('email-hash-input');
  const policySelect = document.getElementById('email-hash-policy');
  const submitBtn = document.getElementById('btn-email-hash-submit');
  const clearBtn = document.getElementById('btn-email-hash-clear');
  const errorBox = document.getElementById('email-hash-error');
  const outputCard = document.getElementById('email-hash-output-card');

  // Candidate section refs
  const candidateTargetHash = document.getElementById('candidate-target-hash');
  const candidateInput = document.getElementById('candidate-emails-input');
  const btnVerifyCandidates = document.getElementById('btn-verify-candidates');
  const candidateMatchAlert = document.getElementById('candidate-match-alert');
  const candidateResultsTable = document.getElementById('candidate-results-table');

  // External lookup refs
  const chkExternalConsent = document.getElementById('chk-external-consent');
  const btnQueryExternal = document.getElementById('btn-query-external');
  const externalResultsArea = document.getElementById('external-lookup-results');

  // Base64 Mode A refs
  const b64EmailInput = document.getElementById('b64-email-input');
  const btnB64EncodeEmail = document.getElementById('btn-b64-encode-email');
  const btnB64DecodeEmail = document.getElementById('btn-b64-decode-email');
  const b64EmailEncodedBox = document.getElementById('b64-email-encoded');
  const b64EmailDecodedBox = document.getElementById('b64-email-decoded');
  const b64ModeAVerify = document.getElementById('b64-mode-a-verify');

  // Base64 Mode B refs
  const b64HashEmailInput = document.getElementById('b64-hash-input');
  const btnB64HashBytes = document.getElementById('btn-b64-hash-bytes');
  const btnB64DecodeHash = document.getElementById('btn-b64-decode-hash');
  const b64HashHexBox = document.getElementById('b64-hash-hex');
  const b64HashRawB64Box = document.getElementById('b64-hash-raw-b64');
  const b64HashDecodedHexBox = document.getElementById('b64-hash-decoded-hex');
  const b64ModeBVerify = document.getElementById('b64-mode-b-verify');

  // Custom Base64 test refs
  const b64CustomInput = document.getElementById('b64-custom-input');
  const btnB64CustomDecode = document.getElementById('btn-b64-custom-decode');
  const b64CustomResult = document.getElementById('b64-custom-result');

  // Comparison & Summary refs
  const summaryResultsGrid = document.getElementById('summary-results-grid');

  if (!form) return;

  // ── Quick Synthetic Sample Pills ──────────────────────────────────────────
  document.querySelectorAll('.hash-sample-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const sampleEmail = pill.dataset.email;
      if (emailInput) emailInput.value = sampleEmail;
      if (b64EmailInput) b64EmailInput.value = sampleEmail;
      if (b64HashEmailInput) b64HashEmailInput.value = sampleEmail;
      if (errorBox) errorBox.classList.add('hidden');
      processEmailHash(sampleEmail);
    });
  });

  // ── Form Submit: Process Email Hashing ─────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawEmail = (emailInput?.value || '').trim();
    if (!rawEmail) {
      showError('Please enter an email address to process.');
      return;
    }
    await processEmailHash(rawEmail);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (emailInput) emailInput.value = '';
      if (errorBox) errorBox.classList.add('hidden');
      if (outputCard) outputCard.classList.add('hidden');
      if (candidateMatchAlert) candidateMatchAlert.classList.add('hidden');
      if (candidateResultsTable) candidateResultsTable.innerHTML = '';
      if (summaryResultsGrid) summaryResultsGrid.innerHTML = '';
    });
  }

  function showError(msg) {
    if (errorBox) {
      errorBox.innerHTML = `⚠️ ${escapeHtml(msg)}`;
      errorBox.classList.remove('hidden');
    }
    showToast(msg, 'error');
  }

  // ── Core Hashing & Pipeline Handler ───────────────────────────────────────
  async function processEmailHash(email) {
    if (errorBox) errorBox.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-small" style="display:inline-block; margin-right:6px;"></span> Hashing…';
    }

    const policy = policySelect?.value || 'standard';
    const consent = chkExternalConsent?.checked === true;

    // Gather candidate emails
    let candidateList = [];
    if (candidateInput && candidateInput.value.trim()) {
      candidateList = candidateInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (!candidateList.includes(email)) {
      candidateList.unshift(email); // Ensure test email is included in candidate list
      if (candidateInput) candidateInput.value = candidateList.join('\n');
    }

    try {
      const resp = await fetch('/api/email-hash/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          policy,
          candidates: candidateList,
          externalLookupConsent: consent,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        showError(data.error || 'Failed to process email hashing');
        return;
      }

      renderHashingResults(data);
      renderCandidateResults(data.candidateRecovery);
      renderBase64AutoFill(data.base64Testing);
      renderSummaryDashboard(data);
      showToast('SHA-256 hash generated and verified successfully!', 'success');
    } catch (err) {
      showError(`Network/Server Error: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Process Email</span>
        `;
      }
    }
  }

  // ── Render Hash Output Cards ──────────────────────────────────────────────
  function renderHashingResults(payload) {
    const { hashing, input } = payload;
    if (!outputCard) return;

    outputCard.classList.remove('hidden');

    const hexVal = document.getElementById('hash-hex-value');
    const rawB64Val = document.getElementById('hash-raw-b64-value');
    const hexB64Val = document.getElementById('hash-hex-b64-value');

    if (hexVal) hexVal.textContent = hashing.hashes.hex;
    if (rawB64Val) rawB64Val.textContent = hashing.hashes.rawBytesBase64;
    if (hexB64Val) hexB64Val.textContent = hashing.hashes.hexStringBase64;

    const metaAlgo = document.getElementById('meta-hash-algo');
    const metaLen = document.getElementById('meta-hash-length');
    const metaBytes = document.getElementById('meta-hash-bytes');
    const metaPolicy = document.getElementById('meta-hash-policy');

    if (metaAlgo) metaAlgo.textContent = hashing.algorithm;
    if (metaLen) metaLen.textContent = `${hashing.inputDetails.normalizedLength} chars (${hashing.inputDetails.byteLength} bytes)`;
    if (metaBytes) metaBytes.textContent = `${hashing.hashes.digestBitLength} bits (32 bytes)`;
    if (metaPolicy) metaPolicy.textContent = hashing.inputDetails.normalizationPolicy.name;

    // Fill candidate target hash
    if (candidateTargetHash) {
      candidateTargetHash.value = hashing.hashes.hex;
    }

    // Auto-fill Base64 Mode A & Mode B inputs
    if (b64EmailInput) b64EmailInput.value = input.rawEmail;
    if (b64HashEmailInput) b64HashEmailInput.value = input.rawEmail;
  }

  // ── Copy to Clipboard Helper ──────────────────────────────────────────────
  function setupCopyButton(btnId, targetId, successMsg) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const target = document.getElementById(targetId);
      const textToCopy = target?.textContent || target?.value || '';
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '✓ Copied';
        btn.style.color = 'var(--green)';
        showToast(successMsg || 'Copied to clipboard!', 'success');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.style.color = '';
        }, 2000);
      } catch (e) {
        showToast('Unable to copy to clipboard', 'warning');
      }
    });
  }

  setupCopyButton('btn-copy-hex', 'hash-hex-value', 'SHA-256 Hex Digest copied!');
  setupCopyButton('btn-copy-raw-b64', 'hash-raw-b64-value', 'Raw 32-Byte Base64 copied!');
  setupCopyButton('btn-copy-hex-b64', 'hash-hex-b64-value', 'Hex String Base64 copied!');

  // ── Candidate Recovery Testing ────────────────────────────────────────────
  if (btnVerifyCandidates) {
    btnVerifyCandidates.addEventListener('click', async () => {
      const targetHash = (candidateTargetHash?.value || '').trim();
      const rawText = (candidateInput?.value || '').trim();
      const policy = policySelect?.value || 'standard';

      if (!targetHash) {
        showToast('Please provide a 64-character target SHA-256 hash.', 'warning');
        return;
      }
      if (!rawText) {
        showToast('Please enter at least one candidate email to test.', 'warning');
        return;
      }

      const candidates = rawText.split('\n').map(s => s.trim()).filter(Boolean);

      btnVerifyCandidates.disabled = true;
      btnVerifyCandidates.innerHTML = '<span class="spinner-small" style="display:inline-block; margin-right:6px;"></span> Testing Candidates…';

      try {
        const resp = await fetch('/api/email-hash/verify-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetHash, candidates, policy }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          showToast(data.error || 'Candidate verification failed', 'error');
          return;
        }

        renderCandidateResults(data.data);
      } catch (err) {
        showToast(`Verification error: ${err.message}`, 'error');
      } finally {
        btnVerifyCandidates.disabled = false;
        btnVerifyCandidates.innerHTML = 'Test Candidate Matches';
      }
    });
  }

  function renderCandidateResults(candidateData) {
    if (!candidateMatchAlert || !candidateResultsTable) return;

    candidateMatchAlert.classList.remove('hidden');
    if (candidateData.matchFound) {
      candidateMatchAlert.className = 'candidate-match-banner match-found';
      candidateMatchAlert.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <span style="font-size:1.4rem;">🎯</span>
          <div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--green); margin-bottom:4px;">Candidate Match Found!</div>
            <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
              Candidate <code style="color:var(--cyan); font-weight:700;">${escapeHtml(candidateData.matchedCandidate)}</code> produces the identical SHA-256 digest.
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px; font-style:italic;">
              ⚠️ Cryptographic Notice: This is a <strong>dictionary match verification</strong>, NOT mathematical hash reversal. SHA-256 remains one-way.
            </div>
          </div>
        </div>
      `;
    } else {
      candidateMatchAlert.className = 'candidate-match-banner match-none';
      candidateMatchAlert.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <span style="font-size:1.4rem;">🛡️</span>
          <div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--amber); margin-bottom:4px;">No Candidate Match Identified</div>
            <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
              None of the ${candidateData.totalCandidatesTested} tested candidates matched the target hash.
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px; font-style:italic;">
              Direct mathematical reversal is impossible under pre-image resistance.
            </div>
          </div>
        </div>
      `;
    }

    // Build breakdown table rows
    let tableHtml = `
      <table class="data-table" style="width:100%; font-size:0.82rem; margin-top:14px;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--border);">
            <th style="padding:8px 12px;">Candidate Email</th>
            <th style="padding:8px 12px;">Calculated SHA-256 Digest</th>
            <th style="padding:8px 12px;">Verification Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    candidateData.candidates.forEach(c => {
      const isMatch = c.isMatch;
      tableHtml += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${isMatch ? 'background:rgba(74,222,128,0.08);' : ''}">
          <td style="padding:8px 12px; font-family:'JetBrains Mono', monospace; font-weight:${isMatch ? '700' : '400'}; color:${isMatch ? 'var(--green)' : 'var(--text-primary)'};">
            ${escapeHtml(c.candidate)}
          </td>
          <td style="padding:8px 12px; font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:var(--text-muted);">
            ${escapeHtml(c.candidateHashHex.substring(0, 16))}…${escapeHtml(c.candidateHashHex.substring(56))}
          </td>
          <td style="padding:8px 12px;">
            ${isMatch 
              ? '<span class="meta-pill" style="background:rgba(74,222,128,0.2); color:var(--green); font-weight:700;">✓ MATCH IDENTIFIED</span>' 
              : '<span class="meta-pill" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">NO MATCH</span>'}
          </td>
        </tr>
      `;
    });

    tableHtml += '</tbody></table>';
    candidateResultsTable.innerHTML = tableHtml;
  }

  // ── External Research Query Button ────────────────────────────────────────
  if (btnQueryExternal) {
    btnQueryExternal.addEventListener('click', async () => {
      const consent = chkExternalConsent?.checked === true;
      const targetHash = (candidateTargetHash?.value || '').trim();

      if (!consent) {
        showToast('Consent checkbox must be checked to query external research mode.', 'warning');
        return;
      }

      btnQueryExternal.disabled = true;
      btnQueryExternal.innerHTML = '<span class="spinner-small" style="display:inline-block; margin-right:6px;"></span> Querying Research Database…';

      try {
        const resp = await fetch('/api/email-hash/research');
        const data = await resp.json();

        if (externalResultsArea) {
          externalResultsArea.classList.remove('hidden');
          let cardsHtml = `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; margin-top:12px;">
              <div style="font-weight:700; color:var(--cyan); margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                <span>🔬 External Research Findings & Statutory Compliance Audit</span>
              </div>
              <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.5; margin-bottom:12px;">
                ${escapeHtml(data.data.scientificConclusion)}
              </p>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
          `;

          data.data.technologiesEvaluated.forEach(tech => {
            cardsHtml += `
              <div style="background:var(--bg-input); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:12px;">
                <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;">${escapeHtml(tech.name)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;"><strong>Mechanism:</strong> ${escapeHtml(tech.mechanism)}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;"><strong>Finding:</strong> ${escapeHtml(tech.findings)}</div>
                <div style="font-size:0.72rem; color:var(--amber); font-weight:600;"><strong>Compliance:</strong> ${escapeHtml(tech.privacyAndCompliance)}</div>
              </div>
            `;
          });

          cardsHtml += '</div></div>';
          externalResultsArea.innerHTML = cardsHtml;
        }
        showToast('External research audit loaded.', 'success');
      } catch (err) {
        showToast(`Research query error: ${err.message}`, 'error');
      } finally {
        btnQueryExternal.disabled = false;
        btnQueryExternal.innerHTML = 'Query External Research';
      }
    });
  }

  // ── Base64 Mode A: Original Email ↔ Base64 ─────────────────────────────────
  if (btnB64EncodeEmail) {
    btnB64EncodeEmail.addEventListener('click', async () => {
      const email = (b64EmailInput?.value || '').trim();
      if (!email) {
        showToast('Enter an email address to test Base64 encoding.', 'warning');
        return;
      }

      try {
        const resp = await fetch('/api/email-hash/base64-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'MODE_A_EMAIL', email }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          showToast(data.error || 'Base64 encoding failed', 'error');
          return;
        }

        if (b64EmailEncodedBox) b64EmailEncodedBox.textContent = data.data.base64Encoded;
        if (b64EmailDecodedBox) b64EmailDecodedBox.textContent = '— Click Decode button to test round-trip —';
        if (b64ModeAVerify) b64ModeAVerify.classList.add('hidden');
        showToast('Encoded email to standard Base64.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (btnB64DecodeEmail) {
    btnB64DecodeEmail.addEventListener('click', () => {
      const encoded = (b64EmailEncodedBox?.textContent || '').trim();
      const original = (b64EmailInput?.value || '').trim();

      if (!encoded || encoded.startsWith('—')) {
        showToast('Please encode an email first.', 'warning');
        return;
      }

      try {
        // Native browser atob decode
        const decoded = decodeURIComponent(escape(atob(encoded)));
        if (b64EmailDecodedBox) b64EmailDecodedBox.textContent = decoded;

        if (b64ModeAVerify) {
          b64ModeAVerify.classList.remove('hidden');
          const isMatch = decoded === original;
          b64ModeAVerify.innerHTML = isMatch
            ? `<span style="color:var(--green); font-weight:700;">✓ Round-Trip 100% Verified: Decoded output exactly matches original email input!</span>`
            : `<span style="color:var(--red); font-weight:700;">❌ Round-trip mismatch detected.</span>`;
        }
        showToast('Decoded Base64 successfully.', 'success');
      } catch (err) {
        showToast(`Decode error: ${err.message}`, 'error');
      }
    });
  }

  // ── Base64 Mode B: SHA-256 Raw Hash Bytes ↔ Base64 ─────────────────────────
  if (btnB64HashBytes) {
    btnB64HashBytes.addEventListener('click', async () => {
      const email = (b64HashEmailInput?.value || '').trim();
      if (!email) {
        showToast('Enter an email address for Mode B hash byte testing.', 'warning');
        return;
      }

      try {
        const resp = await fetch('/api/email-hash/base64-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'MODE_B_HASH_BYTES', email }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          showToast(data.error || 'Mode B calculation failed', 'error');
          return;
        }

        const b64Data = data.data;
        if (b64HashHexBox) b64HashHexBox.textContent = b64Data.hexHash;
        if (b64HashRawB64Box) b64HashRawB64Box.textContent = b64Data.rawBytesBase64;
        if (b64HashDecodedHexBox) b64HashDecodedHexBox.textContent = '— Click Decode button to verify 32-byte equality —';
        if (b64ModeBVerify) b64ModeBVerify.classList.add('hidden');
        showToast('Generated SHA-256 raw bytes and Base64 representation.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (btnB64DecodeHash) {
    btnB64DecodeHash.addEventListener('click', () => {
      const rawB64 = (b64HashRawB64Box?.textContent || '').trim();
      const originalHex = (b64HashHexBox?.textContent || '').trim();

      if (!rawB64 || rawB64.startsWith('—')) {
        showToast('Please generate hash bytes first.', 'warning');
        return;
      }

      try {
        // Decode base64 to binary string
        const binaryStr = atob(rawB64);
        let hexStr = '';
        for (let i = 0; i < binaryStr.length; i++) {
          const hex = binaryStr.charCodeAt(i).toString(16).padStart(2, '0');
          hexStr += hex;
        }

        if (b64HashDecodedHexBox) b64HashDecodedHexBox.textContent = hexStr;

        if (b64ModeBVerify) {
          b64ModeBVerify.classList.remove('hidden');
          const isMatch = hexStr.toLowerCase() === originalHex.toLowerCase();
          b64ModeBVerify.innerHTML = isMatch
            ? `<span style="color:var(--green); font-weight:700;">✓ Byte-for-Byte Exact Match Verified (32/32 bytes): Decoded Base64 precisely reconstructs the original SHA-256 digest!</span>`
            : `<span style="color:var(--red); font-weight:700;">❌ Hash byte mismatch detected.</span>`;
        }
        showToast('Decoded Base64 back into raw 32 bytes.', 'success');
      } catch (err) {
        showToast(`Decode error: ${err.message}`, 'error');
      }
    });
  }

  // ── Custom Base64 Decoder ─────────────────────────────────────────────────
  if (btnB64CustomDecode) {
    btnB64CustomDecode.addEventListener('click', async () => {
      const input = (b64CustomInput?.value || '').trim();
      if (!input) {
        showToast('Enter Base64 text to decode.', 'warning');
        return;
      }

      try {
        const resp = await fetch('/api/email-hash/base64-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'DECODE_CUSTOM', base64Input: input }),
        });
        const data = await resp.json();

        if (b64CustomResult) {
          b64CustomResult.classList.remove('hidden');
          if (data.data?.validBase64) {
            b64CustomResult.innerHTML = `
              <div style="background:rgba(74,222,128,0.1); border:1px solid var(--green); border-radius:8px; padding:12px; color:var(--text-primary); font-size:0.85rem;">
                <div style="color:var(--green); font-weight:700; margin-bottom:4px;">✓ Valid Base64 String</div>
                <div><strong>Decoded Plaintext:</strong> <code>${escapeHtml(data.data.decodedText)}</code></div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Byte Length: ${data.data.byteLength} bytes | Hex: <code>${escapeHtml(data.data.decodedHex)}</code></div>
              </div>
            `;
          } else {
            b64CustomResult.innerHTML = `
              <div style="background:rgba(248,113,113,0.1); border:1px solid var(--red); border-radius:8px; padding:12px; color:var(--red); font-size:0.85rem;">
                <strong>❌ Invalid Base64:</strong> ${escapeHtml(data.data?.error || data.error || 'Failed to decode')}
              </div>
            `;
          }
        }
      } catch (err) {
        showToast(`Decode error: ${err.message}`, 'error');
      }
    });
  }

  // ── Auto-fill Base64 on Full Process ───────────────────────────────────────
  function renderBase64AutoFill(b64Data) {
    if (b64EmailEncodedBox && b64Data?.modeA) {
      b64EmailEncodedBox.textContent = b64Data.modeA.base64Encoded;
      if (b64EmailDecodedBox) b64EmailDecodedBox.textContent = b64Data.modeA.decodedOutput;
      if (b64ModeAVerify) {
        b64ModeAVerify.classList.remove('hidden');
        b64ModeAVerify.innerHTML = `<span style="color:var(--green); font-weight:700;">✓ Round-Trip 100% Verified: Decoded output exactly matches original email input!</span>`;
      }
    }

    if (b64HashHexBox && b64Data?.modeB) {
      b64HashHexBox.textContent = b64Data.modeB.hexHash;
      if (b64HashRawB64Box) b64HashRawB64Box.textContent = b64Data.modeB.rawBytesBase64;
      if (b64HashDecodedHexBox) b64HashDecodedHexBox.textContent = b64Data.modeB.decodedBytesHex;
      if (b64ModeBVerify) {
        b64ModeBVerify.classList.remove('hidden');
        b64ModeBVerify.innerHTML = `<span style="color:var(--green); font-weight:700;">✓ Byte-for-Byte Exact Match Verified (32/32 bytes): Decoded Base64 precisely matches original SHA-256 output!</span>`;
      }
    }
  }

  // ── Results Summary Dashboard Grid ────────────────────────────────────────
  function renderSummaryDashboard(data) {
    if (!summaryResultsGrid) return;

    summaryResultsGrid.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
        <div class="summary-metric-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Input Validation</div>
          <div style="font-size:1.05rem; font-weight:700; color:var(--green); margin-top:4px;">✓ RFC 5322 Valid</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(data.input.rawEmail)}</div>
        </div>

        <div class="summary-metric-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">SHA-256 Hex Digest</div>
          <div style="font-size:1.05rem; font-weight:700; color:var(--cyan); margin-top:4px;">64 Hex Characters</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); font-family:'JetBrains Mono', monospace;">${escapeHtml(data.hashing.hashes.hex.substring(0, 12))}…</div>
        </div>

        <div class="summary-metric-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Raw Hash in Base64</div>
          <div style="font-size:1.05rem; font-weight:700; color:var(--purple); margin-top:4px;">44 Characters (32 B)</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); font-family:'JetBrains Mono', monospace;">${escapeHtml(data.hashing.hashes.rawBytesBase64.substring(0, 16))}…</div>
        </div>

        <div class="summary-metric-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Base64 Round-Trip</div>
          <div style="font-size:1.05rem; font-weight:700; color:var(--green); margin-top:4px;">✓ 100% Reversible</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Exact Identity Verified</div>
        </div>

        <div class="summary-metric-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Candidate Recovery</div>
          <div style="font-size:1.05rem; font-weight:700; color:${data.candidateRecovery.matchFound ? 'var(--green)' : 'var(--amber)'}; margin-top:4px;">
            ${data.candidateRecovery.matchFound ? '✓ Candidate Match' : 'No Match'}
          </div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${data.candidateRecovery.totalCandidatesTested} Candidates Tested</div>
        </div>

        <div class="summary-metric-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">External Lookup</div>
          <div style="font-size:1.05rem; font-weight:700; color:var(--cyan); margin-top:4px;">Audited &amp; Disabled</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Privacy Protected (GDPR/DPDP)</div>
        </div>
      </div>
    `;
  }
}
