"""
Segmento Protect - AI Legal Policy & Compliance Engine (Step 4)
Evaluates statutory laws (India DPDP Act 2023, RBI KYC Directions, PMLA 2002, GST Act 2017 / Income Tax 7-Year Rule, EU GDPR)
against discovered PII data maps to enforce legally-defensible erasure and statutory retention locks.
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

# Load Statutory Rule Catalog
RULES_PATH = os.path.join(os.path.dirname(__file__), 'legal_rules.json')

DEFAULT_RULES = {
    "INDIA_DPDP_2023": {
        "jurisdiction": "IN",
        "shortName": "DPDP Act 2023",
        "title": "Digital Personal Data Protection Act, 2023 (India)",
        "primarySection": "Section 12(3) - Right to Correction and Erasure of Personal Data",
        "exceptionsSection": "Section 17 - Exemptions for legal compliance, statutory obligations & legal claims",
        "maxPenalty": "₹250 Crores per violation"
    },
    "INDIA_BANKING_RBI_PMLA": {
        "jurisdiction": "IN",
        "shortName": "RBI KYC / PMLA 2002",
        "title": "RBI Master Direction - KYC (2016) & Prevention of Money Laundering Act, 2002",
        "primarySection": "PMLA Section 12(1) & RBI Master Direction Sec. 38 - Maintenance of Records",
        "mandatoryRetentionYears": 5
    },
    "INDIA_TAX_GST_INCOME_TAX": {
        "jurisdiction": "IN",
        "shortName": "GST Act 2017 / IT Act (7-Yr Rule)",
        "title": "Central Goods and Services Tax (CGST) Act 2017 & Income Tax Act 1961",
        "primarySection": "CGST Act Section 36 & Income Tax Act Section 44AA / 285BA",
        "mandatoryRetentionYears": 7
    },
    "EU_GDPR": {
        "jurisdiction": "EU",
        "shortName": "EU GDPR",
        "title": "General Data Protection Regulation (EU) 2016/679",
        "primarySection": "Article 17(1) - Right to Erasure ('Right to be Forgotten')",
        "exceptionsSection": "Article 17(3)(b) & 17(3)(e) - Compliance with legal obligation & legal claims",
        "maxPenalty": "€20 Million or 4% Global Turnover"
    }
}


def load_legal_rules() -> Dict[str, Any]:
    """Loads the statutory legal rules from JSON or falls back to default dictionary."""
    if os.path.exists(RULES_PATH):
        try:
            with open(RULES_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_RULES


def detect_jurisdiction(target: Dict[str, Any]) -> List[str]:
    """
    Detects applicable legal jurisdictions based on phone country codes, email TLDs, or explicit flags.
    """
    jurisdictions = []
    phone = str(target.get("phone") or target.get("targetPhone") or "").strip()
    email = str(target.get("email") or target.get("targetEmail") or "").strip().lower()
    country = str(target.get("country") or "").strip().upper()

    # Check for India Jurisdiction (DPDP Act, RBI, GST)
    if phone.startswith("+91") or email.endswith(".in") or country in ("IN", "INDIA", ""):
        jurisdictions.append("INDIA_DPDP_2023")
        jurisdictions.append("INDIA_TAX_GST_INCOME_TAX")
        jurisdictions.append("INDIA_BANKING_RBI_PMLA")

    # Check for EU Jurisdiction (GDPR)
    eu_tlds = (".eu", ".de", ".fr", ".nl", ".es", ".it", ".se", ".ie", ".pl")
    if any(email.endswith(tld) for tld in eu_tlds) or country in ("EU", "DE", "FR", "GB", "UK"):
        if "EU_GDPR" not in jurisdictions:
            jurisdictions.append("EU_GDPR")

    if not jurisdictions:
        jurisdictions = ["INDIA_DPDP_2023", "INDIA_TAX_GST_INCOME_TAX", "EU_GDPR"]

    return jurisdictions


def classify_table_legal_category(table_name: str, fields: List[str]) -> Dict[str, Any]:
    """
    Classifies a discovered database table into a formal legal tier with statutory retention attributes.
    """
    t_lower = (table_name or "").lower()
    fields_lower = [str(f).lower() for f in (fields or [])]

    # 1. Financial & Tax Invoice Ledgers (7-Year Mandatory Retention under GST / Income Tax)
    if any(k in t_lower for k in ["order", "invoice", "payment", "billing", "tax", "transaction"]) or \
       any(k in fields_lower for k in ["amount", "gstin", "invoice_no", "total_price", "tax_amount"]):
        return {
            "category": "FINANCIAL_TAX_LEDGER",
            "statutoryYears": 7,
            "lockActive": True,
            "statuteCitation": "CGST Act 2017 Sec. 36 & Income Tax Act Sec. 44AA",
            "recommendedAction": "PSEUDONYMIZE_DIRECT_PII_RETAIN_FINANCIALS",
            "actionLabel": "🛡️ Pseudonymize PII & Retain Financial Ledger",
            "legalRationale": "Mandatory 7-year statutory retention of sales invoices and tax records. Direct customer PII must be masked while preserving audit sums."
        }

    # 2. Banking & Regulatory KYC Records (5-Year Retention under RBI & PMLA)
    if any(k in t_lower for k in ["kyc", "bank", "pan", "aadhaar", "passport", "identity_doc"]) or \
       any(k in fields_lower for k in ["pan_number", "aadhaar", "account_number", "ifsc", "kyc_status"]):
        return {
            "category": "BANKING_KYC_RECORDS",
            "statutoryYears": 5,
            "lockActive": True,
            "statuteCitation": "RBI Master Direction - KYC Sec. 38 & PMLA 2002 Sec. 12",
            "recommendedAction": "STATUTORY_RETENTION_LOCK_RESTRICTED",
            "actionLabel": "🔒 Statutory Retention Lock (Restrict Processing)",
            "legalRationale": "Mandatory 5-year anti-money laundering retention following account closure. Access restricted to compliance audits."
        }

    # 3. Active Contracts & Support Disputes (3-Year Limitation Period)
    if any(k in t_lower for k in ["contract", "dispute", "subscription", "ticket", "support_chats"]):
        return {
            "category": "CONTRACTUAL_AND_SUPPORT",
            "statutoryYears": 0,
            "lockActive": False,
            "statuteCitation": "DPDP Act 2023 Sec. 12(3) & GDPR Art. 17(1)",
            "recommendedAction": "FULL_HARD_DELETE",
            "actionLabel": "🗑️ Full Hard Deletion Permitted",
            "legalRationale": "Consent withdrawn. No active litigation lock present. Complete erasure authorized."
        }

    # 4. Standard Marketing & Customer Profile (Immediate Erasure)
    return {
        "category": "MARKETING_AND_PROFILE_PII",
        "statutoryYears": 0,
        "lockActive": False,
        "statuteCitation": "DPDP Act 2023 Sec. 12(3) & GDPR Art. 17(1)",
        "recommendedAction": "FULL_HARD_DELETE",
        "actionLabel": "🗑️ Full Hard Deletion Permitted",
        "legalRationale": "Consent withdrawn for direct marketing and identity storage. Mandatory immediate erasure."
    }


def evaluate_legal_policy(
    target_subject: Dict[str, Any],
    discovered_data_map: Optional[Dict[str, Any]] = None,
    impact_report: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main evaluation pipeline: Checks all statutory laws against discovered tables and emits
    a comprehensive legal compliance assessment, statutory conflict breakdown, and DPO approval recommendation.
    """
    rules = load_legal_rules()
    jurisdictions = detect_jurisdiction(target_subject)
    current_year = datetime.now().year

    # Extract tables from data map or fallback defaults
    discovered_tables = []
    if discovered_data_map and "discoveredTables" in discovered_data_map:
        discovered_tables = discovered_data_map["discoveredTables"]
    elif discovered_data_map and "targetTables" in discovered_data_map:
        discovered_tables = discovered_data_map["targetTables"]
    else:
        discovered_tables = [
            {"tableName": "customers", "matchedFields": ["full_name", "email", "phone"], "recordCount": 1},
            {"tableName": "orders", "matchedFields": ["customer_id", "billing_name"], "recordCount": 2},
            {"tableName": "audit_logs", "matchedFields": ["email", "ip_address"], "recordCount": 1}
        ]

    policy_matrix = []
    total_records = 0
    locked_records = 0
    statutory_locks_count = 0
    active_statutes = set()

    for item in discovered_tables:
        t_name = item.get("tableName") or item.get("systemName") or "system_table"
        fields = item.get("matchedFields") or []
        rec_count = int(item.get("recordCount") or item.get("recordsDiscovered") or 1)
        total_records += rec_count

        classification = classify_table_legal_category(t_name, fields)
        retention_years = classification["statutoryYears"]
        lock_active = classification["lockActive"]
        statute_citation = classification["statuteCitation"]
        active_statutes.add(statute_citation.split("&")[0].strip())

        expiry_year = current_year + retention_years if lock_active else current_year

        if lock_active:
            statutory_locks_count += 1
            locked_records += rec_count

        policy_matrix.append({
            "tableName": t_name,
            "dataCategory": classification["category"],
            "recordCount": rec_count,
            "statutoryLockActive": lock_active,
            "mandatoryRetentionYears": retention_years,
            "retentionExpiryYear": expiry_year,
            "statuteCitation": statute_citation,
            "recommendedAction": classification["recommendedAction"],
            "actionLabel": classification["actionLabel"],
            "legalRationale": classification["legalRationale"]
        })

    # Compute Overall Legal Risk Score & DPO Approval Routing
    # 0 = No legal locks (100% auto-approved), 100 = Severe statutory block
    if statutory_locks_count == 0:
        legal_risk_score = 0
        overall_status = "COMPLIANT_AUTO_APPROVED"
        approval_mode = "AUTOMATED_ZERO_TOUCH"
        action_summary = "All discovered PII belongs to marketing and profile tiers with zero statutory retention locks. Automated execution authorized."
    elif locked_records == total_records:
        legal_risk_score = 55
        overall_status = "STATUTORY_RETENTION_LOCK_MANDATED"
        approval_mode = "DPO_SIGN_OFF_REQUIRED"
        action_summary = "Mandatory statutory retention locks active across financial ledgers. Direct PII will be pseudonymized with financial metadata preserved."
    else:
        legal_risk_score = 30
        overall_status = "SELECTIVE_HYBRID_ERASURE_MANDATED"
        approval_mode = "DPO_SIGN_OFF_REQUIRED"
        action_summary = "Hybrid compliance plan generated: Marketing/profile records will be permanently erased; financial invoices retained under GST Act 2017 Section 36."

    # Court-Admissible Legal Defense Rationale
    primary_req_id = target_subject.get("requestId") or target_subject.get("id") or "DSAR-2026-XXXXXX"
    data_subject_name = target_subject.get("fullName") or target_subject.get("dataSubject") or "Data Subject"
    
    defense_statement = (
        f"Legal Compliance Determination for {data_subject_name} ({primary_req_id}): "
        f"Evaluated pursuant to India DPDP Act 2023 Sec. 12(3) and EU GDPR Art. 17. "
        f"{total_records - locked_records} record(s) approved for permanent erasure. "
        f"{locked_records} record(s) subject to statutory retention locks under "
        f"{', '.join(list(active_statutes))} until {current_year + 7}. Direct identifiers will be cryptographically pseudonymized."
    )

    return {
        "success": True,
        "requestId": primary_req_id,
        "dataSubject": data_subject_name,
        "evaluatedAt": datetime.utcnow().isoformat() + "Z",
        "jurisdictions": jurisdictions,
        "applicableStatutes": list(active_statutes),
        "overallStatus": overall_status,
        "approvalMode": approval_mode,
        "legalRiskScore": legal_risk_score,
        "totalRecords": total_records,
        "lockedRecordsCount": locked_records,
        "erasureReadyRecordsCount": total_records - locked_records,
        "statutoryLocksCount": statutory_locks_count,
        "actionSummary": action_summary,
        "legalDefenseStatement": defense_statement,
        "policyMatrix": policy_matrix,
        "dpoSignOff": {
            "required": approval_mode == "DPO_SIGN_OFF_REQUIRED",
            "status": "PENDING_APPROVAL" if approval_mode == "DPO_SIGN_OFF_REQUIRED" else "AUTO_APPROVED",
            "signedBy": "AI Compliance Policy Engine" if approval_mode == "AUTOMATED_ZERO_TOUCH" else None,
            "signedAt": datetime.utcnow().isoformat() + "Z" if approval_mode == "AUTOMATED_ZERO_TOUCH" else None
        }
    }
