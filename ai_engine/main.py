"""
Segmento Protect - AI Identity Resolution & Data Discovery Microservice
FastAPI Application serving Stages 1 to 4 of the AI Pipeline.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from normalizer import normalize_identity_payload, generate_alias_permutations
from blocker import retrieve_candidate_records, generate_blocking_keys, get_soundex, get_metaphone
from nlp_extractor import extract_entities_from_unstructured_text

app = FastAPI(
    title="Segmento Protect - AI Identity Resolution Service",
    description="Microservice providing AI Normalization, Phonetic Blocking, and NLP Entity Extraction for DSAR Step 2",
    version="1.0.0"
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


# ── REST ENDPOINTS ──────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Health check status endpoint."""
    return {
        "status": "healthy",
        "service": "Segmento Protect AI Identity Engine",
        "version": "1.0.0",
        "activeStages": ["Stage 1: Normalization", "Stage 2: Exact Fast-Path", "Stage 3: Phonetic Blocking", "Stage 4: NLP Entity Extraction"]
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
