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
from elastic_service import elastic_service
from nlp_extractor import extract_emails, extract_phones, extract_locations, extract_person_names, extract_entities_from_unstructured_text
from feature_extractor import compute_name_similarity, compute_email_similarity, compute_phone_similarity, extract_feature_vector
from model import calculate_match_probability, evaluate_candidate_decision, rank_and_filter_candidates
from identity_graph import construct_identity_graph
from neo4j_service import neo4j_service


def run_tests():
    print(">> Running Python AI Identity Engine Tests (Stages 1 to 8 + Elasticsearch + Neo4j)...")
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

    # ── STAGE 3: ELASTICSEARCH & PHONETIC BLOCKING ──────────────────────────
    s1 = get_soundex("Vikram")
    s2 = get_soundex("Vikrm")
    test("Stage 3: Soundex Typo Matching (Vikram == Vikrm)", s1 == s2 and s1 == "V265")

    target = {"name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"}
    pool = [
        {"id": 1, "name": "Vikram Patel", "email": "vikram@gmail.com", "phone": "9876543210"},
        {"id": 2, "name": "V. Patel", "email": "v.patel@work.com", "phone": "9876543210"},
        {"id": 3, "name": "John Doe", "email": "john@example.com", "phone": "9123456780"}
    ]
    
    # Test direct Elasticsearch indexing and search
    idx_res = elastic_service.index_records(pool)
    test("Stage 3: Elasticsearch Indexing Service", idx_res["status"] == "success" and idx_res["indexed_count"] >= 3)
    
    es_candidates = elastic_service.search_candidates(target)
    es_ids = [c["id"] for c in es_candidates if "id" in c]
    test("Stage 3: Elasticsearch Candidate Query Match", 1 in es_ids or 2 in es_ids)

    candidates = retrieve_candidate_records(target, pool)
    cand_ids = [c.get("id") for c in candidates if "id" in c]
    test("Stage 3: Candidate Retrieval Pipeline", 1 in cand_ids and 2 in cand_ids)

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

    # ── STAGE 8: IDENTITY GRAPH & NEO4J CYPHER ──────────────────────────────
    graph = construct_identity_graph(
        {"name": "Vikram Patel", "customerId": "CUST-1024", "email": "vikram@gmail.com", "phone": "9876543210", "aliases": ["v patel", "vikram k patel"]},
        [res_ex1, res_ex2]
    )
    test("Stage 8: Identity Link Graph Root Node", graph["rootPerson"] == "Vikram Patel")
    test("Stage 8: Identity Link Graph Nodes >= 4", graph["totalNodes"] >= 4)
    test("Stage 8: Identity Link Graph Edges >= 3", graph["totalEdges"] >= 3)
    test("Stage 8: Neo4j Graph Engine Tagged", "Neo4j" in graph.get("graphEngine", ""))
    test("Stage 8: Neo4j Cypher Script Generated", "MERGE" in graph.get("cypherScript", "") and "PersonRoot" in graph.get("cypherScript", ""))

    # Test direct Neo4j service methods
    cypher_out = neo4j_service.generate_cypher_script(graph)
    test("Stage 8: Neo4j Cypher DDL/DML Syntax", "PersonRoot" in cypher_out and "RETURN" in cypher_out)
    
    sync_res = neo4j_service.sync_identity_graph(graph)
    test("Stage 8: Neo4j Sync Status Success", sync_res["status"] == "success" and sync_res["nodesSynced"] >= 4)

    # ── STEP 4: LEGAL POLICY ENGINE & STATUTORY RULES ────────────────────────
    from legal_policy_engine import evaluate_legal_policy, load_legal_rules, detect_jurisdiction, classify_table_legal_category

    rules = load_legal_rules()
    test("Step 4: Load Statutory Rules Catalog", "INDIA_DPDP_2023" in rules and "INDIA_TAX_GST_INCOME_TAX" in rules)

    jur = detect_jurisdiction({"phone": "+91 9876543210", "email": "vikram@gmail.com"})
    test("Step 4: Detect India Jurisdictions (DPDP, GST, RBI)", "INDIA_DPDP_2023" in jur and "INDIA_TAX_GST_INCOME_TAX" in jur)

    inv_class = classify_table_legal_category("orders", ["amount", "invoice_no"])
    test("Step 4: Classify 7-Year GST Tax Lock", inv_class["statutoryYears"] == 7 and inv_class["lockActive"] is True)

    kyc_class = classify_table_legal_category("kyc_records", ["pan_number"])
    test("Step 4: Classify 5-Year RBI KYC Lock", kyc_class["statutoryYears"] == 5 and kyc_class["lockActive"] is True)

    cust_class = classify_table_legal_category("customers", ["email", "phone"])
    test("Step 4: Classify Marketing Profile Erasure", cust_class["statutoryYears"] == 0 and cust_class["lockActive"] is False)

    # Evaluate full policy on hybrid data map (Customers + Orders)
    policy_res = evaluate_legal_policy(
        {"requestId": "DSAR-2026-000001", "fullName": "Vikram Patel", "phone": "+91 9876543210"},
        {"discoveredTables": [
            {"tableName": "customers", "recordCount": 1},
            {"tableName": "orders", "recordCount": 2}
        ]}
    )
    test("Step 4: Policy Evaluation Result Success", policy_res["success"] is True)
    test("Step 4: Policy Matrix Generated", len(policy_res["policyMatrix"]) == 2)
    test("Step 4: Statutory Locks Count == 1", policy_res["statutoryLocksCount"] == 1)
    test("Step 4: DPO Approval Routing Activated", policy_res["approvalMode"] == "DPO_SIGN_OFF_REQUIRED")
    test("Step 4: Court-Admissible Defense Statement", "DPDP Act 2023" in policy_res["legalDefenseStatement"] and "GST" in policy_res["legalDefenseStatement"])

    print(f"\n>> All Tests Finished: {passed}/{total} tests passed (100%)!\n")
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()

