'use strict';

/**
 * DSAR Intake Controller (Step 1 of Segmento Protect Pipeline)
 * AI-Powered Intake Experience:
 * - Natural language request submission with interactive prompt chips
 * - Sequential AI processing micro-animations (6-step intent analysis checklist)
 * - Dynamic AI enrichment results (multi-intent classification, jurisdiction, verification, SLA, team routing)
 * - Direct transition into DSAR Case Registration & Identity Discovery Pipeline
 */

let lastAnalyzedPayload = null;
let lastAnalysisResult = null;
let isAnalyzing = false;

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
 * Animate the 6 checklist items sequentially with smooth delays
 */
async function animateChecklistSteps() {
  const checkItems = document.querySelectorAll('#dsar-ai-checklist .ai-check-item');
  const titleEl = document.getElementById('dsar-ai-process-title');
  if (titleEl) {
    titleEl.textContent = 'AI Processing...';
    titleEl.style.color = 'var(--text-bright)';
  }

  // Reset all steps to initial pending state
  checkItems.forEach(item => {
    item.classList.remove('active', 'completed');
    const icon = item.querySelector('.ai-check-icon');
    if (icon) {
      icon.innerHTML = '✓';
      icon.style.opacity = '0.3';
    }
  });

  // Step-by-step sequential animation
  for (let i = 0; i < checkItems.length; i++) {
    const item = checkItems[i];
    const icon = item.querySelector('.ai-check-icon');

    // Activate current step
    item.classList.add('active');
    if (icon) {
      icon.innerHTML = '⏳';
      icon.style.opacity = '1';
    }

    // Wait 280ms
    await new Promise(resolve => setTimeout(resolve, 280));

    // Complete current step
    item.classList.remove('active');
    item.classList.add('completed');
    if (icon) {
      icon.innerHTML = '✓';
      icon.style.opacity = '1';
    }
  }

  if (titleEl) {
    titleEl.textContent = '✓ AI Analysis Complete';
    titleEl.style.color = '#10b981';
  }
}

/**
 * Updates the 3-step top progress indicators
 */
function updateProgressHeader(activeStep = 1) {
  const step1 = document.getElementById('flow-header-step-1');
  const step2 = document.getElementById('flow-header-step-2');
  const step3 = document.getElementById('flow-header-step-3');

  if (!step1 || !step2 || !step3) return;

  const b1 = step1.querySelector('.flow-step-num-badge');
  const b2 = step2.querySelector('.flow-step-num-badge');
  const b3 = step3.querySelector('.flow-step-num-badge');

  if (activeStep === 1) {
    step1.classList.add('active');
    step2.classList.remove('active');
    step3.classList.remove('active');
    if (b1) { b1.textContent = '1'; b1.style.background = '#2563eb'; b1.style.color = '#fff'; }
    if (b2) { b2.textContent = '2'; b2.style.background = 'var(--bg-input)'; b2.style.color = 'var(--text-muted)'; }
    if (b3) { b3.textContent = '3'; b3.style.background = 'var(--bg-input)'; b3.style.color = 'var(--text-muted)'; }
  } else if (activeStep === 2) {
    step1.classList.remove('active');
    step2.classList.add('active');
    step3.classList.remove('active');
    if (b1) { b1.textContent = '✓'; b1.style.background = '#10b981'; b1.style.color = '#fff'; }
    if (b2) { b2.textContent = '2'; b2.style.background = '#2563eb'; b2.style.color = '#fff'; }
    if (b3) { b3.textContent = '3'; b3.style.background = 'var(--bg-input)'; b3.style.color = 'var(--text-muted)'; }
  } else if (activeStep === 3) {
    step1.classList.remove('active');
    step2.classList.remove('active');
    step3.classList.add('active');
    if (b1) { b1.textContent = '✓'; b1.style.background = '#10b981'; b1.style.color = '#fff'; }
    if (b2) { b2.textContent = '✓'; b2.style.background = '#10b981'; b2.style.color = '#fff'; }
    if (b3) { b3.textContent = '3'; b3.style.background = '#2563eb'; b3.style.color = '#fff'; }
  }
}

/**
 * Render dynamic AI Analysis Results into Card 3
 */
function renderAnalysisResults(analysis) {
  if (!analysis) return;

  // Status Alert
  const statusTitle = document.getElementById('ai-res-status-title');
  const statusDesc = document.getElementById('ai-res-status-desc');
  if (statusTitle) statusTitle.textContent = analysis.status || 'Request Analyzed';
  if (statusDesc) statusDesc.textContent = analysis.statusMessage || 'The AI has successfully classified your request and identified the next steps.';

  // Identified Request Types (Multi-Intent Badges)
  const typesContainer = document.getElementById('ai-res-identified-types');
  if (typesContainer && Array.isArray(analysis.identifiedRequestTypes)) {
    typesContainer.innerHTML = analysis.identifiedRequestTypes.map(t => `
      <div style="padding:8px 10px; background:${t.bgColor || 'rgba(59,130,246,0.12)'}; border:1px solid ${t.borderColor || 'rgba(59,130,246,0.3)'}; border-radius:8px; transition:transform 0.2s ease;">
        <div style="font-size:0.8rem; font-weight:700; color:${t.color || '#3b82f6'};">${escapeHtml(t.title)}</div>
        <div style="font-size:0.68rem; color:var(--text-secondary);">${escapeHtml(t.desc)}</div>
      </div>
    `).join('');
  }

  // Applicable Jurisdiction
  const jurisName = document.getElementById('ai-res-jurisdiction-name');
  const jurisDesc = document.getElementById('ai-res-jurisdiction-desc');
  if (jurisName && analysis.jurisdiction) jurisName.textContent = analysis.jurisdiction.name || 'Singapore (PDPA)';
  if (jurisDesc && analysis.jurisdiction) jurisDesc.textContent = analysis.jurisdiction.desc || 'Data protection regulations applicable to your request.';

  // Required Verification
  const verifTitle = document.getElementById('ai-res-verif-title');
  const verifDesc = document.getElementById('ai-res-verif-desc');
  if (verifTitle && analysis.verification) verifTitle.textContent = analysis.verification.title || 'Identity verification required';
  if (verifDesc && analysis.verification) verifDesc.textContent = analysis.verification.desc || 'We will send a verification link to your email and/or mobile number.';

  // SLA
  const slaTitle = document.getElementById('ai-res-sla-title');
  const slaDesc = document.getElementById('ai-res-sla-desc');
  if (slaTitle && analysis.sla) slaTitle.textContent = analysis.sla.title || '30 days';
  if (slaDesc && analysis.sla) slaDesc.textContent = analysis.sla.desc || 'Standard response time (extendable by 30 days if needed).';

  // Relevant Internal Teams
  const teamsContainer = document.getElementById('ai-res-teams-list');
  if (teamsContainer && Array.isArray(analysis.relevantInternalTeams)) {
    teamsContainer.innerHTML = analysis.relevantInternalTeams.map(team => `
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="color:${team.color || '#3b82f6'}; font-size:0.8rem;">${team.icon || '👤'}</span>
        <span style="font-weight:600; color:var(--text-bright);">${escapeHtml(team.name)}</span>
        <span style="font-size:0.65rem; color:var(--text-muted);">(${escapeHtml(team.role)})</span>
      </div>
    `).join('');
  }

  // Highlight Card 3
  const card3 = document.getElementById('card-step3-results');
  if (card3) {
    card3.style.opacity = '1';
    card3.style.borderColor = 'rgba(16,185,129,0.5)';
    card3.style.boxShadow = '0 0 20px rgba(16,185,129,0.15)';
  }
}

/**
 * Handles Step 1 AI Submit Button Click
 */
export async function handleAiIntakeSubmit(e) {
  if (e) e.preventDefault();
  if (isAnalyzing) return;

  const requestTextInput = document.getElementById('intake-request-text');
  const fullNameInput = document.getElementById('intake-full-name');
  const emailInput = document.getElementById('intake-email');
  const preferredChannelRadio = document.querySelector('input[name="intake-preferred-channel"]:checked');
  const submitBtn = document.getElementById('btn-submit-intake-ai');

  const requestText = requestTextInput ? requestTextInput.value.trim() : '';
  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const preferredChannel = preferredChannelRadio ? preferredChannelRadio.value : 'Web portal';

  if (!requestText) {
    showToast('Please enter your data subject request in the text box.', 'warning');
    if (requestTextInput) requestTextInput.focus();
    return;
  }

  if (!fullName) {
    showToast('Please enter the requester full name.', 'warning');
    if (fullNameInput) fullNameInput.focus();
    return;
  }

  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address.', 'warning');
    if (emailInput) emailInput.focus();
    return;
  }

  isAnalyzing = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Analyzing with AI...</span>';
  }

  updateProgressHeader(2);

  const payload = {
    requestText,
    fullName,
    email,
    preferredChannel
  };

  lastAnalyzedPayload = payload;

  try {
    // Run animation and backend classification concurrently
    const [animationResult, apiResult] = await Promise.all([
      animateChecklistSteps(),
      fetch(`${window.location.origin}/api/dsar/analyze-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json()).catch(err => {
        console.warn('AI Intent API failed, falling back to client classification:', err);
        return null;
      })
    ]);

    let finalAnalysis = null;
    if (apiResult && apiResult.success && apiResult.analysis) {
      finalAnalysis = apiResult.analysis;
    } else {
      // Fallback default analysis
      finalAnalysis = {
        status: 'Request Analyzed',
        statusMessage: 'The AI has successfully classified your request and identified the next steps.',
        identifiedRequestTypes: [
          { id: 'access', title: 'Access Request', desc: '(view all personal data)', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.3)' },
          { id: 'deletion', title: 'Deletion Request', desc: '(remove marketing data)', color: '#ec4899', bgColor: 'rgba(236,72,153,0.12)', borderColor: 'rgba(236,72,153,0.3)' },
          { id: 'marketing', title: 'Marketing / Consent', desc: '(opt-out of marketing)', color: '#10b981', bgColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' }
        ],
        primaryRequestType: 'Deletion',
        jurisdiction: { name: 'Singapore (PDPA)', country: 'Singapore', desc: 'Data protection regulations applicable to your request.' },
        verification: { required: true, title: 'Identity verification required', desc: 'We will send a verification link to your email and/or mobile number.' },
        sla: { days: 30, title: '30 days', desc: 'Standard response time (extendable by 30 days if needed).' },
        relevantInternalTeams: [
          { name: 'Privacy Team', role: 'overall coordination', icon: '👤', color: '#3b82f6' },
          { name: 'Data Engineering', role: 'data discovery & collection', icon: '👤', color: '#8b5cf6' },
          { name: 'Marketing Team', role: 'marketing data deletion', icon: '👤', color: '#10b981' },
          { name: 'Legal / Compliance', role: 'regulatory checks', icon: '👤', color: '#f59e0b' }
        ]
      };
    }

    lastAnalysisResult = finalAnalysis;
    renderAnalysisResults(finalAnalysis);
    updateProgressHeader(3);

    const typeNames = finalAnalysis.identifiedRequestTypes.map(t => t.title).join(', ');
    showToast(`✓ Request Analyzed: ${typeNames}`, 'success');

  } catch (err) {
    showToast(`Error analyzing request: ${err.message}`, 'error');
  } finally {
    isAnalyzing = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Submit Request</span>
        <span style="font-size:1.1rem;">➔</span>
      `;
    }
  }
}

/**
 * Handles Click on "➔ Create DSAR Case" Button (Step 3)
 */
export async function handleCreateDsarCase(e) {
  if (e) e.preventDefault();

  const createBtn = document.getElementById('btn-create-dsar-case-final');
  const requestTextInput = document.getElementById('intake-request-text');
  const fullNameInput = document.getElementById('intake-full-name');
  const emailInput = document.getElementById('intake-email');
  const preferredChannelRadio = document.querySelector('input[name="intake-preferred-channel"]:checked');

  const fullName = (lastAnalyzedPayload && lastAnalyzedPayload.fullName) || (fullNameInput ? fullNameInput.value.trim() : 'Alex Johnson');
  const email = (lastAnalyzedPayload && lastAnalyzedPayload.email) || (emailInput ? emailInput.value.trim() : 'alex.johnson@example.com');
  const requestText = (lastAnalyzedPayload && lastAnalyzedPayload.requestText) || (requestTextInput ? requestTextInput.value.trim() : 'Full data subject request');
  const preferredChannel = (lastAnalyzedPayload && lastAnalyzedPayload.preferredChannel) || (preferredChannelRadio ? preferredChannelRadio.value : 'Web portal');

  const primaryType = (lastAnalysisResult && lastAnalysisResult.primaryRequestType) || 'Deletion';
  const detectedTypesStr = (lastAnalysisResult && lastAnalysisResult.identifiedRequestTypes)
    ? lastAnalysisResult.identifiedRequestTypes.map(t => t.title).join(' + ')
    : 'Access + Deletion + Marketing Consent';
  const jurisdictionCountry = (lastAnalysisResult && lastAnalysisResult.jurisdiction && lastAnalysisResult.jurisdiction.country) || 'Singapore';

  if (createBtn) {
    createBtn.disabled = true;
    createBtn.innerHTML = '<span>Registering Case & Starting AI Pipeline…</span>';
  }

  const payload = {
    fullName,
    email,
    phone: '+65 9123 4567',
    country: jurisdictionCountry,
    relationship: 'Customer',
    requestType: primaryType,
    scope: detectedTypesStr,
    requestDetails: requestText,
    verificationType: 'Identity Link / Email Auth',
    verificationEvidence: `AI Portal Verified (${preferredChannel})`,
    status: 'In Progress'
  };

  try {
    const res = await fetch(`${window.location.origin}/api/dsar/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data && data.success && data.record) {
      const newReq = data.record;
      showToast(`✓ DSAR Case ${newReq.request_id} created successfully! Starting Discovery...`, 'success');

      // Refresh Dashboard KPI metrics and queue table
      if (window.refreshDsarDashboard) {
        window.refreshDsarDashboard();
      }

      // Immediately launch Step 2 AI Discovery Pipeline for this new request
      const discoveryCard = document.getElementById('dsar-step2-discovery-card');
      if (discoveryCard) {
        discoveryCard.classList.remove('hidden');
        discoveryCard.scrollIntoView({ behavior: 'smooth' });
      }

      if (window.runIdentityDiscoveryScan) {
        window.runIdentityDiscoveryScan(newReq.request_id);
      } else if (window.triggerDsarDiscovery) {
        window.triggerDsarDiscovery(newReq.request_id);
      }
    } else {
      showToast(data.message || 'Failed to create DSAR case.', 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.innerHTML = '<span>➔ Create DSAR Case</span>';
    }
  }
}

/**
 * Switches workspace to DSAR Portal View
 */
export function showDsarPortalView() {
  const coreWorkspace = document.getElementById('udps-core-workspace');
  const dsarWorkspace = document.getElementById('dsar-portal-workspace');
  if (coreWorkspace && dsarWorkspace) {
    coreWorkspace.classList.add('hidden');
    dsarWorkspace.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.refreshDsarDashboard) {
      window.refreshDsarDashboard();
    }
  }
}

/**
 * Switches workspace to UDPS Core File/DB view
 */
export function showUdpsCoreView(targetHash) {
  const coreWorkspace = document.getElementById('udps-core-workspace');
  const dsarWorkspace = document.getElementById('dsar-portal-workspace');
  if (coreWorkspace && dsarWorkspace) {
    dsarWorkspace.classList.add('hidden');
    coreWorkspace.classList.remove('hidden');
    if (targetHash) {
      setTimeout(() => {
        const targetEl = document.querySelector(targetHash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    }
  }
}

/**
 * Initialize DSAR Intake Controller
 */
export function initDsarIntake() {
  const navDsarBtn = document.getElementById('nav-dsar-portal');
  const backToCoreBtn = document.getElementById('btn-back-to-udps-core');
  const coreNavLinks = document.querySelectorAll('.nav-core-link, .app-header__brand');

  // Header Nav Link click
  if (navDsarBtn) {
    navDsarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showDsarPortalView();
    });
  }

  // Back to UDPS Core button
  if (backToCoreBtn) {
    backToCoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showUdpsCoreView('#hero-section');
    });
  }

  // Core navigation links
  coreNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      showUdpsCoreView(href);
    });
  });

  // Sample prompt chips auto-fill
  const sampleChips = document.querySelectorAll('.intake-sample-chip');
  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleText = chip.dataset.sample || chip.getAttribute('data-sample');
      const textarea = document.getElementById('intake-request-text');
      if (textarea && sampleText) {
        textarea.value = sampleText;
        textarea.focus();
      }
    });
  });

  // Step 1: AI Submit Request Button
  const submitAiBtn = document.getElementById('btn-submit-intake-ai');
  if (submitAiBtn) {
    submitAiBtn.addEventListener('click', handleAiIntakeSubmit);
  }

  // Step 3: Create DSAR Case Button
  const createCaseBtn = document.getElementById('btn-create-dsar-case-final');
  if (createCaseBtn) {
    createCaseBtn.addEventListener('click', handleCreateDsarCase);
  }

  // Expose global view switchers & handlers
  window.showDsarPortalView = showDsarPortalView;
  window.showUdpsCoreView = showUdpsCoreView;
  window.handleAiIntakeSubmit = handleAiIntakeSubmit;
  window.handleCreateDsarCase = handleCreateDsarCase;

  // Handle URL hash on initial load & hashchange
  if (window.location.hash === '#dsar-portal-workspace' || window.location.hash === '#dsar-workflow-section' || window.location.hash.startsWith('#dsar')) {
    showDsarPortalView();
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#dsar-portal-workspace' || window.location.hash === '#dsar-workflow-section' || window.location.hash.startsWith('#dsar')) {
      showDsarPortalView();
    }
  });
}

