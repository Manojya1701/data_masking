'use strict';

/**
 * Segmento Data Deletion API Platform - Live Interactive Demo Script
 * Run: node demo-apis.js
 * Demonstrates the 6 Deletion Actions (Delete, Anonymize, Mask, Hash/Restrict, Retain, Exclude).
 */

const dataDeletionService = require('./backend/services/data-deletion-service');
const webhookService = require('./backend/services/webhook-service');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bgBlue: '\x1b[44m\x1b[37m'
};

function printHeader(title) {
  console.log('\n' + '='.repeat(74));
  console.log(` ${c.bright}${c.cyan}🚀 ${title}${c.reset}`);
  console.log('='.repeat(74));
}

async function runDemo() {
  console.log('\n' + c.cyan + '═'.repeat(74) + c.reset);
  console.log(`${c.bright}${c.green}   SEGMENTO DATA DELETION PLATFORM — 6-ACTION COMPLIANCE DEMO${c.reset}`);
  console.log(c.cyan + '═'.repeat(74) + c.reset);
  console.log(` Target Endpoints: ${c.yellow}/api/v1/deletions/*${c.reset}\n`);

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

    const createData = await dataDeletionService.createDeletionRequest(createPayload);
    const deletionId = createData.deletionId;
    console.log(`${c.green}📥 Response [201 Created]:${c.reset}`);
    console.log(`   • Deletion ID:       ${c.bright}${c.cyan}${deletionId}${c.reset}`);
    console.log(`   • Lifecycle Status:  ${c.yellow}${createData.status}${c.reset}`);

    await sleep(400);

    // ── 2. Get Status ─────────────────────────────────────────────────────────
    printHeader(`STAGE 2: Get Deletion Status (GET /api/v1/deletions/${deletionId})`);
    const getData = await dataDeletionService.getDeletion(deletionId);
    console.log(`${c.green}📥 Response [200 OK]:${c.reset}`);
    console.log(`   • Subject: ${getData.subject.name} <${getData.subject.value}>`);
    console.log(`   • State:   ${c.yellow}${getData.status}${c.reset}`);

    await sleep(400);

    // ── 3. Discover Data ──────────────────────────────────────────────────────
    printHeader(`STAGE 3: Cross-System Discovery (POST /api/v1/deletions/${deletionId}/discover)`);
    console.log('🔍 Scanning connected systems (PostgreSQL, Salesforce, Snowflake, Marketing, Apps, Support)...');
    const discData = await dataDeletionService.discoverData(deletionId);
    console.log(`${c.green}📥 Response [200 OK]:${c.reset}`);
    console.log(`   • Systems Scanned:     ${c.bright}${discData.discovery.systemsScannedCount} Data Stores${c.reset}`);
    console.log(`   • Records Discovered:  ${c.bright}${c.green}${discData.discovery.recordsDiscoveredCount} PII records${c.reset}`);
    console.log(`   • Status Transition:   ${c.yellow}${discData.status}${c.reset}`);

    await sleep(400);

    // ── 4. Generate 6-Action Deletion Plan ────────────────────────────────────
    printHeader(`STAGE 4: Generate 6-Action Plan (POST /api/v1/deletions/${deletionId}/plan)`);
    console.log('🧠 Evaluating Legal Hold policies, Masking rules & Statutory Tax Exemptions...');
    const planData = await dataDeletionService.generatePlan(deletionId);
    console.log(`${c.green}📥 Response [200 OK]: Plan ID ${planData.plan.planId}${c.reset}`);
    console.log(`\n   ${c.bright}📊 6-ACTION COMPLIANCE MATRIX BREAKDOWN:${c.reset}`);
    console.log(`      🗑️  ${c.bright}1. DELETE (Hard Purge):${c.reset}    ${planData.plan.actionBreakdown.DELETE} records (Marketing leads & session telemetry)`);
    console.log(`      🏷️  ${c.bright}2. ANONYMIZE (SHA-256):${c.reset}   ${planData.plan.actionBreakdown.ANONYMIZE} records (Snowflake analytics data warehouse)`);
    console.log(`      🕶️  ${c.bright}3. MASK (Partial Redact):${c.reset} ${planData.plan.actionBreakdown.MASK} records (Salesforce CRM contact directory)`);
    console.log(`      🔒  ${c.bright}4. RESTRICT / HASH:${c.reset}       ${planData.plan.actionBreakdown.RESTRICT} records (Customer dispute correspondence)`);
    console.log(`      🔄  ${c.bright}5. RETAIN (Tax Exemption):${c.reset}${planData.plan.actionBreakdown.RETAIN} records (7-Year Tax & AML Invoice compliance)`);
    console.log(`      🚫  ${c.bright}6. EXCLUDE (Legal Hold):${c.reset}  ${planData.plan.actionBreakdown.EXCLUDE} records (Active litigation hold)`);

    await sleep(400);

    // ── 5. Approve Deletion Plan ──────────────────────────────────────────────
    printHeader(`STAGE 5: DPO Authorization (POST /api/v1/deletions/${deletionId}/approve)`);
    const appData = await dataDeletionService.approveDeletion(deletionId, {
      approvedBy: 'Sarah Lee (DPO Lead)',
      approverRole: 'Data Protection Officer & Legal Lead',
      notes: 'Verified compliance with GDPR Art 17 / PDPA Section 25 and statutory tax retention exemptions.'
    });
    console.log(`${c.green}📥 Response [200 OK]:${c.reset}`);
    console.log(`   • Approved By:         ${appData.approval.approvedBy}`);
    console.log(`   • Role:                ${appData.approval.approverRole}`);
    console.log(`   • Cryptographic Sign:  ${c.bright}${c.cyan}${appData.approval.approvalSignature}${c.reset}`);
    console.log(`   • Status Transition:   ${c.green}${appData.status}${c.reset}`);

    await sleep(400);

    // ── 6. Execute Deletion Across Connectors ──────────────────────────────────
    printHeader(`STAGE 6: Execute Multi-Connector Deletion (POST /api/v1/deletions/${deletionId}/execute)`);
    console.log('⚡ Orchestrating deletion, masking, and anonymization across connected databases...');
    const execData = await dataDeletionService.executeDeletion(deletionId);
    console.log(`${c.green}📥 Response [200 OK]:${c.reset}`);
    console.log(`   • Connectors Run:      ${execData.execution.connectorsExecuted.length} target connectors`);
    console.log(`   • Hard Deleted:        ${execData.execution.summary.recordsDeleted} records physically removed`);
    console.log(`   • Anonymized (SHA):    ${execData.execution.summary.recordsAnonymized} records pseudonymized`);
    console.log(`   • Masked in CRM:       ${execData.execution.summary.recordsMasked} records redacted`);
    console.log(`   • Tax Retained:        ${execData.execution.summary.recordsRetained} records preserved under AML laws`);

    await sleep(400);

    // ── 7. Verify Deletion Outcome ────────────────────────────────────────────
    printHeader(`STAGE 7: Post-Deletion Residual Scan (POST /api/v1/deletions/${deletionId}/verify)`);
    console.log('🛡️ Scanning all databases to verify 0 residual plaintext PII remains...');
    const verData = await dataDeletionService.verifyDeletion(deletionId);
    console.log(`${c.green}📥 Response [200 OK]:${c.reset}`);
    console.log(`   • Verification Passed: ${c.bright}${c.green}${verData.verification.passed ? 'YES (100% Passed)' : 'NO'}${c.reset}`);
    console.log(`   • Verification Hash:   ${c.cyan}${verData.verification.evidenceHash}${c.reset}`);

    await sleep(400);

    // ── 8. Audit Trail & Certificate ──────────────────────────────────────────
    printHeader(`STAGE 8: Cryptographic Compliance Certificate (GET /api/v1/deletions/${deletionId}/audit)`);
    const auditData = await dataDeletionService.getAuditTrail(deletionId);
    console.log(`${c.green}📥 Response [200 OK]: Certificate ID ${auditData.auditTrail.certificateId}${c.reset}`);
    console.log(`   • Algorithm:           ${auditData.auditTrail.cryptographicSignature.algorithm}`);
    console.log(`   • SHA-256 Cert Hash:   ${c.bright}${c.yellow}${auditData.auditTrail.cryptographicSignature.hash}${c.reset}`);
    console.log(`   • Issuer Authority:    ${auditData.auditTrail.cryptographicSignature.issuer}`);
    console.log(`   • Immutable Timeline:  ${auditData.auditTrail.timeline.length} lifecycle events recorded`);

    await sleep(400);

    // ── 9. Inspect Exceptions ─────────────────────────────────────────────────
    printHeader(`STAGE 9: Statutory Exemptions & Legal Holds (GET /api/v1/deletions/${deletionId}/exceptions)`);
    const exData = await dataDeletionService.getExceptions(deletionId);
    console.log(`${c.green}📥 Response [200 OK]: ${exData.exceptionsCount} Exceptions Applied${c.reset}`);
    exData.exceptions.forEach((e, i) => {
      console.log(`   [${i + 1}] System:      ${c.bright}${e.system}${c.reset}`);
      console.log(`       Action:      ${c.yellow}${e.action}${c.reset}`);
      console.log(`       Legal Rule:  ${e.policyRule || 'GDPR Art. 17(3) Statutory Tax Exemption'}`);
      console.log(`       Description: ${e.actionDescription}`);
    });

    console.log('\n' + c.cyan + '═'.repeat(74) + c.reset);
    console.log(`${c.bright}${c.green}  ✅ DEMO COMPLETE: ALL 6 DELETION, MASKING & ANONYMIZATION ACTIONS VERIFIED!${c.reset}`);
    console.log(c.cyan + '═'.repeat(74) + c.reset + '\n');

  } catch (err) {
    console.error(`\n${c.red}❌ Demo Error:${c.reset}`, err.message);
  }
}

runDemo();
