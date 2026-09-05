"""
Stage 1: Data Normalization Module
Standardizes names, emails, and phone numbers, and generates phonetic/alias variations.
"""

import re
from typing import List, Dict, Any


def normalize_text(text: str) -> str:
    """Lowercase and remove extraneous whitespace/special characters."""
    if not text:
        return ""
    cleaned = re.sub(r'[^\w\s\.\-@]', '', text.strip().lower())
    return re.sub(r'\s+', ' ', cleaned)


def normalize_email(email: str) -> str:
    """Lowercase and strip whitespace from email addresses."""
    if not email:
        return ""
    return email.strip().lower()


def normalize_phone(phone: str) -> str:
    """
    Standardize phone numbers into clean 10-digit format.
    Strips country code (+91), leading zeros, spaces, dashes, and parentheses.
    """
    if not phone:
        return ""
    digits = re.sub(r'\D', '', phone)
    # Strip India country code 91 if 12 digits
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    # Strip leading 0 if 11 digits
    elif len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
    return digits


def generate_alias_permutations(full_name: str) -> List[str]:
    """
    Generate realistic name permutations and aliases for fuzzy matching.
    E.g., "Vikram Kumar Patel" -> ["vikram kumar patel", "vikram patel", "v. patel", "v patel", "vikram k patel", "vikram_patel"]
    """
    if not full_name:
        return []

    clean = normalize_text(full_name)
    parts = clean.split()
    if not parts:
        return []

    aliases = {clean}
    
    # First + Last (if 3+ parts)
    if len(parts) >= 3:
        first = parts[0]
        middle = parts[1]
        last = parts[-1]
        aliases.add(f"{first} {last}")
        aliases.add(f"{first} {middle[0]} {last}")
        aliases.add(f"{first} {middle[0]}. {last}")
        aliases.add(f"{first[0]}. {last}")
        aliases.add(f"{first[0]} {last}")
    elif len(parts) == 2:
        first, last = parts[0], parts[1]
        aliases.add(f"{first[0]}. {last}")
        aliases.add(f"{first[0]} {last}")
        aliases.add(f"{last} {first}")
        aliases.add(f"{first}_{last}")
        aliases.add(f"{first}.{last}")

    return sorted(list(aliases))


def normalize_identity_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize all attributes in an incoming DSAR intake payload.
    """
    raw_name = data.get("fullName") or data.get("full_name") or data.get("name") or ""
    raw_email = data.get("email") or ""
    raw_phone = data.get("phone") or ""
    customer_id = data.get("customerId") or data.get("customer_id") or ""

    clean_name = normalize_text(raw_name)
    clean_email = normalize_email(raw_email)
    clean_phone = normalize_phone(raw_phone)
    aliases = generate_alias_permutations(clean_name)

    return {
        "original": {
            "name": raw_name,
            "email": raw_email,
            "phone": raw_phone,
            "customerId": customer_id
        },
        "normalized": {
            "name": clean_name,
            "email": clean_email,
            "phone": clean_phone,
            "customerId": customer_id.strip()
        },
        "aliases": aliases
    }
