# Universal Data Protection System (UDPS)

A full-stack application providing a **unified interface** to **Mask, Hash, or Encrypt** sensitive data across 13+ file formats — with a clean restore flow for encrypted files.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Supported Formats](#supported-formats)
3. [Operations](#operations)
4. [Sensitive Data Detection](#sensitive-data-detection)
5. [Project Structure](#project-structure)
6. [Installation](#installation)
7. [Running the Application](#running-the-application)
8. [API Reference](#api-reference)
9. [Testing](#testing)
10. [Limitations & Honest Notes](#limitations--honest-notes)
11. [Security Design](#security-design)

---

## Architecture

```
Upload
  ↓
File Type Detector   (backend/services/file-type-detector.js)
  ↓
Privacy Engine       (backend/services/privacy-engine.js)
  ↓
Format Handler       (backend/handlers/<format>-handler.js)
  ↓
  ├── Sensitive Data Detector  (backend/services/sensitive-data-detector.js)
  ├── Masking Utils            (backend/handlers/mask-utils.js)
  ├── Hashing Service          (backend/services/hashing-service.js)
  └── Encryption Service      (backend/services/encryption-service.js)
  ↓
Output File  →  Token Store  →  /api/download/:token
```

### Key design principles
- **Modular**: Each format has its own handler; services are independent.
- **Sensitive detection is decoupled**: `sensitive-data-detector.js` works on raw strings — it has no knowledge of file formats.
- **No path exposure**: All download links use opaque tokens, not filesystem paths.
- **No password logging**: Passwords are never written to logs, error messages, or response bodies.

---

## Supported Formats

| Format | Extensions | Mask | Hash | Encrypt | Notes |
|--------|-----------|------|------|---------|-------|
| CSV | `.csv` | ✅ | ✅ | ✅ | Column-name + value detection |
| TSV | `.tsv` | ✅ | ✅ | ✅ | Same as CSV, TAB delimiter |
| JSON | `.json` | ✅ | ✅ | ✅ | Recursive traversal, nested structure preserved |
| JSONL/NDJSON | `.jsonl`, `.ndjson` | ✅ | ✅ | ✅ | Per-line independent JSON objects |
| YAML | `.yaml`, `.yml` | ✅ | ✅ | ✅ | Safe-load, structure preserved |
| XML | `.xml` | ✅ | ✅ | ✅ | Hierarchy preserved, attributes skipped |
| HTML | `.html`, `.htm` | ✅ | ✅ | ✅ | Visible body text only; script/style untouched |
| PDF | `.pdf` | ⚠️ Partial | ✅ | ✅ | See [Limitations](#limitations--honest-notes) |
| Parquet | `.parquet` | ✅ | ✅ | ✅ | String columns only; numerics preserved |
| Avro | `.avro` | ✅ | ✅ | ✅ | String fields only; schema preserved |
| ORC | `.orc` | ✅ | ✅ | ✅ | Requires Python 3 + PyArrow |
| JPEG/PNG | `.jpg`, `.jpeg`, `.png` | ⚠️ OCR-based | ✅ | ✅ | See [Limitations](#limitations--honest-notes) |

---

## Operations

### Mask
Replaces sensitive values with redacted patterns while preserving format structure.

| Value type | Example |
|-----------|---------|
| Email | `ram@example.com` → `r***@example.com` |
| Phone | `9876543210` → `******3210` |
| Aadhaar | `1234 5678 9012` → `XXXX XXXX 9012` |
| PAN | `ABCDE1234F` → `AB********F` |
| Name/generic | `Ram Sharma` → `R******` |

### Hash
One-way cryptographic transformation. **Cannot be reversed.**

Supported algorithms:
- `sha256` — SHA-256 (default)
- `sha3-256` — SHA3-256
- `blake3` — BLAKE3

All implemented using [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) — pure JavaScript, no native addons.

### Encrypt
Reversible whole-file encryption with AES-256-GCM.

- Key derivation: PBKDF2 (SHA-256, 310,000 iterations)
- Random 256-bit salt + 96-bit IV per encryption
- Authenticated encryption — wrong password produces a clear error
- All metadata (salt, IV, auth tag, algorithm, version) stored in versioned envelope
- Password never stored

---

## Sensitive Data Detection

Detection uses **two complementary signals**:

1. **Field/column name heuristics** — column names like `email`, `mobile`, `aadhaar`, `pan`, `name`, `dob` etc.
2. **Value pattern matching** — regex patterns for emails, Indian phone numbers, Aadhaar (12-digit), PAN (AAAAA9999A), and names (title-cased words).

Detected types: `email`, `phone_in`, `phone_intl`, `aadhaar`, `pan`, `name`, `credit_card`, `dob`.

**Note**: Name detection is heuristic (title-cased 2–4 words). It may produce false positives for generic capitalized words.

---

## Project Structure

```
udps/
├── package.json
├── .env.example
├── .gitignore
├── README.md
│
├── backend/
│   ├── server.js                         ← Express app entry point
│   ├── routes/
│   │   └── process.routes.js             ← API routes
│   ├── services/
│   │   ├── file-type-detector.js         ← Extension + magic-byte detection
│   │   ├── sensitive-data-detector.js    ← PII detection patterns
│   │   ├── privacy-engine.js             ← Central dispatcher
│   │   ├── encryption-service.js         ← AES-256-GCM + PBKDF2
│   │   ├── hashing-service.js            ← SHA-256/3, BLAKE3
│   │   └── token-store.js                ← Secure download tokens
│   ├── handlers/
│   │   ├── handler-utils.js              ← Shared utilities
│   │   ├── mask-utils.js                 ← Masking patterns
│   │   ├── csv-handler.js
│   │   ├── tsv-handler.js
│   │   ├── json-handler.js
│   │   ├── jsonl-handler.js
│   │   ├── yaml-handler.js
│   │   ├── xml-handler.js
│   │   ├── html-handler.js
│   │   ├── pdf-handler.js
│   │   ├── parquet-handler.js
│   │   ├── avro-handler.js
│   │   ├── orc-handler.js
│   │   └── image-handler.js
│   ├── python-helpers/
│   │   ├── orc_processor.py              ← PyArrow ORC processor
│   │   └── requirements.txt
│   ├── uploads/                          ← Temp upload dir (auto-cleaned)
│   └── output/                           ← Protected files (token-gated)
│
├── frontend/
│   └── public/
│       ├── index.html
│       ├── css/
│       │   └── style.css
│       └── js/
│           ├── app.js                    ← Main orchestrator
│           ├── upload.js                 ← Drop zone & file info
│           ├── operations.js             ← Operation cards & settings
│           └── download.js               ← Results & restore flow
│
├── scripts/
│   └── generate-test-files.js            ← Test data generator
│
└── tests/
    └── services.test.js                  ← Jest unit tests
```

---

## Installation

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** (bundled with Node.js)
- **Python 3.8+** — Required **only** for ORC format support

### 1. Install Node dependencies

```bash
cd udps
npm install
```

> **Note on `sharp`**: `sharp` is a native addon. On Windows, it requires the Visual C++ Build Tools. If installation fails, you can remove `sharp` and `tesseract.js` from `package.json` — all formats except image masking will still work.

### 2. Set up environment

```bash
copy .env.example .env
```

Edit `.env` to customize `PORT`, `MAX_FILE_SIZE`, etc.

### 3. (Optional) Install Python dependencies for ORC

```bash
cd backend/python-helpers
pip install -r requirements.txt
```

---

## Running the Application

### Development (with auto-restart)

```bash
npm run dev
```

### Production

```bash
npm start
```

Then open: **http://localhost:3000**

---

## API Reference

### POST `/api/process-file`

Processes a file with the selected operation.

**Request** (multipart/form-data):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | File to process |
| `operation` | string | ✅ | `mask`, `hash`, or `encrypt` |
| `algorithm` | string | — | `sha256`, `sha3-256`, `blake3` (for hash) |
| `password` | string | encrypt only | Encryption password |

**Response** (JSON):

```json
{
  "success": true,
  "token": "abc123...",
  "format": "csv",
  "formatLabel": "CSV",
  "operation": "mask",
  "algorithm": null,
  "count": 15,
  "notes": [],
  "downloadName": "sample_mask.csv"
}
```

---

### POST `/api/restore-file`

Decrypts a UDPS-encrypted `.enc` file.

**Request** (multipart/form-data):

| Field | Type | Required |
|-------|------|----------|
| `file` | File | ✅ `.enc` file |
| `password` | string | ✅ |

**Response** (JSON):

```json
{
  "success": true,
  "token": "def456...",
  "downloadName": "original_filename"
}
```

**Error** (wrong password):

```json
{
  "success": false,
  "error": "Decryption failed: incorrect password or data corrupted."
}
```

---

### GET `/api/download/:token`

Downloads the processed/restored file by token. Token is single-use and expires after 10 minutes.

---

### GET `/api/formats`

Returns the list of supported formats with metadata.

---

## Testing

### Run unit tests

```bash
npm test
```

Tests cover:
- `sensitive-data-detector` — value detection, field detection, `shouldProtect`
- `hashing-service` — all 3 algorithms, determinism, error handling
- `encryption-service` — encrypt/decrypt roundtrip, wrong password, edge cases
- `mask-utils` — all mask types (email, phone, Aadhaar, PAN, generic)

### Generate test data files

```bash
node scripts/generate-test-files.js
```

Outputs sample files in `test-data/` for: CSV, TSV, JSON, JSONL, YAML, XML, HTML, PDF, PNG.

---

## Limitations & Honest Notes

### PDF — Mask / Hash
- **Status**: Partial support
- The application draws a visual overlay on each page and adds a notice header.
- **Reliable coordinate-based text redaction** (finding exact word positions and overlaying them) requires PDF text positioning data that is not easily round-tripped between `pdfjs-dist` and `pdf-lib` in the same version.
- **For legally binding PDF redaction**, use a dedicated tool (Adobe Acrobat, Foxit, etc.).
- **PDF Encrypt**: Full support — operates on raw PDF bytes. Decryption restores exact original bytes.

### JPEG/PNG — Mask
- **Status**: Partial / OCR-dependent
- Masking uses `tesseract.js` OCR to detect text regions, then `sharp` to draw black boxes over sensitive words.
- OCR accuracy depends heavily on image quality, font, resolution, and contrast.
- Low-quality images or stylized fonts may not be detected.
- **Image Hash / Encrypt**: Full support — operates on raw image bytes.
- **Image Hash**: Returns a `.txt` file with the hash of the image bytes (the original image is not modified).

### ORC
- **Status**: Full support, but requires Python 3.8+ and PyArrow.
- If `python3` is not in PATH or PyArrow is not installed, ORC processing returns a clear error.
- Install: `pip install pyarrow`

### Parquet & Avro
- Only **string-typed columns** are modified by Mask and Hash operations.
- Numeric, boolean, and other typed columns are preserved exactly.
- This is the correct behavior — replacing a numeric column's value with a hash string would violate the schema.

### Name detection
- Person name detection is heuristic: looks for 2–4 consecutive title-cased words.
- This may produce false positives for generic capitalized phrases.
- Field-name detection (`name`, `fullname`, etc.) is more reliable.

### BLAKE3 (Hashing)
- Uses `@noble/hashes/blake3` — pure JavaScript implementation.
- No native addon required.

---

## Security Design

| Concern | Implementation |
|---------|---------------|
| File upload validation | Extension allowlist + multer file filter |
| Upload size limit | 100 MB default (configurable via `MAX_FILE_SIZE`) |
| Safe output filenames | UUID + sanitized basename; no user input in path |
| Path traversal prevention | `path.resolve()` check against `OUTPUT_DIR` |
| Download path exposure | Opaque tokens (64-char hex); token → path never sent to client |
| Authenticated encryption | AES-256-GCM (auth tag validates ciphertext integrity) |
| Key derivation | PBKDF2, 310,000 iterations, random 256-bit salt |
| Password safety | Never logged, never stored, never returned in responses |
| HTML execution prevention | Uploaded HTML served as static files only from `OUTPUT_DIR`, not executed |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy` |
| Token expiry | Tokens expire after 10 minutes; files cleaned up automatically |
