'use strict';

/**
 * Dashboard Stats Module
 * Fetches live metrics from existing APIs (/api/history, /api/database/protected-data, /api/db-health)
 * and populates the Security Overview Dashboard.
 */

export async function updateDashboardStats() {
  const statFiles = document.getElementById('stat-files-processed');
  const statRecords = document.getElementById('stat-protected-records');
  const statOps = document.getElementById('stat-recent-ops');
  const statDbStatus = document.getElementById('stat-db-status');
  const navDbStatus = document.getElementById('nav-db-status');

  // 1. Fetch DB Health
  try {
    const healthResp = await fetch(`${window.location.origin}/api/db-health`);
    const healthData = await healthResp.json();
    const isOnline = healthData.success === true;

    if (statDbStatus) {
      statDbStatus.innerHTML = isOnline
        ? `<span class="status-indicator online"></span><span style="color:var(--green); font-weight:600;">PostgreSQL Connected</span>`
        : `<span class="status-indicator offline"></span><span style="color:var(--text-muted);">Offline Mode</span>`;
    }

    if (navDbStatus) {
      navDbStatus.innerHTML = isOnline
        ? `<span class="status-indicator online"></span><span>DB Connected</span>`
        : `<span class="status-indicator offline"></span><span>DB Offline</span>`;
      navDbStatus.className = isOnline ? 'db-status-pill online' : 'db-status-pill offline';
    }
  } catch (err) {
    if (statDbStatus) statDbStatus.innerHTML = `<span class="status-indicator offline"></span><span style="color:var(--text-muted);">Offline</span>`;
  }

  // 2. Fetch History Stats
  try {
    const historyResp = await fetch(`${window.location.origin}/api/history?limit=50`);
    const historyData = await historyResp.json();

    if (historyData.success && Array.isArray(historyData.records)) {
      const records = historyData.records;
      const fileOpsCount = records.length;
      let totalItems = 0;
      records.forEach(r => { totalItems += (r.processedCount || 0); });

      if (statFiles) statFiles.textContent = fileOpsCount > 0 ? fileOpsCount.toLocaleString() : '0';
      if (statOps) statOps.textContent = fileOpsCount > 0 ? fileOpsCount.toLocaleString() : '0';
    } else {
      if (statFiles) statFiles.textContent = '0';
      if (statOps) statOps.textContent = '0';
    }
  } catch (err) {
    if (statFiles) statFiles.textContent = '—';
    if (statOps) statOps.textContent = '—';
  }

  // 3. Fetch Saved Database Records Count
  try {
    const savedResp = await fetch(`${window.location.origin}/api/database/protected-data?limit=100`);
    const savedData = await savedResp.json();

    if (savedData.success && Array.isArray(savedData.records)) {
      const savedCount = savedData.records.length;
      if (statRecords) statRecords.textContent = savedCount > 0 ? savedCount.toLocaleString() : '0';
    } else {
      if (statRecords) statRecords.textContent = '0';
    }
  } catch (err) {
    if (statRecords) statRecords.textContent = '—';
  }
}

export function initDashboardStats() {
  updateDashboardStats();
  // Refresh stats periodically
  setInterval(updateDashboardStats, 30000);
}
