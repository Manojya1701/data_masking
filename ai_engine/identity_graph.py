"""
Stage 8: Identity Linking & Graph Construction Module
Constructs a unified Identity Link Graph connecting all aliases, emails, phones,
and multi-system records for the resolved person.
"""

from typing import Dict, Any, List, Set
from neo4j_service import neo4j_service


def construct_identity_graph(
    primary_identity: Dict[str, Any],
    matched_candidates: List[Dict[str, Any]],
    nlp_extractions: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Build a Node-Edge Identity Link Graph with Neo4j Knowledge Graph persistence & Cypher generation.
    Nodes: Canonical Subject, Aliases, Emails, Phones, System Records.
    Edges: Connectors with Match Method and Confidence Percentage.
    """
    canonical_name = primary_identity.get("name") or primary_identity.get("fullName") or "Target Identity"
    canonical_id = primary_identity.get("customerId") or primary_identity.get("id") or "TARGET_ROOT"
    root_node_id = f"person:{canonical_name.replace(' ', '_').lower()}"

    nodes = [
        {
            "id": root_node_id,
            "label": canonical_name,
            "type": "CANONICAL_PERSON_ROOT",
            "metadata": {
                "customerId": canonical_id,
                "isRoot": True
            }
        }
    ]

    edges = []
    seen_nodes: Set[str] = {root_node_id}

    # 1. Link Aliases
    aliases = primary_identity.get("aliases") or []
    for alias in aliases:
        node_id = f"alias:{alias.replace(' ', '_').lower()}"
        if node_id not in seen_nodes:
            seen_nodes.add(node_id)
            nodes.append({
                "id": node_id,
                "label": alias.title(),
                "type": "NAME_ALIAS",
                "metadata": {"aliasName": alias}
            })
            edges.append({
                "source": root_node_id,
                "target": node_id,
                "relationship": "HAS_ALIAS",
                "matchType": "Phonetic / Permutation",
                "confidence": "95%"
            })

    # 2. Link Direct Contact Identifiers
    primary_email = primary_identity.get("email")
    if primary_email:
        email_node_id = f"email:{primary_email.lower()}"
        if email_node_id not in seen_nodes:
            seen_nodes.add(email_node_id)
            nodes.append({
                "id": email_node_id,
                "label": primary_email,
                "type": "EMAIL_IDENTIFIER",
                "metadata": {"email": primary_email}
            })
            edges.append({
                "source": root_node_id,
                "target": email_node_id,
                "relationship": "HAS_PRIMARY_EMAIL",
                "matchType": "Exact Match",
                "confidence": "100%"
            })

    primary_phone = primary_identity.get("phone")
    if primary_phone:
        phone_node_id = f"phone:{primary_phone}"
        if phone_node_id not in seen_nodes:
            seen_nodes.add(phone_node_id)
            nodes.append({
                "id": phone_node_id,
                "label": f"+91 {primary_phone}",
                "type": "PHONE_IDENTIFIER",
                "metadata": {"phone": primary_phone}
            })
            edges.append({
                "source": root_node_id,
                "target": phone_node_id,
                "relationship": "HAS_PRIMARY_PHONE",
                "matchType": "Exact Match",
                "confidence": "100%"
            })

    # 3. Link Discovered System Records
    for cand_eval in matched_candidates:
        if not cand_eval.get("isMatched"):
            continue

        cand_id = cand_eval.get("candidateId")
        source = cand_eval.get("sourceSystem", "Database")
        conf_pct = cand_eval.get("matchConfidencePercent", "90%")
        decision = cand_eval.get("decision", "MATCH")

        rec_node_id = f"record:{source}:{cand_id}"
        if rec_node_id not in seen_nodes:
            seen_nodes.add(rec_node_id)
            nodes.append({
                "id": rec_node_id,
                "label": f"{source} (Row #{cand_id})",
                "type": "SYSTEM_RECORD",
                "metadata": {
                    "sourceSystem": source,
                    "recordId": cand_id,
                    "decision": decision
                }
            })
            edges.append({
                "source": root_node_id,
                "target": rec_node_id,
                "relationship": "LINKS_TO_RECORD",
                "matchType": "AI ML Probabilistic Match" if decision == "MATCH" else "Probable Match",
                "confidence": conf_pct
            })

    # 4. Link NLP Entities if extracted from logs
    if nlp_extractions:
        for ext in nlp_extractions:
            entities = ext.get("entities", {})
            for p in entities.get("PERSON", []):
                p_node_id = f"nlp_person:{p.lower()}"
                if p_node_id not in seen_nodes:
                    seen_nodes.add(p_node_id)
                    nodes.append({
                        "id": p_node_id,
                        "label": p,
                        "type": "NLP_EXTRACTED_ENTITY",
                        "metadata": {"entityType": "PERSON"}
                    })
                    edges.append({
                        "source": root_node_id,
                        "target": p_node_id,
                        "relationship": "EXTRACTED_FROM_LOGS",
                        "matchType": "NLP / NER Extracted",
                        "confidence": "91%"
                    })

    graph_result = {
        "rootPerson": canonical_name,
        "totalNodes": len(nodes),
        "totalEdges": len(edges),
        "nodes": nodes,
        "edges": edges,
        "graphEngine": "Neo4j Graph Database & Cypher Schema"
    }

    # Automatically generate Cypher script and sync to Neo4j
    neo_res = neo4j_service.sync_identity_graph(graph_result)
    graph_result["cypherScript"] = neo_res.get("cypherScript", "")
    graph_result["neo4jStatus"] = neo_res.get("engine", "Neo4j Graph Engine")

    return graph_result
