#!/usr/bin/env python3
"""
ORC Processor — Python helper for the Universal Data Protection System.
Reads ORC input, applies mask or hash to sensitive string columns, writes ORC output.
Communicates via stdin (JSON config) and stdout (JSON result).
"""

import sys
import json
import re
import hashlib

try:
    import pyarrow as pa
    import pyarrow.orc as orc
except ImportError:
    print(json.dumps({
        "error": "PyArrow is not installed. Run: pip install pyarrow",
        "count": 0,
        "notes": []
    }))
    sys.exit(1)


# ── Sensitive patterns ────────────────────────────────────────────────────────

PATTERNS = [
    ("email",    re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')),
    ("phone",    re.compile(r'^(?:\+91|0)?[6-9]\d{9}$')),
    ("aadhaar",  re.compile(r'^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$')),
    ("pan",      re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$')),
    ("name",     re.compile(r'^(?:[A-Z][a-z]+)(?:\s[A-Z][a-z]+){1,3}$')),
]

SENSITIVE_FIELDS = {
    'name', 'fullname', 'full_name', 'firstname', 'first_name',
    'lastname', 'last_name', 'email', 'phone', 'mobile', 'contact',
    'aadhaar', 'aadhar', 'uid', 'pan', 'dob', 'birthdate', 'address',
}


def is_sensitive_field(name: str) -> bool:
    normalized = re.sub(r'[^a-z0-9]', '', name.lower())
    return normalized in {re.sub(r'[^a-z0-9]', '', f) for f in SENSITIVE_FIELDS}


def is_sensitive_value(value: str) -> bool:
    v = value.strip()
    for _, pattern in PATTERNS:
        if pattern.match(v):
            return True
    return False


# ── Mask / Hash ───────────────────────────────────────────────────────────────

def mask_value(value: str, field_name: str = '') -> str:
    v = value.strip()
    # Email
    if re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', v):
        local, domain = v.split('@', 1)
        masked = local[0] + '*' * min(len(local) - 1, 4) if len(local) > 1 else '*'
        return f"{masked}@{domain}"
    # Phone
    if re.match(r'^[\+\d][\d\s\-]{5,}$', v):
        digits = re.sub(r'\D', '', v)
        if len(digits) >= 4:
            return '*' * (len(digits) - 4) + digits[-4:]
        return '*' * len(v)
    # Aadhaar
    if re.match(r'^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$', v):
        digits = re.sub(r'\D', '', v)
        return 'XXXX XXXX ' + digits[-4:]
    # PAN
    if re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', v):
        return v[0] + v[1] + '*' * 8 + v[9]
    # Generic
    if len(v) <= 1:
        return '*'
    return v[0] + '*' * min(len(v) - 1, 6)


def hash_value(value: str, algorithm: str = 'sha256') -> str:
    algo = algorithm.lower().replace('-', '_')
    v = value.encode('utf-8')
    if algo in ('sha256',):
        return hashlib.sha256(v).hexdigest()
    elif algo in ('sha3_256', 'sha3-256'):
        return hashlib.sha3_256(v).hexdigest()
    elif algo == 'blake3':
        # blake3 requires the blake3 package; fall back to sha256
        try:
            import blake3 as b3
            return b3.blake3(v).hexdigest()
        except ImportError:
            return hashlib.sha256(v).hexdigest()
    else:
        return hashlib.sha256(v).hexdigest()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    raw = sys.stdin.read().strip()
    try:
        config = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON config: {e}", "count": 0, "notes": []}))
        sys.exit(1)

    input_path  = config.get("input_path", "")
    output_path = config.get("output_path", "")
    operation   = config.get("operation", "mask")
    algorithm   = config.get("algorithm", "sha256")

    if not input_path or not output_path:
        print(json.dumps({"error": "input_path and output_path are required", "count": 0, "notes": []}))
        sys.exit(1)

    try:
        table = orc.read_table(input_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read ORC file: {e}", "count": 0, "notes": []}))
        sys.exit(1)

    schema = table.schema
    count = 0
    notes = ["ORC processed via Python/PyArrow."]

    columns = {}
    for i, field in enumerate(schema):
        col = table.column(i)
        field_name = field.name

        # Only process string columns
        if not pa.types.is_string(field.type) and not pa.types.is_large_string(field.type):
            columns[field_name] = col
            continue

        use_field = is_sensitive_field(field_name)
        new_values = []

        for val in col.to_pylist():
            if val is None:
                new_values.append(None)
                continue
            s = str(val)
            if use_field or is_sensitive_value(s):
                count += 1
                if operation == 'hash':
                    new_values.append(hash_value(s, algorithm))
                else:
                    new_values.append(mask_value(s, field_name))
            else:
                new_values.append(val)

        columns[field_name] = pa.array(new_values, type=field.type)

    new_table = pa.table(columns, schema=schema)

    try:
        orc.write_table(new_table, output_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to write ORC file: {e}", "count": 0, "notes": []}))
        sys.exit(1)

    print(json.dumps({"count": count, "notes": notes}))


if __name__ == '__main__':
    main()
