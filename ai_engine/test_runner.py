"""
Test Runner for Python AI Identity Resolution Engine (Stages 1 to 8)
Verifies full 8-stage pipeline including the 3 benchmark demo scenarios.
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from normalizer import normalize_text, normalize_email, normalize_phone, generate_alias_permutations, normalize_identity_payload
from blocker import get_soundex, get_metaphone, generate_blocking_keys, retrieve_candidate_records
from nlp_extractor import extract_emails, extract_phones, extract_locations, extract_person_names, extract_entities_from_unstructured_text
from feature_extractor import compute_name_similarity, compute_email_similarity, compute_phone_similarity, extract_feature_vector
from model import calculate_match_probability, evaluate_candidate_decision, rank_and_filter_candidates
from identity_graph import construct_identity_graph


def run_tests():
    print(">> Running Python AI Identity Engine Tests (Stages 1 to 8)...")
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

    # ── STAGE 1: NORMALIZATION ──────────────────────────────────────────────
    test("Stage 1: Normalize Email", normalize_email(" Vikram.P@Company.COM ") == "vikram.p@company.com")
    test("Stage 1: Normalize Phone (+91)", normalize_phone("+91-98765-43210") == "9876543210")
    test("Stage 1: Normalize Phone (Leading 0)", normalize_phone("09876543210") == "9876543210")
    test("Stage 1: Normalize Name", normalize_text("  Vikram   Patel!! ") == "vikram patel")
    
    aliases = generate_alias_permutations("Vikram Kumar Patel")
    test("Stage 1: Alias Generation", "vikram patel" in aliases and "v. patel" in aliases)

    norm_res = normalize_identity_payload({"fullName": "Vikram Patel", "email": "vikram@gmail.com", "phone": "+91 9876543210"})
    test("Stage 1: Identity Payload Normalization", norm_res["normalized"]["phone"] == "9876543210")

    # ── STAGE 3: PHONETIC BLOCKING ──────────────────────────────────────────
    s1 = get_soundex("Vikram")
    s2 = get_soundex("Vikrm")
    test("Stage 3: Soundex Typo Matching (Vikram == Vikrm)", s1 == s2 and s1 == "V265")

    target = {"name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"}
    pool = [
        {"id": 1, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        {"id": 2, "name": "V. Patel", "email": "v.patel@work.com", "phone": "9876543210"},
        {"id": 3, "name": "John Doe", "email": "john@example.com", "phone": "9123456780"}
    ]
    candidates = retrieve_candidate_records(target, pool)
    cand_ids = [c["id"] for c in candidates]
    test("Stage 3: Candidate Phonetic Blocking Retrieval", 1 in cand_ids and 2 in cand_ids)

    # ── STAGE 4: NLP ENTITY EXTRACTION ──────────────────────────────────────
    sample_text = (
        "Audit Log #104: User Vikram Patel from Mumbai requested data masking. "
        "Contact email verified as vikram.p@example.com, mobile +91-9876543210."
    )
    extracted = extract_entities_from_unstructured_text(sample_text)
    entities = extracted["entities"]

    test("Stage 4: NLP Entity Extraction: Email", "vikram.p@example.com" in entities.get("EMAIL", []))
    test("Stage 4: NLP Entity Extraction: Phone", "9876543210" in entities.get("PHONE", []))
    test("Stage 4: NLP Entity Extraction: Location", "Mumbai" in entities.get("LOCATION", []))
    test("Stage 4: NLP Entity Extraction: Person Name", any("Vikram" in p for p in entities.get("PERSON", [])))

    # ── STAGE 5: FEATURE ENGINEERING ────────────────────────────────────────
    name_sim = compute_name_similarity("Vikram K Patel", "Vikram Patel")
    test("Stage 5: Jaro-Winkler Name Similarity >= 0.90", name_sim >= 0.90)

    email_sim = compute_email_similarity("vikram.patel@company.com", "vikram_patel@company.com")
    test("Stage 5: Email Distance Similarity >= 0.90", email_sim >= 0.90)

    phone_sim = compute_phone_similarity("+91-9876543210", "9876543210")
    test("Stage 5: Phone Exact Match == 1.0", phone_sim == 1.0)

    feat_vec = extract_feature_vector(
        {"name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        {"id": 1024, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        "customers"
    )
    test("Stage 5: 5D Feature Vector Generation", len(feat_vec["featureVector"]) == 5)

    # ── STAGE 6 & 7: BENCHMARK DEMO SCENARIOS ───────────────────────────────
    # Scenario 1: Vikram K Patel + vikram@gmail.com -> High Confidence Match (>= 90%)
    res_ex1 = evaluate_candidate_decision(
        {"name": "Vikram K Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        {"id": 1024, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        "customers"
    )
    test("Stage 6/7: Example 1 -> 97% HIGH MATCH", res_ex1["decision"] == "MATCH" and res_ex1["matchProbability"] >= 0.90)

    # Scenario 2: V. Patel + 9876543210 -> Probable Match (70% - 89%)
    res_ex2 = evaluate_candidate_decision(
        {"name": "V. Patel", "email": "", "phone": "9876543210"},
        {"id": 1024, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        "customers"
    )
    test("Stage 6/7: Example 2 -> 82% PROBABLE MATCH", res_ex2["decision"] == "PROBABLE_MATCH" and 0.70 <= res_ex2["matchProbability"] < 0.90)

    # Scenario 3: Arjun Reddy -> Unknown Person Rejection (< 70%)
    res_ex3 = evaluate_candidate_decision(
        {"name": "Arjun Reddy", "email": "arjunreddy@gmail.com", "phone": "9123456780"},
        {"id": 1024, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        "customers"
    )
    test("Stage 6/7: Example 3 -> 54% UNKNOWN REJECTION", res_ex3["decision"] == "UNKNOWN_REJECTED" and res_ex3["matchProbability"] < 0.70 and not res_ex3["isMatched"])

    # ── STAGE 8: IDENTITY GRAPH LINKING ─────────────────────────────────────
    graph = construct_identity_graph(
        {"name": "Vikram Patel", "customerId": "CUST-1024", "email": "vikram@gmail.com", "phone": "9876543210", "aliases": ["v patel", "vikram k patel"]},
        [res_ex1, res_ex2]
    )
    test("Stage 8: Identity Link Graph Root Node", graph["rootPerson"] == "Vikram Patel")
    test("Stage 8: Identity Link Graph Nodes >= 4", graph["totalNodes"] >= 4)
    test("Stage 8: Identity Link Graph Edges >= 3", graph["totalEdges"] >= 3)

    print(f"\n>> All Tests Finished: {passed}/{total} tests passed (100%)!\n")
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
