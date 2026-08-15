'use strict';

/**
 * Workflow Step Progress Module
 * Dynamically updates the 4-step progress indicator based on real application state.
 */

export function updateWorkflowProgress(stepState) {
  const stepsContainer = document.querySelector('.workflow-steps');
  if (!stepsContainer) return;

  const steps = stepsContainer.querySelectorAll('.step-item');
  if (steps.length < 4) return;

  // Step 1: Upload, Step 2: Scan, Step 3: Protect, Step 4: Result
  const states = {
    // Initial: Upload active
    initial:   [ { status: 'active', num: '1' }, { status: 'pending', num: '2' }, { status: 'pending', num: '3' }, { status: 'pending', num: '4' } ],
    // File selected: Upload done, Scan active
    file_ready:[ { status: 'done',   num: '✓' }, { status: 'active',  num: '2' }, { status: 'pending', num: '3' }, { status: 'pending', num: '4' } ],
    // Scan done: Upload done, Scan done, Protect active
    scanned:   [ { status: 'done',   num: '✓' }, { status: 'done',    num: '✓' }, { status: 'active',  num: '3' }, { status: 'pending', num: '4' } ],
    // Process done: All done!
    protected: [ { status: 'done',   num: '✓' }, { status: 'done',    num: '✓' }, { status: 'done',    num: '✓' }, { status: 'done',    num: '✓' } ],
  };

  const config = states[stepState] || states.initial;

  steps.forEach((step, idx) => {
    const cfg = config[idx];
    const numEl = step.querySelector('.step-num');

    step.classList.remove('active', 'done', 'pending');
    step.classList.add(cfg.status);

    if (numEl) {
      numEl.textContent = cfg.num;
    }
  });
}
