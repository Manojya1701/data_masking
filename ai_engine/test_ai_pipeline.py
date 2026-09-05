"""
Unit Tests for Python AI Microservice (Stages 1 to 4)
"""

import pytest
from normalizer import normalize_text, normalize_email, normalize_phone, generate_alias_permutations, normalize_identity_payload
from blocker import get_soundex, get_metaphone, generate_blocking_keys, retrieve_candidate_records
from nlp_extractor import extract_emails, extract_phones, extract_locations, extract_person_names, extract_entities_from_unstructured_text


# ── STAGE 1 NORMALIZATION TESTS ─────────────────────────────────────────────

def test_normalization_basic():
    assert normalize_email("  Vikram.P@Company.COM ") == "vikram.p@company.com"
    assert normalize_phone("+91-98765-43210") == "9876543210"
    assert normalize_phone("09876543210") == "9876543210"
    assert normalize_phone("98765 43210") == "9876543210"
    assert normalize_text("  Vikram   Patel!! ") == "vikram patel"


def test_alias_permutation_generation():
    aliases = generate_alias_permutations("Vikram Kumar Patel")
    assert "vikram kumar patel" in aliases
    assert "vikram patel" in aliases
    assert "v. patel" in aliases
    assert "v patel" in aliases
    assert len(aliases) >= 4


def test_normalize_identity_payload():
    payload = {
        "fullName": "Vikram Patel",
        "email": "vikram@gmail.com",
        "phone": "+91 9876543210",
        "customerId": "CUST-1024"
    }
    res = normalize_identity_payload(payload)
    assert res["normalized"]["name"] == "vikram patel"
    assert res["normalized"]["email"] == "vikram@gmail.com"
    assert res["normalized"]["phone"] == "9876543210"
    assert "v. patel" in res["aliases"]


# ── STAGE 3 PHONETIC BLOCKING TESTS ─────────────────────────────────────────

def test_soundex_matching():
    code1 = get_soundex("Vikram")
    code2 = get_soundex("Vikrm")  # typo
    assert code1 == code2
    assert code1.startswith("V")
    assert len(code1) == 4


def test_candidate_retrieval_blocking():
    target = {"name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"}
    pool = [
        {"id": 1, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        {"id": 2, "name": "V. Patel", "email": "v.patel@work.com", "phone": "9876543210"},
        {"id": 3, "name": "John Doe", "email": "john@example.com", "phone": "9123456780"}
    ]
    candidates = retrieve_candidate_records(target, pool)
    cand_ids = [c["id"] for c in candidates]
    assert 1 in cand_ids
    assert 2 in cand_ids  # matched via phone or soundex


# ── STAGE 4 NLP ENTITY EXTRACTION TESTS ─────────────────────────────────────

def test_nlp_entity_extraction_unstructured_text():
    sample_text = (
        "Audit Log #104: User Vikram Patel from Mumbai requested data masking. "
        "Contact email verified as vikram.p@example.com, mobile +91-9876543210."
    )
    result = extract_entities_from_unstructured_text(sample_text)
    entities = result["entities"]
    
    assert "EMAIL" in entities
    assert "vikram.p@example.com" in entities["EMAIL"]
    assert "PHONE" in entities
    assert "9876543210" in entities["PHONE"]
    assert "LOCATION" in entities
    assert "Mumbai" in entities["LOCATION"]
    assert "PERSON" in entities
    assert any("Vikram" in name for name in entities["PERSON"])
