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

-- Customer Data Protection Table
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

