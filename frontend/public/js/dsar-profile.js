'use strict';

/**
 * DSAR Operator Profile Controller
 * Manages:
 * - Top-right Operator Profile Badge (avatar, initials, name, department)
 * - Interactive Profile Dropdown Menu (user card, edit profile, preferences jump, quick switch)
 * - Operator Profile Edit Modal (Full Name, Corporate Email, Department, Job Title, Avatar Accent Color)
 * - Live dynamic synchronization with My Tasks view and persistence across session
 */

const DEFAULT_PROFILE = {
  name: 'John Doe',
  email: 'john.doe@segmento.com',
  role: 'Privacy Team',
  title: 'Senior Privacy Operations Specialist',
  initials: 'JD',
  color: '#06b6d4',
  status: 'Active'
};

const OPERATOR_PRESETS = [
  { name: 'John Doe', email: 'john.doe@segmento.com', role: 'Privacy Team', title: 'Privacy Lead', initials: 'JD', color: '#06b6d4' },
  { name: 'Sarah Lee', email: 'sarah.lee@segmento.com', role: 'Data Engineering', title: 'Data Engineer', initials: 'SL', color: '#8b5cf6' },
  { name: 'Michael Tan', email: 'michael.tan@segmento.com', role: 'CRM Team', title: 'CRM Lead', initials: 'MT', color: '#10b981' },
  { name: 'Alex Chen', email: 'alex.chen@segmento.com', role: 'Security', title: 'Security Ops', initials: 'AC', color: '#f59e0b' },
  { name: 'Anil Reddy', email: 'anil.reddy@segmento.com', role: 'Privacy / DPO', title: 'Chief DPO', initials: 'AR', color: '#ef4444' }
];

let currentProfile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
let selectedColor = '#06b6d4';

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
 * Compute 1-2 letter uppercase initials from name
 */
export function computeInitials(name) {
  if (!name || typeof name !== 'string') return 'OP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get active operator profile
 */
export function getCurrentOperatorProfile() {
  return currentProfile;
}

/**
 * Load operator profile from backend & localStorage
 */
export async function loadOperatorProfile() {
  // 1. Check localStorage first for instant hydration
  try {
    const cached = localStorage.getItem('dsar_operator_profile');
    if (cached) {
      currentProfile = { ...DEFAULT_PROFILE, ...JSON.parse(cached) };
      renderProfileUI(currentProfile);
    }
  } catch (e) {
    console.warn('Could not read cached profile:', e);
  }

  // 2. Fetch from backend API
  try {
    const res = await fetch(`${window.location.origin}/api/dsar/profile`);
    const data = await res.json();
    if (data && data.success && data.profile) {
      currentProfile = { ...DEFAULT_PROFILE, ...data.profile };
      localStorage.setItem('dsar_operator_profile', JSON.stringify(currentProfile));
      renderProfileUI(currentProfile);
    }
  } catch (err) {
    console.warn('Could not fetch operator profile from server:', err);
  }
}

/**
 * Render operator profile across all UI surfaces
 */
export function renderProfileUI(profile) {
  if (!profile) return;

  const initials = profile.initials || computeInitials(profile.name);
  const color = profile.color || '#06b6d4';

  // 1. Header Badge
  const badgeAvatar = document.getElementById('operator-badge-avatar');
  const badgeName = document.getElementById('operator-badge-name');
  const badgeRole = document.getElementById('operator-badge-role');

  if (badgeAvatar) {
    badgeAvatar.textContent = initials;
    badgeAvatar.style.background = `${color}22`;
    badgeAvatar.style.color = color;
    badgeAvatar.style.borderColor = `${color}55`;
  }
  if (badgeName) badgeName.textContent = profile.name;
  if (badgeRole) badgeRole.textContent = profile.role;

  // 2. Dropdown Header
  const dropAvatar = document.getElementById('dropdown-user-avatar');
  const dropName = document.getElementById('dropdown-user-name');
  const dropEmail = document.getElementById('dropdown-user-email');
  const dropRoleBadge = document.getElementById('dropdown-user-role-badge');

  if (dropAvatar) {
    dropAvatar.textContent = initials;
    dropAvatar.style.background = `${color}25`;
    dropAvatar.style.color = color;
    dropAvatar.style.borderColor = `${color}77`;
  }
  if (dropName) dropName.textContent = profile.name;
  if (dropEmail) dropEmail.textContent = profile.email;
  if (dropRoleBadge) dropRoleBadge.textContent = profile.role;

  // 3. My Tasks Sub-view Header Title
  const myTasksTitle = document.getElementById('mytasks-operator-title');
  if (myTasksTitle) {
    myTasksTitle.textContent = `👤 ${profile.name} — My Assigned Privacy Tasks`;
  }

  // 4. Quick Switch List in Dropdown
  renderQuickSwitchList();
}

/**
 * Render quick switch operator presets
 */
function renderQuickSwitchList() {
  const container = document.getElementById('operator-quick-switch-list');
  if (!container) return;

  container.innerHTML = OPERATOR_PRESETS.map(preset => {
    const isCurrent = preset.name.toLowerCase() === (currentProfile.name || '').toLowerCase();
    const activeStyle = isCurrent
      ? 'background:rgba(6,182,212,0.2); border-color:var(--cyan); color:var(--cyan); font-weight:700;'
      : 'background:var(--bg-input); border-color:var(--border); color:var(--text-muted);';

    return `
      <button type="button" class="btn-quick-switch-operator" data-name="${escapeHtml(preset.name)}" style="display:inline-flex; align-items:center; gap:5px; padding:4px 8px; font-size:0.72rem; border-radius:14px; border:1px solid; cursor:pointer; transition:all 0.15s; ${activeStyle}" title="Switch operator to ${escapeHtml(preset.name)} (${escapeHtml(preset.role)})">
        <span style="width:14px; height:14px; border-radius:50%; background:${preset.color}33; color:${preset.color}; font-size:0.6rem; display:inline-flex; align-items:center; justify-content:center; font-weight:800;">${preset.initials}</span>
        <span>${escapeHtml(preset.name)}</span>
      </button>
    `;
  }).join('');
}

/**
 * Open Operator Profile Edit Modal
 */
export function openProfileEditModal() {
  const modal = document.getElementById('dsar-profile-edit-modal');
  if (!modal) return;

  // Close dropdown if open
  closeOperatorDropdown();

  // Pre-fill fields
  const nameInput = document.getElementById('profile-input-name');
  const emailInput = document.getElementById('profile-input-email');
  const deptSelect = document.getElementById('profile-select-department');
  const titleInput = document.getElementById('profile-input-title');

  if (nameInput) nameInput.value = currentProfile.name || '';
  if (emailInput) emailInput.value = currentProfile.email || '';
  if (deptSelect) deptSelect.value = currentProfile.role || 'Privacy Team';
  if (titleInput) titleInput.value = currentProfile.title || '';

  selectedColor = currentProfile.color || '#06b6d4';
  updateColorPickerUI(selectedColor);
  updateModalLivePreview();

  modal.classList.remove('hidden');
  if (nameInput) nameInput.focus();
}

/**
 * Close Profile Edit Modal
 */
export function closeProfileEditModal() {
  const modal = document.getElementById('dsar-profile-edit-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Update modal live avatar & label preview
 */
function updateModalLivePreview() {
  const name = document.getElementById('profile-input-name')?.value || currentProfile.name || 'John Doe';
  const role = document.getElementById('profile-select-department')?.value || currentProfile.role || 'Privacy Team';
  const title = document.getElementById('profile-input-title')?.value || currentProfile.title || 'Privacy Specialist';
  const initials = computeInitials(name);

  const previewAvatar = document.getElementById('profile-modal-avatar-preview');
  const previewName = document.getElementById('profile-modal-name-preview');
  const previewRole = document.getElementById('profile-modal-role-preview');

  if (previewAvatar) {
    previewAvatar.textContent = initials;
    previewAvatar.style.background = `${selectedColor}25`;
    previewAvatar.style.color = selectedColor;
    previewAvatar.style.borderColor = selectedColor;
  }
  if (previewName) previewName.textContent = name;
  if (previewRole) previewRole.textContent = `${role} • ${title}`;
}

/**
 * Update color picker UI selection
 */
function updateColorPickerUI(color) {
  document.querySelectorAll('.profile-color-btn').forEach(btn => {
    if (btn.dataset.color === color) {
      btn.classList.add('active');
      btn.style.borderColor = '#ffffff';
      btn.style.transform = 'scale(1.15)';
    } else {
      btn.classList.remove('active');
      btn.style.borderColor = 'transparent';
      btn.style.transform = 'scale(1)';
    }
  });
}

/**
 * Save profile changes
 */
export async function saveOperatorProfile(profileData) {
  try {
    const res = await fetch(`${window.location.origin}/api/dsar/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();

    if (data && data.success && data.profile) {
      currentProfile = data.profile;
      localStorage.setItem('dsar_operator_profile', JSON.stringify(currentProfile));
      renderProfileUI(currentProfile);
      closeProfileEditModal();
      showToast(`✓ Operator profile updated to ${currentProfile.name}!`, 'success');

      // Refresh My Tasks board if active
      if (window.renderMyTasks) {
        window.renderMyTasks();
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent('dsar-profile-updated', { detail: currentProfile }));
    } else {
      showToast(data.message || 'Failed to update profile', 'error');
    }
  } catch (err) {
    // Fallback: save locally
    currentProfile = {
      ...currentProfile,
      ...profileData,
      initials: computeInitials(profileData.name || currentProfile.name)
    };
    localStorage.setItem('dsar_operator_profile', JSON.stringify(currentProfile));
    renderProfileUI(currentProfile);
    closeProfileEditModal();
    showToast(`✓ Profile updated locally: ${currentProfile.name}`, 'success');

    if (window.renderMyTasks) {
      window.renderMyTasks();
    }
  }
}

/**
 * Toggle Dropdown Menu
 */
function toggleOperatorDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('dsar-operator-dropdown');
  const btn = document.getElementById('dsar-operator-profile-btn');
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  if (isHidden) {
    dropdown.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    dropdown.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Close Dropdown Menu
 */
function closeOperatorDropdown() {
  const dropdown = document.getElementById('dsar-operator-dropdown');
  const btn = document.getElementById('dsar-operator-profile-btn');
  if (dropdown) dropdown.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

/**
 * Initialize Operator Profile Module
 */
export function initDsarProfile() {
  // 1. Profile Badge Click -> Toggle Dropdown
  const profileBtn = document.getElementById('dsar-operator-profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', toggleOperatorDropdown);
  }

  // 2. Click Outside -> Close Dropdown
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('dsar-operator-dropdown');
    const btn = document.getElementById('dsar-operator-profile-btn');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
        closeOperatorDropdown();
      }
    }
  });

  // 3. Dropdown Item Actions
  const editProfileBtn = document.getElementById('btn-open-profile-edit-modal');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileEditModal();
    });
  }

  const gotoSettingsBtn = document.getElementById('btn-profile-goto-settings');
  if (gotoSettingsBtn) {
    gotoSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOperatorDropdown();
      if (window.switchDsarSubView) {
        window.switchDsarSubView('settings');
      }
    });
  }

  const gotoTeamsBtn = document.getElementById('btn-profile-goto-teams');
  if (gotoTeamsBtn) {
    gotoTeamsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOperatorDropdown();
      if (window.switchDsarSubView) {
        window.switchDsarSubView('team_config');
      }
    });
  }

  // 4. Quick Switch Operator click delegation
  document.addEventListener('click', (e) => {
    const switchBtn = e.target.closest('.btn-quick-switch-operator');
    if (switchBtn) {
      e.stopPropagation();
      const targetName = switchBtn.dataset.name;
      const preset = OPERATOR_PRESETS.find(p => p.name === targetName);
      if (preset) {
        saveOperatorProfile(preset);
      }
    }
  });

  // 5. Modal Live Inputs
  const nameInput = document.getElementById('profile-input-name');
  const deptSelect = document.getElementById('profile-select-department');
  const titleInput = document.getElementById('profile-input-title');

  if (nameInput) nameInput.addEventListener('input', updateModalLivePreview);
  if (deptSelect) deptSelect.addEventListener('change', updateModalLivePreview);
  if (titleInput) titleInput.addEventListener('input', updateModalLivePreview);

  // 6. Modal Color Picker Buttons
  document.querySelectorAll('.profile-color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedColor = btn.dataset.color || '#06b6d4';
      updateColorPickerUI(selectedColor);
      updateModalLivePreview();
    });
  });

  // 7. Modal Close & Cancel
  const closeBtn = document.getElementById('btn-close-profile-modal');
  const cancelBtn = document.getElementById('btn-cancel-profile-edit');
  if (closeBtn) closeBtn.addEventListener('click', closeProfileEditModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeProfileEditModal);

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProfileEditModal();
      closeOperatorDropdown();
    }
  });

  // 8. Form Submit
  const form = document.getElementById('dsar-profile-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-input-name')?.value?.trim();
      const email = document.getElementById('profile-input-email')?.value?.trim();
      const role = document.getElementById('profile-select-department')?.value;
      const title = document.getElementById('profile-input-title')?.value?.trim();

      if (!name) {
        showToast('Full Name is required', 'error');
        return;
      }
      if (!email) {
        showToast('Email Address is required', 'error');
        return;
      }

      await saveOperatorProfile({
        name,
        email,
        role,
        title,
        color: selectedColor
      });
    });
  }

  // Global methods
  window.getCurrentOperatorProfile = getCurrentOperatorProfile;
  window.openProfileEditModal = openProfileEditModal;
  window.loadOperatorProfile = loadOperatorProfile;

  // Initial load
  loadOperatorProfile();
}
