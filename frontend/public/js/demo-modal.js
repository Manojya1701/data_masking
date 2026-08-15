'use strict';

/**
 * Demo Video Modal Module
 * Handles opening, closing, playing, pausing, keyboard accessibility,
 * loading indicator, and error states for the UDPS Product Demo video.
 */

let lastActiveElement = null;

export function initDemoModal() {
  const watchDemoBtn     = document.getElementById('btn-watch-demo');
  const navWatchDemoBtn  = document.getElementById('nav-btn-watch-demo');
  const modal            = document.getElementById('demo-video-modal');
  const backdrop         = document.getElementById('demo-modal-backdrop');
  const closeBtn         = document.getElementById('demo-modal-close-btn');
  const videoPlayer      = document.getElementById('udps-demo-player');
  const videoLoading     = document.getElementById('demo-video-loading');
  const videoError       = document.getElementById('demo-video-error');

  if (!modal || !videoPlayer) return;

  function openModal(triggerElement) {
    lastActiveElement = triggerElement || document.activeElement;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Reset error state
    if (videoError) videoError.classList.add('hidden');

    // Manage focus into close button
    if (closeBtn) closeBtn.focus();

    // Check if video metadata is already loaded
    if (videoPlayer.readyState >= 1) {
      if (videoLoading) videoLoading.classList.add('hidden');
    }
  }

  function closeModal() {
    // CRITICAL: Immediately pause audio and video playback
    if (videoPlayer) {
      videoPlayer.pause();
    }

    modal.classList.add('hidden');
    document.body.style.overflow = '';

    // Restore focus to triggering button
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }

  // Event Listeners for Open Triggers
  if (watchDemoBtn) {
    watchDemoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(watchDemoBtn);
    });
  }

  if (navWatchDemoBtn) {
    navWatchDemoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(navWatchDemoBtn);
    });
  }

  // Event Listeners for Close Triggers
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeModal);
  }

  // Keyboard accessibility: Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Video Event Handlers
  videoPlayer.addEventListener('loadedmetadata', () => {
    if (videoLoading) videoLoading.classList.add('hidden');
  });

  videoPlayer.addEventListener('canplay', () => {
    if (videoLoading) videoLoading.classList.add('hidden');
  });

  videoPlayer.addEventListener('error', () => {
    if (videoLoading) videoLoading.classList.add('hidden');
    if (videoError) videoError.classList.remove('hidden');
  });
}
