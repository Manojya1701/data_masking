# Segmento Enterprise Privacy Suite: Complete Demo Video Script & Storyboard

> **Official Video Production Script & Screen-Capture Storyboard**  
> **Modules Covered:**  
> • **Part 1:** Universal Data Protection System (UDPS) — File Privacy & Cryptographic Vault Engine  
> • **Part 2:** Data Subject Access Rights (DSAR) Portal & Granular Consent Hub  
> **Total Target Duration:** 7 to 8 Minutes (Modular by Chapter)

---

## 🎬 Video Overview & Production Guide

This script is formatted as a two-column broadcast storyboard:
* **Visual / Screen Action**: The exact window, button click, file upload, or CLI command you display on screen.
* **Audio / Voiceover Script**: The professional, clear spoken explanation you speak into the microphone.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              VIDEO CHAPTER BREAKDOWN                                   │
├─────────┬───────────────────┬──────────────────────────────────────────────────────────┤
│ CHAPTER │ TIME              │ CORE CAPABILITY DEMONSTRATED                             │
├─────────┼───────────────────┼──────────────────────────────────────────────────────────┤
│ 1       │ 0:00 – 0:50 (50s) │ Platform Overview: The Problem & Dual-Engine Solution    │
│ 2       │ 0:50 – 2:10 (80s) │ UDPS: Multi-Format PII Detection & Format-Preserving Mask│
│ 3       │ 2:10 – 3:30 (80s) │ UDPS: Cryptographic Hashing & Round-Trip AES-256-GCM Enc │
│ 4       │ 3:30 – 4:40 (70s) │ DSAR: Inbound Intake, AI Intent & Multi-Store Discovery  │
│ 5       │ 4:40 – 6:00 (80s) │ DSAR: Pre-Execution Dry-Run Simulation & DPO Sign-Off    │
│ 6       │ 6:00 – 7:00 (60s) │ DSAR: Granular Consent Matrix & Kafka Event Streaming    │
│ 7       │ 7:00 – 7:50 (50s) │ DSAR: Unified Case Timeline & Evidence Dossier Export    │
│ 8       │ 7:50 – 8:20 (30s) │ Conclusion: Test Suite Integrity & Enterprise Readiness  │
└─────────┴───────────────────┴──────────────────────────────────────────────────────────┘
```

---

## 📜 Scene-by-Scene Production Storyboard

### Chapter 1: Introduction & Enterprise Architecture Overview
**Duration:** 0:00 – 0:50 (50 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **0:00**<br>Display Segmento Title Card with architecture diagram showing UDPS (Port 3000) and DSAR Portal (Port 4000). Camera pans smoothly to dual browser windows side-by-side. | *"Welcome to the complete operational demonstration of the Segmento Enterprise Privacy Platform.*<br><br>*In today’s regulatory climate governed by regulations like India’s DPDP Act 2023, EU GDPR, and ISO/IEC 27701, enterprise organizations face two monumental privacy challenges:*<br><br>*First: Securing sensitive data at rest and across diverse file formats without breaking application logic.*<br><br>*Second: Orchestrating complex consumer data rights—like erasure and consent revocation—across distributed microservices without violating statutory financial retention laws.*" |
| **0:30**<br>Highlight the two interconnected systems: UDPS Protection Engine on the left, and the DSAR Portal & Consent Hub on the right. | *"To solve this, we engineered two complementary platforms:*<br><br>*1. **UDPS**: Our multi-format privacy transformation and cryptographic vault engine.*<br>*2. **The DSAR Portal**: Our 7-stage automated privacy lifecycle orchestrator.*<br><br>*Let’s examine UDPS in action first."* |

---

### Chapter 2: UDPS — Multi-Format PII Detection & Format-Preserving Masking
**Duration:** 0:50 – 2:10 (80 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **0:50**<br>Switch full screen to UDPS Dashboard (`http://localhost:3000`). Show the clean drag-and-drop file upload target and the 13+ format badges. | *"Here is the Universal Data Protection System dashboard. UDPS supports over 13 file formats, from CSV, JSON, and XML to columnar Parquet and ORC, as well as scanned PDFs and images.*<br><br>*Let’s take a customer dataset containing sensitive Indian and global PII—including Aadhaar IDs, PAN cards, phone numbers, and emails."* |
| **1:15**<br>Drag and drop `customers_dataset.csv` into the upload zone. Select the **"Mask Data"** radio button. Click **"Execute Protection"**. | *"Notice our format detector automatically recognizes the schema. I’ll select **Format-Preserving Masking** and click Execute.*<br><br>*In milliseconds, the engine scans the file, identifies PII entities using our regex and contextual NLP detector, and applies targeted transformation rules."* |
| **1:40**<br>Click **"Download Transformed File"**. Open the downloaded masked CSV in Excel or VS Code. Display Before vs After. | *"Let’s look at the result:*<br><br>*• Notice the 12-digit Aadhaar ID: transformed into `XXXX XXXX 9012` in strict accordance with UIDAI masked guidelines.*<br>*• Look at the PAN card: masked as `AB*****34F`.*<br>*• The email is transformed to `r***a@example.com`, preserving the domain.*<br>*• The phone number is masked as `******3210`.*<br><br>*The syntactic structure and data types remain perfectly intact, meaning downstream testing and analytics pipelines continue running seamlessly without exposing cleartext PII."* |

---

### Chapter 3: UDPS — Cryptographic Hashing & Authenticated AES-256-GCM Encryption
**Duration:** 2:10 – 3:30 (80 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **2:10**<br>Return to UDPS interface. Upload a JSON dataset. Select **"Cryptographic Hashing"**. Show dropdown options: `SHA-256`, `SHA3-256`, `BLAKE3`. Select `BLAKE3` and process. | *"Next, let’s demonstrate Cryptographic One-Way Hashing. UDPS provides three enterprise hashing algorithms: NIST-standard SHA-256, Keccak SHA3-256, and ultra-high-throughput BLAKE3.*<br><br>*When processed, each PII token is replaced with a deterministic cryptographic hash, enabling identity correlation and cross-database joins without exposing plain identifiers."* |
| **2:40**<br>Upload a critical financial file. Select **"Military-Grade Encryption (AES-256-GCM)"**. Type password `SegmentoSecure2026!`. Click **"Encrypt File"**. Download `.enc` file. | *"Now, let’s demonstrate our whole-file encryption engine.*<br><br>*We select AES-256 in Galois/Counter Mode with PBKDF2 key derivation using 310,000 iterations. We enter our encryption passphrase.*<br><br>*The output file is now encrypted with a 256-bit random salt, a 96-bit initialization vector, and a 128-bit authentication tag.*" |
| **3:05**<br>Switch to the **"Restore File"** tab. Upload the `.enc` file. Enter the password. Click **"Decrypt & Restore"**. | *"To prove lossless recovery, we navigate to Restore File, upload the `.enc` payload, enter our passphrase, and click Decrypt.*<br><br>*The engine verifies the 128-bit authentication tag to ensure zero bit-flip tampering occurred, and restores the original file with 100% byte fidelity.*<br><br>*Notice also that all downloads use high-entropy 64-character opaque tokens with a 10-minute TTL, ensuring zero internal server path exposure."* |

---

### Chapter 4: DSAR Portal — Inbound Intake, AI Intent & Multi-Store Discovery
**Duration:** 3:30 – 4:40 (70 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **3:30**<br>Switch to the DSAR Portal (`http://localhost:4000`). Display the Master Operations Dashboard showing active requests, SLA turnaround metrics, and compliance framework distribution. | *"Now, let’s transition to the **Segmento DSAR Portal & Consent Hub**.*<br><br>*Here on the main operations dashboard, privacy compliance officers have real-time visibility over all active Data Subject Requests across DPDP Act 2023, EU GDPR, CCPA, and PDPA."* |
| **3:55**<br>Navigate to **"Submit DSAR Request"** (or click Inbound Email Flow). Paste an unstructured email from a customer exercising their Right to Erasure. Click **"Analyze Intent with AI"**. | *"Let’s submit a new request. I can type or paste natural language text received at our privacy inbox.*<br><br>*Our AI Intent Classifier instantly analyzes the prompt: it recognizes the request type as 'Erasure & Deletion', detects the jurisdiction as DPDP Act Section 12 and GDPR Article 17, and calculates the statutory SLA deadline.*" |
| **4:15**<br>Click **"Launch 7-Stage Privacy Pipeline"**. Step 2: **"Automated Identity Discovery Scan"** executes live. | *"Now, we launch the 7-Stage Deep Privacy Lifecycle Pipeline.*<br><br>*Step 2 immediately initiates an automated discovery scan across 5 enterprise stores: PostgreSQL users, financial billing, analytics lakehouses, CRM databases, and cold archive vaults, surfacing all matching customer records in real time."* |

---

### Chapter 5: DSAR Portal — Pre-Execution Dry-Run Simulation & DPO Sign-Off (P2)
**Duration:** 4:40 – 6:00 (80 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **4:40**<br>Progress to **Step 4: Legal Compliance Policy & Statutory Retention Check**. Scroll down to the **"Statutory Retention Policy Matrix"**. | *"Here in Step 4 is where Segmento's privacy engineering shines.*<br><br>*The customer requested full deletion. However, Section 36 of the CGST Act 2017 strictly mandates that financial invoices and tax ledgers must be retained for 7 years.*<br><br>*Our policy matrix automatically flags this statutory conflict: non-statutory records are approved for deletion, while billing invoices are placed under a statutory retention lock until 2033.*" |
| **5:10**<br>Point to the **🧪 Pre-Execution Policy Simulation** card. Show the **Side-by-Side Diff Table**. | *"Crucially, to prevent catastrophic accidental data loss, we built the **Pre-Execution Dry-Run Engine**.*<br><br>*Look at this side-by-side diff table:*<br>*• On the left is the current state with live PII.*<br>*• On the right is the simulated outcome: customer profiles show `[PERMANENTLY PURGED]`, orders show HMAC pseudonymization, and tax invoices show a statutory retention lock.*<br>*• SendGrid marketing webhooks show automated suppression.*<br><br>*Zero production records are modified until formal approval is granted."* |
| **5:35**<br>Click **"DPO Sign-Off"** (`btn-approve-dryrun-dpo`). Badge updates to `✓ DPO AUTHORIZED`. Click **"Proceed to Execution (Step 5)"**. Watch Step 5 execute live. | *"The Data Protection Officer reviews the simulation digest and clicks **DPO Sign-Off**.*<br><br>*Now, and only now, does Step 5 unlock. The execution engine performs atomic mutations across all stores, followed by Step 6: an automated verification gate confirming zero residual PII remains."* |

---

### Chapter 6: DSAR Portal — Granular Consent Hub & Kafka Event Streaming
**Duration:** 6:00 – 7:00 (60 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **6:00**<br>Switch navigation to **"Consent Hub & Kafka Stream"**. Show the 5 consent category toggle switches and the live Kafka Connector monitor. | *"Now let's examine the **Consent Hub**, built under GDPR Article 7(3).*<br><br>*Consent withdrawal is fundamentally different from account deletion: the customer's account remains active, but specific data processing authorizations are revoked.*<br><br>*Here we see 5 granular categories: Essential, Analytics, Marketing, Third-Party Syndication, and AI Model Training."* |
| **6:30**<br>Toggle off **"AI Model Training"** and **"Marketing Promotions"**. Click **"Save Preferences"**. Watch the Kafka event stream flash with new offset commits. | *"When a user toggles off 'AI Model Training' and 'Marketing' and saves preferences, our backend immediately publishes an event to Apache Kafka topic `consent.events.withdrawal`.*<br><br>*Notice our 5 consumer connectors commit their offsets near real-time:*<br>*• SendGrid suppresses marketing dispatches.*<br>*• Snowflake excludes user records from analytics views.*<br>*• Vertex AI evicts the user's data from model fine-tuning queues.*<br><br>*And if a consumer fails, our Dead Letter Queue captures the payload for zero-loss retries.*" |

---

### Chapter 7: DSAR Portal — Unified Case Timeline & Evidence Dossier Export (P1)
**Duration:** 7:00 – 7:50 (50 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **7:00**<br>Open the **Ticket Detail Hub** for the completed DSAR ticket. Click Tab 7: **"Timeline & Vault"**. | *"Finally, let’s look at the cornerstone of our compliance accountability: the **Unified Case Timeline & Evidence Vault** in Tab 7.*<br><br>*Under GDPR Article 5(2) and DPDP Act Section 12, companies must legally prove every action taken.*<br><br>*Notice our Cryptographic Hash Chain bar at the top: it verifies **11 of 11 Sealed Milestone Blocks** as 100% intact.*" |
| **7:25**<br>Scroll through the vertical milestone chronology. Point out `prevHash ➔ seal: entryHash` on each block. Click **"📥 Export Evidence Dossier (.json)"**. Open the downloaded JSON. | *"Milestone 1 starts at a 64-zero Genesis Block, and every subsequent milestone hashes the previous block's SHA-256 seal with timestamp, actor ID, and evidence tokens.*<br><br>*If any record in the database were altered, the hash chain breaks instantly.*<br><br>*By clicking **Export Evidence Dossier**, the DPO downloads a certified, tamper-evident regulatory compliance package ready for immediate submission to supervisory privacy authorities.*" |

---

### Chapter 8: Conclusion & Enterprise Readiness Verification
**Duration:** 7:50 – 8:20 (30 seconds)

| Visual / Screen Action | Audio / Voiceover Script |
| :--- | :--- |
| **7:50**<br>Switch to terminal window. Run `npm test`. Show both test suites passing with 100% green test results (234 UDPS tests + 169 DSAR tests = 403 total tests). | *"Both systems are built with production-grade reliability and 100% automated test coverage:*<br><br>*• **20 test suites with 234 passing tests** for the UDPS Protection Engine.*<br>*• **21 test suites with 169 passing tests** for the DSAR Portal & Consent Hub.*<br><br>*Together, they form a complete, auditable, and resilient enterprise data privacy architecture.*<br><br>*Thank you!"* |
