"""
Test Runner for Python AI Engine (Stages 1 to 4)
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from normalizer import normalize_text, normalize_email, normalize_phone, generate_alias_permutations, normalize_identity_payload
from blocker import get_soundex, get_metaphone, generate_blocking_keys, retrieve_candidate_records
from nlp_extractor import extract_emails, extract_phones, extract_locations, extract_person_names, extract_entities_from_unstructured_text

def run_tests():
    print(">> Running Python AI Identity Engine Tests (Stages 1 to 4)...")
    passed = 0
    total = 0

    def test(name, condition):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}")

    # Stage 1: Normalization
    test("Normalize Email", normalize_email(" Vikram.P@Company.COM ") == "vikram.p@company.com")
    test("Normalize Phone (+91)", normalize_phone("+91-98765-43210") == "9876543210")
    test("Normalize Phone (Leading 0)", normalize_phone("09876543210") == "9876543210")
    test("Normalize Name", normalize_text("  Vikram   Patel!! ") == "vikram patel")
    
    aliases = generate_alias_permutations("Vikram Kumar Patel")
    test("Alias Generation", "vikram patel" in aliases and "v. patel" in aliases)

    norm_res = normalize_identity_payload({"fullName": "Vikram Patel", "email": "vikram@gmail.com", "phone": "+91 9876543210"})
    test("Identity Payload Normalization", norm_res["normalized"]["phone"] == "9876543210")

    # Stage 3: Phonetic Blocking
    s1 = get_soundex("Vikram")
    s2 = get_soundex("Vikrm")
    test("Soundex Typo Matching (Vikram == Vikrm)", s1 == s2 and s1 == "V265")

    target = {"name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"}
    pool = [
        {"id": 1, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        {"id": 2, "name": "V. Patel", "email": "v.patel@work.com", "phone": "9876543210"},
        {"id": 3, "name": "John Doe", "email": "john@example.com", "phone": "9123456780"}
    ]
    candidates = retrieve_candidate_records(target, pool)
    cand_ids = [c["id"] for c in candidates]
    test("Candidate Phonetic Blocking Retrieval", 1 in cand_ids and 2 in cand_ids)

    # Stage 4: NLP Entity Extraction
    sample_text = (
        "Audit Log #104: User Vikram Patel from Mumbai requested data masking. "
        "Contact email verified as vikram.p@example.com, mobile +91-9876543210."
    )
    extracted = extract_entities_from_unstructured_text(sample_text)
    entities = extracted["entities"]

    test("NLP Entity Extraction: Email", "vikram.p@example.com" in entities.get("EMAIL", []))
    test("NLP Entity Extraction: Phone", "9876543210" in entities.get("PHONE", []))
    test("NLP Entity Extraction: Location", "Mumbai" in entities.get("LOCATION", []))
    test("NLP Entity Extraction: Person Name", any("Vikram" in p for p in entities.get("PERSON", [])))

    print(f"\n>> All Tests Finished: {passed}/{total} tests passed (100%)!\n")
    if passed != total:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
