'use strict';

/**
 * Segmento Data Deletion API Platform - Live Interactive Demo Script
 * Run: node demo-apis.js
 */

const BASE_URL = 'http://localhost:3000/api/v1/deletions';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(` 🚀 ${title}`);
  console.log('='.repeat(70));
}

async function runDemo() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════');
  console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   SEGMENTO DATA DELETION PLATFORM — LIVE API DEMONSTRATION');
  console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════');
  console.log(' Target Base URL: \x1b[33mhttp://localhost:3000/api/v1/deletions\x1b[0m\n');

  try {
    // ── 1. Create Deletion Request ─────────────────────────────────────────────
    printHeader('STAGE 1: Create Deletion Request (POST /api/v1/deletions)');
    const createPayload = {
      subject: {
        type: 'EMAIL',
        value: 'alex.smith@example.com',
        name: 'Alex Smith (Customer)',
        phone: '+65 9123 4567',
        customerId: 'CUST-8842'
      },
      reason: 'DATA_SUBJECT_REQUEST',
      scope: 'ALL_ELIGIBLE_DATA',
      jurisdiction: 'SG'
    };
    console.log('📤 Request Body:', JSON.stringify(createPayload, null, 2));

    const createRes = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload)
    });
    const createData = await createRes.json();
    const deletionId = createData.deletionId;
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${createRes.status} Created]:`);
    console.log(`   • Deletion ID: \x1b[1m\x1b[36m${deletionId}\x1b[0m`);
    console.log(`   • Request ID:  ${createData.requestId}`);
    console.log(`   • Status:      \x1b[33m${createData.status}\x1b[0m`);
    console.log(`   • Jurisdiction: ${createData.jurisdiction} (Singapore PDPA)`);

    await sleep(600);

    // ── 2. Get Status ─────────────────────────────────────────────────────────
    printHeader(`STAGE 2: Get Deletion Status (GET /api/v1/deletions/${deletionId})`);
    const getRes = await fetch(`${BASE_URL}/${deletionId}`);
    const getData = await getRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${getRes.status} OK]:`);
    console.log(`   • Subject: ${getData.subject.name} <${getData.subject.value}>`);
    console.log(`   • State:   \x1b[33m${getData.status}\x1b[0m`);

    await sleep(600);

    // ── 3. Discover Data ──────────────────────────────────────────────────────
    printHeader(`STAGE 3: Cross-System Discovery (POST /api/v1/deletions/${deletionId}/discover)`);
    console.log('🔍 Scanning connected systems (PostgreSQL, Salesforce, Snowflake, Marketing, Apps, Support)...');
    const discRes = await fetch(`${BASE_URL}/${deletionId}/discover`, { method: 'POST' });
    const discData = await discRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${discRes.status} OK]:`);
    console.log(`   • Systems Scanned:     \x1b[1m${discData.discovery.systemsScannedCount} Data Stores\x1b[0m`);
    console.log(`   • Records Discovered:  \x1b[1m\x1b[32m${discData.discovery.recordsDiscoveredCount} PII records\x1b[0m`);
    console.log(`   • Status Transition:   \x1b[33m${discData.status}\x1b[0m`);

    await sleep(600);

    // ── 4. Generate Deletion Plan ─────────────────────────────────────────────
    printHeader(`STAGE 4: Generate 6-Action Plan (POST /api/v1/deletions/${deletionId}/plan)`);
    console.log('🧠 Evaluating Legal Hold policies & Statutory Tax Exemptions...');
    const planRes = await fetch(`${BASE_URL}/${deletionId}/plan`, { method: 'POST' });
    const planData = await planRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${planRes.status} OK]: Plan ID ${planData.plan.planId}`);
    console.log('   📊 Action Breakdown:');
    console.log(`      🗑️  DELETE:     ${planData.plan.actionBreakdown.DELETE} records (Marketing leads & session logs)`);
    console.log(`      🏷️  ANONYMIZE:  ${planData.plan.actionBreakdown.ANONYMIZE} records (Snowflake analytics telemetry)`);
    console.log(`      🕶️  MASK:       ${planData.plan.actionBreakdown.MASK} records (CRM contact directory)`);
    console.log(`      🔒  RESTRICT:   ${planData.plan.actionBreakdown.RESTRICT} records (Customer dispute correspondence)`);
    console.log(`      🔄  RETAIN:     ${planData.plan.actionBreakdown.RETAIN} records (7-Year Tax & AML Invoice compliance)`);
    console.log(`      🚫  EXCLUDE:    ${planData.plan.actionBreakdown.EXCLUDE} records (Active litigation hold)`);

    await sleep(600);

    // ── 5. Approve Deletion Plan ──────────────────────────────────────────────
    printHeader(`STAGE 5: Get Approval (POST /api/v1/deletions/${deletionId}/approve)`);
    const appRes = await fetch(`${BASE_URL}/${deletionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedBy: 'Sarah Lee (DPO)',
        approverRole: 'Data Protection Officer & Legal Lead',
        notes: 'Verified compliance with PDPA Section 25 right to erasure and statutory tax retention.'
      })
    });
    const appData = await appRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${appRes.status} OK]:`);
    console.log(`   • Approved By:         ${appData.approval.approvedBy}`);
    console.log(`   • Role:                ${appData.approval.approverRole}`);
    console.log(`   • Digital Signature:   \x1b[1m\x1b[36m${appData.approval.approvalSignature}\x1b[0m`);
    console.log(`   • Status Transition:   \x1b[32m${appData.status}\x1b[0m`);

    await sleep(600);

    // ── 6. Execute Deletion Across Connectors ──────────────────────────────────
    printHeader(`STAGE 6: Execute Deletion (POST /api/v1/deletions/${deletionId}/execute)`);
    console.log('⚡ Orchestrating deletion jobs across connectors via Connector Manager...');
    const execRes = await fetch(`${BASE_URL}/${deletionId}/execute`, { method: 'POST' });
    const execData = await execRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${execRes.status} OK]:`);
    console.log(`   • Connectors Run:   ${execData.execution.connectorsExecuted.length} target connectors`);
    console.log(`   • Hard Deleted:     ${execData.execution.summary.recordsDeleted} records`);
    console.log(`   • Anonymized (SHA): ${execData.execution.summary.recordsAnonymized} records`);
    console.log(`   • Masked:           ${execData.execution.summary.recordsMasked} records`);
    console.log(`   • Tax Retained:     ${execData.execution.summary.recordsRetained} records`);

    await sleep(600);

    // ── 7. Verify Deletion Outcome ────────────────────────────────────────────
    printHeader(`STAGE 7: Verify Deletion (POST /api/v1/deletions/${deletionId}/verify)`);
    console.log('🛡️ Running post-deletion verification checks (confirming 0 residual plaintext PII)...');
    const verRes = await fetch(`${BASE_URL}/${deletionId}/verify`, { method: 'POST' });
    const verData = await verRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${verRes.status} OK]:`);
    console.log(`   • Verification Passed: \x1b[1m\x1b[32m${verData.verification.passed ? 'YES (100%)' : 'NO'}\x1b[0m`);
    console.log(`   • Verification Hash:   \x1b[36m${verData.verification.evidenceHash}\x1b[0m`);

    await sleep(600);

    // ── 8. Immutable Audit Trail & Certificate ─────────────────────────────────
    printHeader(`STAGE 8: Complete & Audit Trail (GET /api/v1/deletions/${deletionId}/audit)`);
    const audRes = await fetch(`${BASE_URL}/${deletionId}/audit`);
    const audData = await audRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${audRes.status} OK]: Request Closed (${audData.status})`);
    console.log(`   • Certificate ID:       \x1b[1m\x1b[32m${audData.auditTrail.certificateId}\x1b[0m`);
    console.log(`   • SHA-256 Signature:    \x1b[33m${audData.auditTrail.cryptographicSignature.hash}\x1b[0m`);
    console.log(`   • Issuer:               ${audData.auditTrail.cryptographicSignature.issuer}`);
    console.log(`   • Audit Timeline Steps: ${audData.auditTrail.timeline.length} verified milestones`);

    await sleep(600);

    // ── 9. Statutory Exceptions Endpoint ──────────────────────────────────────
    printHeader(`STAGE 9: Statutory Exceptions (GET /api/v1/deletions/${deletionId}/exceptions)`);
    const excRes = await fetch(`${BASE_URL}/${deletionId}/exceptions`);
    const excData = await excRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Response [${excRes.status} OK]:`);
    console.log(`   • Exceptions Count: ${excData.exceptionsCount}`);
    excData.exceptions.forEach((e, idx) => {
      console.log(`     ${idx + 1}. [${e.action}] ${e.system} -> ${e.justification}`);
    });

    await sleep(600);

    // ── 10. Webhook Stream History ─────────────────────────────────────────────
    printHeader('STAGE 10: Real-Time Webhook Event Stream (GET /api/v1/deletions/webhooks/events)');
    const evRes = await fetch(`${BASE_URL}/webhooks/events`);
    const evData = await evRes.json();
    console.log('\x1b[32m%s\x1b[0m', `📥 Total Webhook Events Dispatched: ${evData.count}`);
    evData.events.slice(0, 6).forEach((evt, idx) => {
      console.log(`   ${idx + 1}. \x1b[36m${evt.event}\x1b[0m | EventID: ${evt.eventId} | Time: ${evt.timestamp.split('T')[1].replace('Z','')}`);
    });

    console.log('\n\x1b[32m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════');
    console.log('\x1b[1m\x1b[32m%s\x1b[0m', '   🎉 ALL 10 APIS & LIFECYCLE STAGES DEMONSTRATED SUCCESSFULLY!');
    console.log('\x1b[32m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Demo Error:', err.message);
  }
}

runDemo();
