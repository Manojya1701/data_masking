"""
Stage 5: Feature Engineering Module
Calculates multi-dimensional similarity features (Jaro-Winkler, Levenshtein, Token Sort)
to produce a normalized feature vector for candidate identity pairs.
"""

import re
from typing import Dict, Any, List, Optional
from rapidfuzz.distance import JaroWinkler, Levenshtein
from rapidfuzz import fuzz

from normalizer import normalize_text, normalize_email, normalize_phone, generate_alias_permutations


# Source system reliability scores (Authoritative system weighting)
SOURCE_RELIABILITY_WEIGHTS = {
    "customers": 1.0,               # Primary Core CRM / DB
    "crm": 1.0,
    "billing_invoices_ledger": 0.95, # Financial Tax Ledger
    "billing": 0.95,
    "protected_customer_data": 0.90, # Tokenized Vault
    "vault": 0.90,
    "privacy_deletion_customers": 0.80, # Sandbox Queue
    "processing_history": 0.75,     # File Logs & History
    "audit_logs": 0.75,
    "unstructured": 0.70
}


def compute_name_similarity(target_name: str, candidate_name: str, target_aliases: Optional[List[str]] = None) -> float:
    """
    Calculate maximum name similarity using Jaro-Winkler and Token Sort distance.
    Evaluates direct name match as well as alias permutations.
    """
    if not target_name or not candidate_name:
        return 0.0

    n1 = normalize_text(target_name)
    n2 = normalize_text(candidate_name)

    if n1 == n2:
        return 1.0

    # 1. Direct Jaro-Winkler similarity (0.0 to 1.0)
    jw_score = JaroWinkler.similarity(n1, n2)

    # 2. Token Set / Token Sort Ratio (handles word order e.g. "Patel Vikram" vs "Vikram Patel")
    token_score = fuzz.token_sort_ratio(n1, n2) / 100.0

    best_score = max(jw_score, token_score)

    # 3. Check alias permutations if available
    all_aliases = target_aliases or generate_alias_permutations(n1)
    for alias in all_aliases:
        alias_jw = JaroWinkler.similarity(alias, n2)
        alias_token = fuzz.token_sort_ratio(alias, n2) / 100.0
        best_score = max(best_score, alias_jw, alias_token)

    return round(float(min(1.0, max(0.0, best_score))), 4)


def compute_email_similarity(target_email: str, candidate_email: str) -> float:
    """
    Calculate email similarity comparing full string and local username parts.
    """
    if not target_email or not candidate_email:
        return 0.0

    e1 = normalize_email(target_email)
    e2 = normalize_email(candidate_email)

    if e1 == e2:
        return 1.0

    # Full email similarity
    full_jw = JaroWinkler.similarity(e1, e2)

    # Username part comparison (e.g. "vikram.patel" vs "vikram_patel")
    u1 = e1.split('@')[0] if '@' in e1 else e1
    u2 = e2.split('@')[0] if '@' in e2 else e2
    
    clean_u1 = re.sub(r'[\._\-]', '', u1)
    clean_u2 = re.sub(r'[\._\-]', '', u2)

    user_jw = JaroWinkler.similarity(clean_u1, clean_u2)
    user_lev = 1.0 - (Levenshtein.distance(clean_u1, clean_u2) / max(len(clean_u1), len(clean_u2), 1))

    return round(float(min(1.0, max(0.0, max(full_jw, user_jw, user_lev)))), 4)


def compute_phone_similarity(target_phone: str, candidate_phone: str) -> float:
    """
    Calculate normalized phone similarity.
    1.0 for exact 10-digit match, 0.85 for suffix/prefix match, 0.0 otherwise.
    """
    if not target_phone or not candidate_phone:
        return 0.0

    p1 = normalize_phone(target_phone)
    p2 = normalize_phone(candidate_phone)

    if not p1 or not p2:
        return 0.0

    if p1 == p2:
        return 1.0

    # Check last 6 digits
    if len(p1) >= 6 and len(p2) >= 6 and p1[-6:] == p2[-6:]:
        return 0.85

    # Check substring match
    if p1 in p2 or p2 in p1:
        return 0.80

    return 0.0


def compute_context_similarity(target_context: Dict[str, Any], candidate_context: Dict[str, Any]) -> float:
    """
    Compute contextual attribute overlap (City, Organization, Department, Timeline).
    """
    score = 0.5 # Neutral baseline

    t_loc = (target_context.get("location") or target_context.get("city") or "").strip().lower()
    c_loc = (candidate_context.get("location") or candidate_context.get("city") or "").strip().lower()

    if t_loc and c_loc:
        if t_loc == c_loc:
            score += 0.35
        elif JaroWinkler.similarity(t_loc, c_loc) >= 0.85:
            score += 0.25
        else:
            score -= 0.15

    t_org = (target_context.get("organization") or target_context.get("company") or "").strip().lower()
    c_org = (candidate_context.get("organization") or candidate_context.get("company") or "").strip().lower()

    if t_org and c_org:
        if t_org in c_org or c_org in t_org:
            score += 0.15

    return round(float(min(1.0, max(0.0, score))), 4)


def extract_feature_vector(target: Dict[str, Any], candidate: Dict[str, Any], source_system: str = "customers") -> Dict[str, Any]:
    """
    Build the complete 5-dimensional feature vector for a candidate record:
    vector = [name_sim, email_sim, phone_sim, context_sim, source_reliability]
    """
    target_name = target.get("name") or target.get("fullName") or target.get("full_name") or ""
    candidate_name = candidate.get("name") or candidate.get("full_name") or candidate.get("original_name") or ""

    target_email = target.get("email") or ""
    candidate_email = candidate.get("email") or candidate.get("original_email") or ""

    target_phone = target.get("phone") or ""
    candidate_phone = candidate.get("phone") or candidate.get("original_phone") or ""

    target_aliases = target.get("aliases") or []
    target_context = target.get("context") or {}
    candidate_context = candidate.get("context") or {}

    s_name = compute_name_similarity(target_name, candidate_name, target_aliases)
    s_email = compute_email_similarity(target_email, candidate_email)
    s_phone = compute_phone_similarity(target_phone, candidate_phone)
    s_context = compute_context_similarity(target_context, candidate_context)
    r_source = SOURCE_RELIABILITY_WEIGHTS.get(source_system.lower(), 0.80)

    vector_values = [s_name, s_email, s_phone, s_context, r_source]

    return {
        "candidateId": candidate.get("id") or candidate.get("customer_id") or "UNKNOWN",
        "sourceSystem": source_system,
        "features": {
            "nameSimilarity": s_name,
            "emailSimilarity": s_email,
            "phoneSimilarity": s_phone,
            "contextSimilarity": s_context,
            "sourceReliability": r_source
        },
        "featureVector": vector_values
    }
