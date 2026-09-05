"""
Stage 3: Candidate Generation & Phonetic Blocking Module
Implements Soundex and Metaphone algorithms to index and retrieve candidate records.
"""

import re
from typing import List, Dict, Any, Set


def get_soundex(name: str) -> str:
    """
    Compute Soundex phonetic code for a name.
    E.g. "Vikram" -> "V265", "Vikrm" -> "V265"
    """
    if not name or not name.strip():
        return ""

    name = re.sub(r'[^A-Za-z]', '', name).upper()
    if not name:
        return ""

    first_char = name[0]
    
    mapping = {
        'B': '1', 'F': '1', 'P': '1', 'V': '1',
        'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
        'D': '3', 'T': '3',
        'L': '4',
        'M': '5', 'N': '5',
        'R': '6'
    }

    digits = []
    prev_code = mapping.get(first_char, '0')

    for char in name[1:]:
        code = mapping.get(char, '0')
        if code != '0' and code != prev_code:
            digits.append(code)
        prev_code = code

    # Pad with zeros to 4 characters total
    soundex_code = (first_char + ''.join(digits) + '000')[:4]
    return soundex_code


def get_metaphone(name: str) -> str:
    """
    Simplified Metaphone phonetic representation for English/Indian names.
    Converts similar sounding syllables into standardized phonetic tokens.
    """
    if not name or not name.strip():
        return ""

    name = re.sub(r'[^A-Za-z]', '', name).upper()
    if not name:
        return ""

    # Drop duplicate adjacent letters
    name = re.sub(r'(.)\1+', r'\1', name)

    transformations = [
        (r'^KN|^GN|^PN|^AE|^WR', ''),
        (r'MB$', 'M'),
        (r'SCH', 'SK'),
        (r'CIA', 'X'),
        (r'CH', 'X'),
        (r'C(?=[EIY])', 'S'),
        (r'C', 'K'),
        (r'DG(?=[EIY])', 'J'),
        (r'GH', ''),
        (r'G(?=[EIY])', 'J'),
        (r'PH', 'F'),
        (r'SH|SIO|SIA', 'X'),
        (r'TH', '0'),
        (r'T(?=[IA|IO])', 'X'),
        (r'WH', 'W'),
        (r'X', 'KS'),
        (r'[AEIOU]', 'A')  # standard vowel collapse
    ]

    result = name
    for pattern, replacement in transformations:
        result = re.sub(pattern, replacement, result)

    return result[:6]


def generate_blocking_keys(name: str, email: str = "", phone: str = "") -> Set[str]:
    """
    Generate multiple index blocking keys for high-recall candidate retrieval.
    """
    keys = set()
    if name:
        parts = name.strip().split()
        for part in parts:
            if len(part) >= 2:
                keys.add(f"soundex:{get_soundex(part)}")
                keys.add(f"metaphone:{get_metaphone(part)}")
                keys.add(f"prefix3:{part[:3].lower()}")

    if email and '@' in email:
        username = email.split('@')[0].lower()
        keys.add(f"email_user:{username}")
        if len(username) >= 4:
            keys.add(f"email_prefix4:{username[:4]}")

    if phone and len(phone) >= 6:
        keys.add(f"phone_last4:{phone[-4:]}")
        keys.add(f"phone_first6:{phone[:6]}")

    return keys


def retrieve_candidate_records(target: Dict[str, Any], pool: List[Dict[str, Any]], max_candidates: int = 50) -> List[Dict[str, Any]]:
    """
    Filter large record pool down to candidate blocks matching any blocking key.
    """
    target_name = target.get("name") or target.get("fullName") or ""
    target_email = target.get("email") or ""
    target_phone = target.get("phone") or ""

    target_keys = generate_blocking_keys(target_name, target_email, target_phone)

    candidates = []
    for record in pool:
        rec_name = record.get("name") or record.get("full_name") or ""
        rec_email = record.get("email") or ""
        rec_phone = record.get("phone") or ""

        rec_keys = generate_blocking_keys(rec_name, rec_email, rec_phone)
        
        # Check set intersection
        shared_keys = target_keys.intersection(rec_keys)
        if shared_keys:
            candidate_copy = dict(record)
            candidate_copy["_matched_blocking_keys"] = list(shared_keys)
            candidates.append(candidate_copy)

        if len(candidates) >= max_candidates:
            break

    return candidates
