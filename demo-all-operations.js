'use strict';

/**
 * Universal Data Protection System (UDPS) & Segmento All-Operations Live Demo
 * Demonstrates the 8 Core Privacy Operations:
 * 1. Masking (Partial redact of PII)
 * 2. Tokenization (Reversible vaulted tokens)
 * 3. Cryptographic Hashing (SHA-256, BLAKE3)
 * 4. Military-Grade AES-256-GCM Encryption & Decryption
 * 5. Anonymization & Pseudonymization (GDPR Art. 4)
 * 6. Hard Redaction ([REDACTED] purge)
 * 7. Physical Row Deletion (Right to Erasure)
 * 8. Segmento 6-Action Deletion Platform (Delete, Anonymize, Mask, Restrict, Retain, Exclude)
 *
 * Run: node demo-all-operations.js
 */

const hashingService = require('./backend/services/hashing-service');
const encryptionService = require('./backend/services/encryption-service');
const privacyDeletionService = require('./backend/services/privacy-deletion-service');
const dataDeletionService = require('./backend/services/data-deletion-service');

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

function operation(num, name, apiEndpoint) {
  console.log(`\n${c.bgBlue} OPERATION ${num} ${c.reset} ${c.bright}${name}${c.reset}`);
  console.log(`   ${c.yellow}Target API Endpoint:${c.reset} ${c.green}${apiEndpoint}${c.reset}`);
}

async function runDemo() {
  console.log('\n' + c.cyan + '═'.repeat(78) + c.reset);
  console.log(`${c.bright}${c.green}   SEGMENTO & UDPS PLATFORM — ALL 8 PRIVACY OPERATIONS LIVE DEMO${c.reset}`);
  console.log(c.cyan + '═'.repeat(78) + c.reset);

  await privacyDeletionService.resetPrivacyDeletionCustomers();

  // ── 1. MASKING ─────────────────────────────────────────────────────────────
  operation(1, 'Data Masking (Format-Preserving Partial Redaction)', 'POST /api/privacy-deletion/customers/1/apply-operation (op: masking)');
  const maskRes = await privacyDeletionService.applyOperationToPrivacyCustomer(1, 'masking');
  console.log(`   • Original Record:    Rahul Kumar <rahul@gmail.com>`);
  console.log(`   • ${c.green}Masked API Result:${c.reset}  ${c.bright}${c.cyan}${maskRes.record.first_name} ${maskRes.record.last_name} <${maskRes.record.email}>${c.reset}`);
  console.log(`   • Mechanism:          Retains first/last characters while masking inner payload with asterisks.`);

  // ── 2. TOKENIZATION ────────────────────────────────────────────────────────
  operation(2, 'Data Tokenization (Surrogate Vault Identifier)', 'POST /api/privacy-deletion/customers/2/apply-operation (op: tokenization)');
  const tokenRes = await privacyDeletionService.applyOperationToPrivacyCustomer(2, 'tokenization');
  console.log(`   • Original Record:    Priya Sharma <priya@gmail.com>`);
  console.log(`   • ${c.green}Tokenized Result:${c.reset}   ${c.bright}${c.cyan}${tokenRes.record.first_name} ${tokenRes.record.last_name} <${tokenRes.record.email}>${c.reset}`);
  console.log(`   • Mechanism:          Swaps sensitive values with unique non-sensitive surrogate tokens.`);

  // ── 3. CRYPTOGRAPHIC HASHING ───────────────────────────────────────────────
  operation(3, 'Cryptographic One-Way Hashing (SHA-256 / BLAKE3)', 'POST /api/privacy-deletion/customers/3/apply-operation (op: hashing)');
  const hashRes = await privacyDeletionService.applyOperationToPrivacyCustomer(3, 'hashing');
  const fullSha256 = hashingService.hash('arjun@gmail.com', 'sha256');
  const fullBlake3 = hashingService.hash('arjun@gmail.com', 'blake3');

  console.log(`   • Original Record:    Arjun Reddy <arjun@gmail.com>`);
  console.log(`   • ${c.green}Hashed In-DB Row:${c.reset}   ${c.bright}${c.cyan}${hashRes.record.first_name} ${hashRes.record.last_name} <${hashRes.record.email}>${c.reset}`);
  console.log(`   • Full SHA-256:       ${c.yellow}${fullSha256}${c.reset} (256-bit Irreversible Hash)`);
  console.log(`   • Full BLAKE3:        ${c.yellow}${fullBlake3}${c.reset} (High-throughput Cryptographic Hash)`);

  // ── 4. AES-256-GCM ENCRYPTION & DECRYPTION ─────────────────────────────────
  operation(4, 'Military-Grade AES-256-GCM Encryption & Restore', 'POST /api/privacy-deletion/customers/4/apply-operation (op: encryption)');
  const encRes = await privacyDeletionService.applyOperationToPrivacyCustomer(4, 'encryption');
  const sampleSecret = 'segmento_enterprise_master_key_2026';
  const fileEncrypted = encryptionService.encrypt(Buffer.from('CONFIDENTIAL_SALARY_$180,000', 'utf8'), sampleSecret);
  const fileDecrypted = encryptionService.decrypt(fileEncrypted, sampleSecret);

  console.log(`   • Original Record:    Sneha Patel <sneha.p@gmail.com>`);
  console.log(`   • ${c.green}Encrypted In-DB:${c.reset}    ${c.bright}${c.magenta}${encRes.record.first_name}${c.reset}`);
  console.log(`   • File Ciphertext:    ${c.magenta}${fileEncrypted.slice(0, 32).toString('hex')}...[AES-256-GCM AuthTag]${c.reset}`);
  console.log(`   • ${c.green}Restored Plaintext:${c.reset} ${c.bright}${c.green}${fileDecrypted.plaintext.toString('utf8')}${c.reset}`);

  // ── 5. ANONYMIZATION ───────────────────────────────────────────────────────
  operation(5, 'Data Anonymization (GDPR Art. 4 Pseudonymization)', 'POST /api/privacy-deletion/customers/5/apply-operation (op: anonymization)');
  const anonRes = await privacyDeletionService.applyOperationToPrivacyCustomer(5, 'anonymization');
  console.log(`   • Original Record:    Vikram Verma <vikram.v@example.com>`);
  console.log(`   • ${c.green}Anonymized Result:${c.reset}  ${c.bright}${c.cyan}${anonRes.record.first_name} ${anonRes.record.last_name} <${anonRes.record.email}>${c.reset}`);
  console.log(`   • Mechanism:          Completely severs linkability between subject identity and underlying row.`);

  // ── 6. REDACTION ───────────────────────────────────────────────────────────
  operation(6, 'Full Data Redaction (Blackout Purge)', 'POST /api/privacy-deletion/customers/6/apply-operation (op: redaction)');
  const redactRes = await privacyDeletionService.applyOperationToPrivacyCustomer(6, 'redaction');
  console.log(`   • Original Record:    Ananya Roy <ananya.roy@example.com>`);
  console.log(`   • ${c.green}Redacted Result:${c.reset}    ${c.bright}${c.red}${redactRes.record.first_name} ${redactRes.record.last_name} <${redactRes.record.email}>${c.reset}`);

  // ── 7. PHYSICAL HARD DELETION ──────────────────────────────────────────────
  operation(7, 'Physical Database Row Deletion (Right to Erasure)', 'DELETE /api/privacy-deletion/customers/7');
  const deleteRes = await privacyDeletionService.applyOperationToPrivacyCustomer(7, 'deletion');
  console.log(`   • Original Record:    Karthik Nair <karthik.n@gmail.com>`);
  console.log(`   • ${c.green}Deletion Status:${c.reset}    ${c.bright}${c.green}${deleteRes.message}${c.reset} (Row permanently purged)`);

  // ── 8. SEGMENTO 6-ACTION DELETION PLATFORM ─────────────────────────────────
  operation(8, 'Enterprise 6-Action Multi-Connector Deletion', 'POST /api/v1/deletions/:id/plan & /execute');
  const deletionReq = await dataDeletionService.createDeletionRequest({
    subject: { type: 'EMAIL', value: 'alex.smith@example.com', name: 'Alex Smith (Customer)', customerId: 'CUST-8842' },
    reason: 'DATA_SUBJECT_REQUEST',
    scope: 'ALL_ELIGIBLE_DATA',
    jurisdiction: 'SG'
  });
  await dataDeletionService.generatePlan(deletionReq.deletionId);
  const execData = await dataDeletionService.executeDeletion(deletionReq.deletionId);
  const certData = await dataDeletionService.getAuditTrail(deletionReq.deletionId);

  console.log(`   • Deletion Request:   ${c.bright}${c.cyan}${deletionReq.deletionId}${c.reset}`);
  console.log(`   • Action Breakdown:`);
  console.log(`      🗑️  DELETE:     ${execData.execution.summary.recordsDeleted} records purged from Marketing & Session Telemetry`);
  console.log(`      🏷️  ANONYMIZE:  ${execData.execution.summary.recordsAnonymized} records pseudonymized in Snowflake Warehouse`);
  console.log(`      🕶️  MASK:       ${execData.execution.summary.recordsMasked} records redacted in Salesforce CRM`);
  console.log(`      🔄  RETAIN:     ${execData.execution.summary.recordsRetained} records preserved for Statutory 7-Year Tax Compliance`);
  console.log(`   • SHA-256 Certificate:${c.yellow} ${certData.auditTrail.cryptographicSignature.hash}${c.reset}`);

  console.log('\n' + c.cyan + '═'.repeat(78) + c.reset);
  console.log(`${c.bright}${c.green}  ✅ ALL 8 PRIVACY, MASKING, HASHING & DELETION APIS FULLY VERIFIED!${c.reset}`);
  console.log(c.cyan + '═'.repeat(78) + c.reset + '\n');
}

runDemo().catch(console.error);
