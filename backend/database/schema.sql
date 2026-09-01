-- Unified Data Protection System (UDPS) PostgreSQL Schema
-- Idempotent initialization using CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS processing_history (
    id BIGSERIAL PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL,
    original_file_name VARCHAR(255),
    file_format VARCHAR(50),
    file_size BIGINT,
    operation VARCHAR(50) NOT NULL,
    masking_type VARCHAR(100),
    hash_mode VARCHAR(100),
    hash_algorithm VARCHAR(100),
    encryption_algorithm VARCHAR(100),
    detected_count INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    risk_level VARCHAR(20),
    processing_time_seconds NUMERIC,
    output_file_name VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    error_category VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS privacy_scan_history (
    id BIGSERIAL PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL,
    file_name VARCHAR(255),
    file_format VARCHAR(50),
    file_size BIGINT,
    total_detected INTEGER DEFAULT 0,
    names_detected INTEGER DEFAULT 0,
    emails_detected INTEGER DEFAULT 0,
    phones_detected INTEGER DEFAULT 0,
    aadhaar_detected INTEGER DEFAULT 0,
    pan_detected INTEGER DEFAULT 0,
    credit_cards_detected INTEGER DEFAULT 0,
    dob_detected INTEGER DEFAULT 0,
    ipv4_detected INTEGER DEFAULT 0,
    ipv6_detected INTEGER DEFAULT 0,
    passport_detected INTEGER DEFAULT 0,
    risk_level VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processing_history_created_at ON processing_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_history_operation ON processing_history (operation);
CREATE INDEX IF NOT EXISTS idx_privacy_scan_history_created_at ON privacy_scan_history (created_at DESC);

-- Customer Data Protection Table (Anonymisation / Pseudonymisation / Operations Table)
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(20),
    aadhaar VARCHAR(20),
    pan VARCHAR(20),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Separate Privacy Data Deletion Table
CREATE TABLE IF NOT EXISTS privacy_deletion_customers (
    id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Saved Protected Customer Data Table
CREATE TABLE IF NOT EXISTS protected_customer_data (
    id BIGSERIAL PRIMARY KEY,
    source_customer_id BIGINT,
    operation VARCHAR(50) NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    aadhaar TEXT,
    pan TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_protected_customer_data_created_at ON protected_customer_data (created_at DESC);

-- DSAR (Data Subject Access Request / Data Erasure Workflow) Intake Table
CREATE TABLE IF NOT EXISTS dsar_requests (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    customer_id VARCHAR(100),
    request_type VARCHAR(100) NOT NULL DEFAULT 'full_erasure',
    subject_category VARCHAR(100) DEFAULT 'customer',
    verification_evidence TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dsar_requests_created_at ON dsar_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_status ON dsar_requests (status);

-- DSAR Step 2 Identity Discovery Data Map Table
CREATE TABLE IF NOT EXISTS dsar_identity_maps (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL REFERENCES dsar_requests(request_id) ON DELETE CASCADE,
    target_email VARCHAR(150) NOT NULL,
    target_name VARCHAR(150),
    target_phone VARCHAR(50),
    target_customer_id VARCHAR(100),
    discovered_systems_count INT DEFAULT 0,
    total_pii_records_found INT DEFAULT 0,
    data_map_json JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'DISCOVERY_COMPLETED',
    scanned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dsar_identity_maps_request_id ON dsar_identity_maps (request_id);
