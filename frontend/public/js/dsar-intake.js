'use strict';

/**
 * DSAR Intake Controller (Step 1 of Segmento Protect Pipeline)
 * Manages Step 1 Data Subject Request Intake:
 * - Requester info & jurisdiction capture
 * - Interactive privacy right type selection
 * - Target domain scopes & custom instructions
 * - Identity verification methods
 * - Submission & immediate transition to Step 2 AI Discovery
 */

let selectedRequestType = 'Deletion';
let selectedCountry = 'India';
let selectedRelationship = 'Customer';
let selectedVerificationType = 'Government ID';

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
 * Handles submission of DSAR Intake Request from Step 1
 */
export async function handleIntakeSubmit(e) {
  if (e) e.preventDefault();

  const fullNameInput = document.getElementById('intake-full-name');
  const emailInput = document.getElementById('intake-email');
  const phoneInput = document.getElementById('intake-phone');
  const countryInput = document.getElementById('intake-country');
  const relInput = document.getElementById('intake-relationship');
  const detailsInput = document.getElementById('intake-details-text');
  const idRefInput = document.getElementById('intake-id-ref');
  const consentCheckbox = document.getElementById('intake-consent-checkbox');
  const submitBtn = document.getElementById('btn-submit-final-intake');

  const fullName = fullNameInput ? fullNameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const country = countryInput ? countryInput.value : selectedCountry;
  const relationship = relInput ? relInput.value : selectedRelationship;
  const requestDetails = detailsInput ? detailsInput.value.trim() : '';
  const idRef = idRefInput ? idRefInput.value.trim() : '';

  if (!fullName) {
    showToast('Please enter data subject full name.', 'error');
    if (fullNameInput) fullNameInput.focus();
    return;
  }

  if (!email || !email.includes('@')) {
    showToast('Please enter a valid requester email address.', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  if (consentCheckbox && !consentCheckbox.checked) {
    showToast('Please check the statutory declaration checkbox to proceed.', 'warning');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Registering Request & Starting AI Pipeline…</span>';
  }

  // Read checked domain scopes
  const scopes = [];
  document.querySelectorAll('.intake-scope-checkbox:checked').forEach(cb => scopes.push(cb.value));

  const payload = {
    fullName,
    email,
    phone,
    country,
    relationship,
    requestType: selectedRequestType,
    scope: scopes.length > 0 ? scopes.join(', ') : 'All Associated Personal Data',
    requestDetails: requestDetails || `${selectedRequestType} request for ${fullName}`,
    verificationType: selectedVerificationType,
    verificationEvidence: idRef ? `${selectedVerificationType} (#${idRef})` : `${selectedVerificationType} Verified`,
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
      showToast(`✓ DSAR Request ${newReq.request_id} registered successfully!`, 'success');

      // Refresh Dashboard KPI metrics and queue table
      if (window.refreshDsarDashboard) {
        window.refreshDsarDashboard();
      }

      // Immediately launch Step 2 AI Discovery Pipeline for this new request
      if (window.runIdentityDiscoveryScan) {
        window.runIdentityDiscoveryScan(newReq.request_id);
      } else if (window.triggerDsarDiscovery) {
        window.triggerDsarDiscovery(newReq.request_id);
      }
    } else {
      showToast(data.message || 'Failed to submit DSAR request.', 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        <span>Submit & Start AI Discovery Pipeline ➔</span>
      `;
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

  // Request Type Selection Cards
  const typeCards = document.querySelectorAll('.intake-type-option-card');
  typeCards.forEach(card => {
    card.addEventListener('click', () => {
      typeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedRequestType = card.dataset.type || 'Deletion';
    });
  });

  // Verification Type Tabs
  const verifTabs = document.querySelectorAll('.intake-verif-tab');
  verifTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      verifTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedVerificationType = tab.dataset.method || 'Government ID';
    });
  });

  // Country & Relationship change
  const countrySelect = document.getElementById('intake-country');
  if (countrySelect) {
    countrySelect.addEventListener('change', (e) => {
      selectedCountry = e.target.value;
    });
  }

  const relSelect = document.getElementById('intake-relationship');
  if (relSelect) {
    relSelect.addEventListener('change', (e) => {
      selectedRelationship = e.target.value;
    });
  }

  // Final Submit
  const submitBtn = document.getElementById('btn-submit-final-intake');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleIntakeSubmit);
  }

  // Expose global view switchers
  window.showDsarPortalView = showDsarPortalView;
  window.showUdpsCoreView = showUdpsCoreView;

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
