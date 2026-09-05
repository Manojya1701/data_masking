"""
Stage 4: NLP / Named Entity Recognition Module
Extracts PII entities (PERSON, EMAIL, PHONE, LOCATION, ID) from unstructured text, audit logs, and notes.
"""

import re
from typing import List, Dict, Any


# Common Indian and global cities for location entity matching
KNOWN_CITIES = {
    "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata",
    "pune", "ahmedabad", "jaipur", "surat", "lucknow", "kanpur", "nagpur", "indore",
    "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "london", "new york", "san francisco"
}

# Honorifics and title prefixes to clean
TITLES = r'\b(mr\.|mrs\.|ms\.|dr\.|prof\.|shri|smt)\b'


def extract_emails(text: str) -> List[str]:
    """Extract all valid email formats from free text."""
    if not text:
        return []
    # Standard email or obfuscated e.g. name[at]domain[dot]com
    cleaned = text.replace('[at]', '@').replace('(at)', '@').replace('[dot]', '.').replace('(dot)', '.')
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    return sorted(list(set(re.findall(pattern, cleaned, re.IGNORECASE))))


def extract_phones(text: str) -> List[str]:
    """Extract standard and formatted 10-12 digit phone numbers."""
    if not text:
        return []
    # Matches patterns like +91 98765 43210, +91-9876543210, 9876543210, 09876543210
    pattern = r'(?:\+91[\s\-]?)?(?:0)?[6-9]\d{9}\b|\b[6-9]\d{4}[\s\-]?\d{5}\b'
    matches = re.findall(pattern, text)
    cleaned = set()
    for m in matches:
        digits = re.sub(r'\D', '', m)
        if len(digits) == 12 and digits.startswith('91'):
            digits = digits[2:]
        elif len(digits) == 11 and digits.startswith('0'):
            digits = digits[1:]
        if len(digits) == 10:
            cleaned.add(digits)
    return sorted(list(cleaned))


def extract_locations(text: str) -> List[str]:
    """Extract city and geographic references from text."""
    if not text:
        return []
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    found = set()
    for w in words:
        if w in KNOWN_CITIES:
            found.add(w.capitalize())
    return sorted(list(found))


def extract_person_names(text: str, candidate_aliases: List[str] = None) -> List[str]:
    """
    Extract person names and initial variations from unstructured text.
    Combines capital entity extraction with candidate alias mining.
    """
    if not text:
        return []

    names = set()

    # 1. Look for Name/Customer/User tags in logs (e.g., "User: Vikram Patel", "Customer Vikram K. Patel requested")
    tag_patterns = [
        r'(?:user|customer|client|subject|name|account holder)[:\s]+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)',
        r'(?:requested by|contact person|ticket for)[:\s]+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)'
    ]
    for p in tag_patterns:
        for match in re.findall(p, text, re.IGNORECASE):
            names.add(match.strip())

    # 2. Capitalized 2-word or 3-word combinations (e.g., "Vikram Patel", "V. Patel")
    cap_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b|\b([A-Z]\.\s+[A-Z][a-z]+)\b'
    for match in re.findall(cap_pattern, text):
        val = match[0] or match[1]
        if val and not any(city.lower() in val.lower() for city in KNOWN_CITIES):
            names.add(val.strip())

    # 3. Match against known candidate aliases if provided
    if candidate_aliases:
        text_lower = text.lower()
        for alias in candidate_aliases:
            if len(alias) >= 3 and alias in text_lower:
                names.add(alias.title())

    return sorted(list(names))


def extract_entities_from_unstructured_text(text: str, target_aliases: List[str] = None) -> Dict[str, Any]:
    """
    Complete NLP Entity Extraction pipeline for a single unstructured text record.
    """
    if not text:
        return {"entities": {}, "entity_count": 0}

    emails = extract_emails(text)
    phones = extract_phones(text)
    locations = extract_locations(text)
    persons = extract_person_names(text, target_aliases)

    entities = {}
    if persons:
        entities["PERSON"] = persons
    if emails:
        entities["EMAIL"] = emails
    if phones:
        entities["PHONE"] = phones
    if locations:
        entities["LOCATION"] = locations

    total_count = sum(len(v) for v in entities.values())

    return {
        "raw_text_length": len(text),
        "entities": entities,
        "entity_count": total_count,
        "summary": {
            "has_person": len(persons) > 0,
            "has_email": len(emails) > 0,
            "has_phone": len(phones) > 0
        }
    }
