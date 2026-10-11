# Universal Data Protection System (UDPS) — Segmento Protection Engine

[![Node.js CI](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Protection%20Engine-Production%20Ready-blue.svg)]()
[![Tests](https://img.shields.io/badge/Tests-234%20Passed%20(20%20Suites)-success.svg)]()
[![Compliance](https://img.shields.io/badge/Compliance-GDPR%20%7C%20DPDP%202023%20%7C%20AES--256--GCM-orange.svg)]()

> **Segmento Protection Engine**: An enterprise-grade, high-throughput data privacy and cryptographic transformation system. Protects sensitive personally identifiable information (PII) across **13+ structured, semi-structured, and binary file formats** and live relational databases.

---

## 🏛️ System Architecture

```
Client / Upload Layer (Port 3000)
        │
        ▼
File Type & Magic-Byte Detector    (backend/services/file-type-detector.js)
        │
        ▼
Privacy Orchestration Engine       (backend/services/privacy-engine.js)
        │
        ▼
Format-Specific Handler Factory    (backend/handlers/<format>-handler.js)
 ├── Sensitive Entity Detector    (backend/services/sensitive-data-detector.js)
 ├── AI Entity Recognition Model  (ai_engine/ — Regex + Transformers)
 ├── Masking Transformation       (backend/handlers/mask-utils.js)
 ├── One-Way Cryptographic Hash   (backend/services/hashing-service.js: SHA-256 / BLAKE3)
 └── Military-Grade Encryption    (backend/services/encryption-service.js: AES-256-GCM)
        │
        ▼
Tokenized Opaque Download Vault   (backend/services/token-store.js → /api/download/:token)
```

---

## 📁 Repository Structure

The repository is organized into a clean, decoupled microservice layout:

```
udps/
├── backend/                       # All Server-Side Core Logic & APIs
│   ├── server.js                  # Primary Express server application
│   ├── routes/                    # Express REST API routes (/api/process-file, /api/restore-file, etc.)
│   ├── services/                  # Cryptography, PII detectors, token stores, and privacy engines
│   ├── handlers/                  # Dedicated handlers for all 13+ file formats
│   ├── database/                  # Database connections (PostgreSQL & local zero-config fallback)
│   ├── gateway/                   # OAuth 2.0 / OIDC Gateway, JWKS, rate limiting & RBAC guards
│   ├── python-helpers/            # High-performance PyArrow ORC processor
│   ├── uploads/                   # Temporary auto-sanitized upload staging area
│   └── output/                    # Protected output storage (opaque token-gated)
│
├── frontend/                      # All Client-Side UI & Assets
│   └── public/
│       ├── index.html             # Single-Page Governance & Protection Dashboard
│       ├── css/
│       │   └── style.css          # Design system & dark/light theme tokens
│       ├── js/                    # Modular JavaScript modules
│       │   ├── app.js             # Main frontend application entry point
│       │   ├── upload.js          # Drag-and-drop file upload engine
│       │   ├── operations.js      # Masking, Hashing & Encryption controllers
│       │   ├── download.js        # Download manager with token verification
│       │   └── ...
│       └── assets/                # Enterprise brand icons and SVGs
│
├── ai_engine/                     # AI/ML Sensitive Entity Detection Engine
│   ├── detector.py                # Regex and contextual NLP entity recognizer
│   └── test_runner.py             # 38 automated AI detection verification tests
│
├── scripts/                       # Developer Utility & Demo Scripts
│   ├── demo-all-operations.js     # Live CLI demo of all 8 privacy operations
│   ├── demo-apis.js               # Live CLI demo of 6-action statutory compliance flow
│   ├── demo-oauth-gateway.js      # Live CLI demo of OAuth 2.0 / OIDC Gateway & JWKS
│   └── generate-test-files.js     # Test file generation across all 13+ formats
│
├── tests/                         # Jest Automated Test Suites (100% Green)
│   ├── services.test.js           # Core cryptographic & privacy engine tests
│   ├── database.test.js           # Database adapter & persistence tests
│   └── ...                        # 20 comprehensive test suites (234 tests)
│
├── docs/                          # Architecture Diagrams & Technical Specifications
├── server.js                      # Root convenience forwarder (delegates to backend/server.js)
├── package.json                   # Project manifest, dependencies, and npm scripts
└── README.md                      # Executive repository documentation
```

---

## ⚡ Quick Start (60 Seconds)

### 1. Clone the repository
```bash
git clone https://github.com/Manojya1701/data_masking.git
cd data_masking
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the application
```bash
npm start
```

### 4. Access the web interface
Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Run Automated Tests & Live Demos

Verify 100% automated test coverage across all core services:

```bash
# Run 20 Jest Test Suites (234 Tests Passed)
npm test

# Run Live Interactive CLI Demonstrations
npm run demo:operations   # Verify all 8 masking, hashing & encryption operations
npm run demo:apis         # Verify 6-action enterprise compliance lifecycle
npm run demo:gateway      # Verify OAuth 2.0 / OIDC RS256 token issuance & JWKS
```

---

## 🛡️ Core Protection Capabilities

### 1. Data Masking (Format-Preserving Redaction)
Preserves semantic structure while obscuring direct identifiers:
* **Email**: `ram.sharma@example.com` &rarr; `r***a@example.com`
* **Phone Numbers**: `+91 9876543210` &rarr; `******3210`
* **Aadhaar ID**: `1234 5678 9012` &rarr; `XXXX XXXX 9012`
* **PAN Card**: `ABCDE1234F` &rarr; `AB********F`
* **Names / Text**: `Ram Sharma` &rarr; `R******`

### 2. Cryptographic One-Way Hashing
Irreversible transformations implemented via pure `@noble/hashes`:
* `SHA-256` (NIST standard)
* `SHA3-256` (Keccak cryptographic permutation)
* `BLAKE3` (High-throughput parallelized tree hashing)

### 3. Military-Grade AES-256-GCM Encryption
Authenticated reversible whole-file encryption:
* Key derivation: **PBKDF2** (SHA-256, 310,000 iterations).
* Cryptographic salt: 256-bit random salt + 96-bit initialization vector (IV) per file.
* Authenticated payload: 128-bit authentication tag detects any unauthorized tampering.
* Zero plaintext leakage: passwords are never stored on disk or logged.

---

## 📊 Supported File Formats Matrix (13+ Formats)

| Format | Extensions | Mask | Hash | Encrypt | Parsing / Serialization Strategy |
|---|---|:---:|:---:|:---:|---|
| **CSV** | `.csv` | ✅ | ✅ | ✅ | Streamed comma-separated parser with header heuristics |
| **TSV** | `.tsv` | ✅ | ✅ | ✅ | Tab-separated value parser |
| **JSON** | `.json` | ✅ | ✅ | ✅ | Recursive object traversal; structure preserved |
| **JSONL / NDJSON** | `.jsonl`, `.ndjson` | ✅ | ✅ | ✅ | High-throughput per-line independent object streams |
| **YAML** | `.yaml`, `.yml` | ✅ | ✅ | ✅ | Safe-load schema parsing; nesting preserved |
| **XML** | `.xml` | ✅ | ✅ | ✅ | Fast-xml-parser hierarchy preservation; tags untouched |
| **HTML** | `.html`, `.htm` | ✅ | ✅ | ✅ | Cheerio DOM traversal; scripts/styles untouched |
| **PDF** | `.pdf` | ✅ | ✅ | ✅ | Coordinate-based banner redaction & full-stream encryption |
| **Parquet** | `.parquet` | ✅ | ✅ | ✅ | Parquetjs-lite columnar processing; schemas preserved |
| **Avro** | `.avro` | ✅ | ✅ | ✅ | Avsc schema-compliant serialization |
| **ORC** | `.orc` | ✅ | ✅ | ✅ | PyArrow native columnar processor |
| **JPEG / PNG** | `.jpg`, `.png` | ✅ | ✅ | ✅ | Tesseract OCR bounding-box masking & Sharp image rendering |

---

## 📡 REST API Reference

| Endpoint | Method | Content-Type | Description |
|---|---|---|---|
| `/api/process-file` | `POST` | `multipart/form-data` | Process uploaded file (`mask`, `hash`, `encrypt`) and receive opaque token |
| `/api/restore-file` | `POST` | `multipart/form-data` | Decrypt AES-256-GCM `.enc` file back to original plaintext |
| `/api/download/:token` | `GET` | Binary Stream | Download transformed file using single-use 10-minute token |
| `/api/formats` | `GET` | `application/json` | Return capabilities and metadata for all 13+ supported formats |
| `/api/health` | `GET` | `application/json` | Healthcheck and active database status |

---

## 🔒 Enterprise Security Guarantees

* **Zero Path Exposure**: All downloads use high-entropy 64-character opaque tokens. Internal file paths are never exposed over the wire.
* **Auto-Purge & TTL**: Uploaded temporary files and download tokens automatically expire after 10 minutes.
* **Path Traversal Protection**: All file interactions are strictly pinned to verified root directories using `path.resolve()`.
* **Zero Password Logging**: Encryption passwords never touch logs, error traces, or API responses.

---

## 📄 License & Ownership
Proprietary & Confidential &mdash; Segmento Data Protection Systems. All rights reserved.
