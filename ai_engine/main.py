"""
Segmento Protect - AI Identity Resolution & Data Discovery Microservice
FastAPI Application serving all 8 Stages of the AI Identity Resolution Architecture.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Tuple

from normalizer import normalize_identity_payload, generate_alias_permutations
from blocker import retrieve_candidate_records, generate_blocking_keys, get_soundex, get_metaphone
from nlp_extractor import extract_entities_from_unstructured_text
from feature_extractor import extract_feature_vector
from model import evaluate_candidate_decision, rank_and_filter_candidates
from identity_graph import construct_identity_graph

app = FastAPI(
    title="Segmento Protect - AI Identity Resolution Service",
    description="Microservice providing Full 8-Stage AI Identity Resolution, NLP, and ML Probabilistic Matching for DSAR Step 2",
    version="2.0.0"
)


# ── REQUEST & RESPONSE SCHEMAS ──────────────────────────────────────────────

class NormalizeRequest(BaseModel):
    fullName: Optional[str] = Field(default="", description="Full Name of Data Subject")
    email: Optional[str] = Field(default="", description="Email address")
    phone: Optional[str] = Field(default="", description="Phone number")
    customerId: Optional[str] = Field(default="", description="Customer ID")


class BlockerRequest(BaseModel):
    target: Dict[str, Any] = Field(..., description="Target identity query")
    pool: List[Dict[str, Any]] = Field(default=[], description="List of records to search within")
    maxCandidates: Optional[int] = Field(default=50, description="Max candidates to return")


class NlpExtractRequest(BaseModel):
    text: str = Field(..., description="Raw unstructured text from logs/notes")
    targetAliases: Optional[List[str]] = Field(default=[], description="Optional target alias list for guidance")


class MatchRequest(BaseModel):
    target: Dict[str, Any] = Field(..., description="Target identity attributes")
    candidate: Dict[str, Any] = Field(..., description="Candidate database record")
    sourceSystem: Optional[str] = Field(default="customers", description="Source system name")


class FullResolveRequest(BaseModel):
    target: Dict[str, Any] = Field(..., description="Target identity input from Step 1")
    databasePools: Dict[str, List[Dict[str, Any]]] = Field(default={}, description="Dict of system table records")
    unstructuredLogs: Optional[List[str]] = Field(default=[], description="List of raw log texts")


# ── REST ENDPOINTS ──────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Health check status endpoint."""
    return {
        "status": "healthy",
        "service": "Segmento Protect AI Identity Engine",
        "version": "2.0.0",
        "activeStages": [
            "Stage 1: Data Normalization",
            "Stage 2: Exact Matching Fast-Path",
            "Stage 3: Phonetic Candidate Blocking",
            "Stage 4: NLP / Named Entity Recognition",
            "Stage 5: Multi-Attribute Feature Engineering",
            "Stage 6: ML Entity Resolution Scorer",
            "Stage 7: Confidence Threshold & Decision Logic",
            "Stage 8: Identity Link Graph"
        ]
    }


@app.post("/api/ai/normalize")
def normalize_identity(payload: NormalizeRequest):
    """
    Stage 1: Clean, lowercase, standardize phone/email, and generate alias permutations.
    """
    try:
        result = normalize_identity_payload(payload.model_dump())
        return {
            "success": True,
            "stage": "Stage 1: Data Normalization",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/candidates")
def get_candidates(payload: BlockerRequest):
    """
    Stage 3: Candidate Generation & Phonetic Blocking using Soundex and Metaphone.
    """
    try:
        target = payload.target
        pool = payload.pool
        candidates = retrieve_candidate_records(target, pool, payload.maxCandidates)
        
        target_name = target.get("name") or target.get("fullName") or ""
        soundex_code = get_soundex(target_name)
        metaphone_code = get_metaphone(target_name)

        return {
            "success": True,
            "stage": "Stage 3: Candidate Generation & Blocking",
            "target": target,
            "phoneticCodes": {
                "soundex": soundex_code,
                "metaphone": metaphone_code
            },
            "candidateCount": len(candidates),
            "candidates": candidates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/extract-entities")
def extract_entities(payload: NlpExtractRequest):
    """
    Stage 4: NLP Named Entity Recognition for Unstructured Data (Audit logs, chat notes).
    """
    try:
        result = extract_entities_from_unstructured_text(payload.text, payload.targetAliases)
        return {
            "success": True,
            "stage": "Stage 4: NLP / Named Entity Recognition",
            "extraction": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/match")
def match_candidate(payload: MatchRequest):
    """
    Stages 5, 6, 7: Feature Engineering, ML Probability Scoring, and Confidence Threshold Decision.
    """
    try:
        decision_result = evaluate_candidate_decision(payload.target, payload.candidate, payload.sourceSystem)
        return {
            "success": True,
            "evaluation": decision_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/resolve-full")
def resolve_full_identity(payload: FullResolveRequest):
    """
    Complete End-to-End Pipeline (Stages 1 through 8):
    1. Normalization & Alias Permutations
    2. Phonetic Candidate Generation
    3. NLP Entity Extraction from unstructured logs
    4. Feature Vector Engineering
    5. ML Match Probability Scoring
    6. Confidence Thresholding & Unknown Person Rejection
    7. Identity Link Graph Construction
    """
    try:
        # Stage 1: Normalize Target
        norm_res = normalize_identity_payload(payload.target)
        normalized_target = norm_res["normalized"]
        normalized_target["aliases"] = norm_res["aliases"]

        # Stage 4: NLP Extraction on Unstructured Logs
        nlp_extractions = []
        for log_text in payload.unstructuredLogs:
            if log_text and log_text.strip():
                ext = extract_entities_from_unstructured_text(log_text, norm_res["aliases"])
                nlp_extractions.append(ext)

        # Stage 3, 5, 6, 7: Candidate Scoring across all database tables
        candidate_evaluations = []
        for system_name, records in payload.databasePools.items():
            # Apply phonetic blocker to filter candidate pool
            candidates = retrieve_candidate_records(normalized_target, records, max_candidates=50)
            # If blocker returned nothing, test full pool (failsafe)
            test_pool = candidates if len(candidates) > 0 else records

            for rec in test_pool:
                eval_res = evaluate_candidate_decision(normalized_target, rec, system_name)
                eval_res["recordData"] = rec
                candidate_evaluations.append(eval_res)

        # Sort candidate evaluations by match probability descending
        candidate_evaluations.sort(key=lambda x: x["matchProbability"], reverse=True)

        matched_records = [c for c in candidate_evaluations if c["isMatched"]]
        rejected_records = [c for c in candidate_evaluations if not c["isMatched"]]

        # Stage 8: Identity Link Graph
        identity_graph = construct_identity_graph(
            normalized_target,
            matched_records,
            nlp_extractions
        )

        # Determine Overall Primary Status
        best_match = candidate_evaluations[0] if len(candidate_evaluations) > 0 else None
        overall_status = "UNKNOWN_REJECTED"
        overall_confidence = "0%"

        if best_match and best_match["isMatched"]:
            overall_status = best_match["decision"]
            overall_confidence = best_match["matchConfidencePercent"]
        elif best_match:
            overall_confidence = best_match["matchConfidencePercent"]

        return {
            "success": True,
            "target": normalized_target,
            "overallStatus": overall_status,
            "overallConfidence": overall_confidence,
            "matchedRecordsCount": len(matched_records),
            "rejectedRecordsCount": len(rejected_records),
            "matchedRecords": matched_records,
            "rejectedRecords": rejected_records,
            "nlpExtractions": nlp_extractions,
            "identityGraph": identity_graph
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
