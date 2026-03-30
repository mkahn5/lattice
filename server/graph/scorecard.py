"""
Workspace Scorecard — scoring engine.

Computes a composite governance score from the in-memory NetworkX graph.
No new SQL queries — everything is derived from already-ingested data.

Dimensions (5):
  1. Freshness (35%)        — % tables queried within staleness window
  2. Cost Efficiency (25%)  — % DBU not wasted on cold assets
  3. Orphan Rate (20%)      — % tables with non-structural edges
  4. UC Tag Coverage (10%)  — % tables with at least one UC tag
  5. Compute Utilization (10%) — % compute with activity in 30d
"""
from __future__ import annotations
from datetime import datetime, timezone

# ── Constants ──────────────────────────────────────────────────────────

TABLE_TYPES = {"Table", "View", "StreamingTable", "MaterializedView"}
# Only score actual data tables, not views, for freshness and cost
FRESHNESS_TYPES = {"Table", "StreamingTable", "MaterializedView"}
COST_TYPES = {"Table", "StreamingTable", "MaterializedView"}
COMPUTE_TYPES = {"Warehouse", "Serverless", "Cluster"}
EXCLUDE_SCHEMAS = {"information_schema", "__databricks_internal"}
NON_STRUCTURAL_EDGES = {
    "queries", "derivedFrom", "feedsInto", "writesTo",
    "readsFrom", "indexesFrom", "embeddedBy", "serves",
}

DIMENSION_WEIGHTS = {
    "freshness": 0.35,
    "cost_efficiency": 0.25,
    "orphan_rate": 0.20,
    "tag_coverage": 0.10,
    "compute_utilization": 0.10,
}

GRADE_BRACKETS = [
    (80, "A", "Well-governed"),
    (65, "B", "Healthy with gaps"),
    (50, "C", "Needs attention"),
    (35, "D", "At risk"),
    (0,  "F", "Critical"),
]

# Scoring thresholds: list of (threshold_pct, score) tuples, evaluated top-down
FRESHNESS_THRESHOLDS = [(90, 100), (70, 75), (50, 50), (30, 25), (0, 0)]
COST_THRESHOLDS = [(95, 100), (85, 75), (75, 50), (60, 25), (0, 0)]
ORPHAN_THRESHOLDS = [(90, 100), (75, 75), (60, 50), (40, 25), (0, 0)]
TAG_THRESHOLDS = [(80, 100), (60, 75), (40, 50), (20, 25), (0, 0)]
COMPUTE_THRESHOLDS = [(90, 100), (70, 75), (50, 50), (30, 25), (0, 0)]


# ── Helpers ────────────────────────────────────────────────────────────

def _score_from_thresholds(pct: float, thresholds: list[tuple[float, int]]) -> int:
    """Map a percentage to a score using threshold brackets."""
    for threshold, score in thresholds:
        if pct >= threshold:
            return score
    return 0


def _grade(composite: float) -> tuple[str, str]:
    """Return (grade_letter, label) for a composite score."""
    for threshold, letter, label in GRADE_BRACKETS:
        if composite >= threshold:
            return letter, label
    return "F", "Critical"


def _is_excluded(node: dict) -> bool:
    """Check if a node should be excluded from scoring."""
    schema = node.get("schema_name", "")
    catalog = node.get("catalog_name", "")
    if schema in EXCLUDE_SCHEMAS:
        return True
    if catalog in ("system", "__databricks_internal"):
        return True
    # Exclude stubs (backfilled from lineage with no full metadata)
    if node.get("stub"):
        return True
    return False


def _is_foreign(node: dict) -> bool:
    """Check if a node belongs to a foreign catalog."""
    return node.get("catalog_type", "") in ("FOREIGN", "DELTASHARING")


# ── Dimension Scorers ──────────────────────────────────────────────────

def _score_freshness(tables: list[dict]) -> dict | None:
    """Score freshness: % of tables that are hot or warm."""
    eligible = [t for t in tables if t.get("type") in FRESHNESS_TYPES and not _is_foreign(t)]
    if not eligible:
        return None

    # Need heat data to score
    has_heat = [t for t in eligible if t.get("heat")]
    if not has_heat:
        return None

    fresh = sum(1 for t in eligible if t.get("heat") in ("hot", "warm"))
    total = len(eligible)
    pct = (fresh / total * 100) if total > 0 else 0
    score = _score_from_thresholds(pct, FRESHNESS_THRESHOLDS)

    return {
        "name": "Freshness",
        "key": "freshness",
        "score": score,
        "weight": DIMENSION_WEIGHTS["freshness"],
        "weighted_contribution": round(score * DIMENSION_WEIGHTS["freshness"], 1),
        "available": True,
        "detail": {
            "total_tables": total,
            "fresh_tables": fresh,
            "cold_tables": total - fresh,
            "staleness_window_days": 30,
        },
    }


def _score_cost_efficiency(tables: list[dict], cost_data: dict) -> dict | None:
    """Score cost efficiency: % of DBU not attributed to cold assets."""
    if not cost_data or not cost_data.get("available"):
        return None

    cost_nodes = cost_data.get("nodes", {})
    total_dbu = cost_data.get("summary", {}).get("total_workspace_dbu_30d", 0)
    if total_dbu <= 0:
        return None

    # Wasteful = DBU attributed to cold tables
    wasteful_dbu = 0.0
    wasteful_count = 0
    for t in tables:
        if t.get("type") not in COST_TYPES or _is_foreign(t):
            continue
        if t.get("heat") != "cold":
            continue
        node_cost = cost_nodes.get(t["id"], {})
        dbu = node_cost.get("total_dbu", 0)
        if dbu > 0:
            wasteful_dbu += dbu
            wasteful_count += 1

    efficient_pct = ((total_dbu - wasteful_dbu) / total_dbu * 100) if total_dbu > 0 else 100
    score = _score_from_thresholds(efficient_pct, COST_THRESHOLDS)

    return {
        "name": "Cost Efficiency",
        "key": "cost_efficiency",
        "score": score,
        "weight": DIMENSION_WEIGHTS["cost_efficiency"],
        "weighted_contribution": round(score * DIMENSION_WEIGHTS["cost_efficiency"], 1),
        "available": True,
        "detail": {
            "total_monthly_dbu": round(total_dbu, 1),
            "wasteful_monthly_dbu": round(wasteful_dbu, 1),
            "wasteful_table_count": wasteful_count,
        },
    }


def _score_orphan_rate(tables: list[dict], graph) -> dict | None:
    """Score orphan rate: % of tables with at least one non-structural edge."""
    eligible = [t for t in tables if t.get("type") in TABLE_TYPES]
    if not eligible:
        return None

    connected = 0
    orphaned = 0
    for t in eligible:
        node_id = t["id"]
        if not graph.has_node(node_id):
            orphaned += 1
            continue
        has_edge = False
        # Check all edges (in + out)
        for _, _, data in graph.edges(node_id, data=True):
            if data.get("relationship") in NON_STRUCTURAL_EDGES:
                has_edge = True
                break
        if not has_edge:
            for pred in graph.predecessors(node_id):
                edge_data = graph.get_edge_data(pred, node_id) or {}
                if edge_data.get("relationship") in NON_STRUCTURAL_EDGES:
                    has_edge = True
                    break
        if has_edge:
            connected += 1
        else:
            orphaned += 1

    total = len(eligible)
    pct = (connected / total * 100) if total > 0 else 0
    score = _score_from_thresholds(pct, ORPHAN_THRESHOLDS)

    return {
        "name": "Orphan Rate",
        "key": "orphan_rate",
        "score": score,
        "weight": DIMENSION_WEIGHTS["orphan_rate"],
        "weighted_contribution": round(score * DIMENSION_WEIGHTS["orphan_rate"], 1),
        "available": True,
        "detail": {
            "total_tables": total,
            "connected_tables": connected,
            "orphaned_tables": orphaned,
            "edge_types_checked": sorted(NON_STRUCTURAL_EDGES),
        },
    }


def _score_tag_coverage(tables: list[dict]) -> dict | None:
    """Score UC tag coverage: % of tables with at least one UC tag."""
    eligible = [t for t in tables if t.get("type") in TABLE_TYPES]
    if not eligible:
        return None

    tagged = sum(1 for t in eligible if t.get("uc_tags") and len(t["uc_tags"]) > 0)
    total = len(eligible)
    pct = (tagged / total * 100) if total > 0 else 0
    score = _score_from_thresholds(pct, TAG_THRESHOLDS)

    return {
        "name": "UC Tag Coverage",
        "key": "tag_coverage",
        "score": score,
        "weight": DIMENSION_WEIGHTS["tag_coverage"],
        "weighted_contribution": round(score * DIMENSION_WEIGHTS["tag_coverage"], 1),
        "available": True,
        "detail": {
            "total_tables": total,
            "tagged_tables": tagged,
            "untagged_tables": total - tagged,
        },
    }


def _score_compute_utilization(nodes: list[dict]) -> dict | None:
    """Score compute utilization: % of warehouses/clusters with DBU activity."""
    compute = [n for n in nodes if n.get("type") in COMPUTE_TYPES]
    if not compute:
        return None

    active = sum(1 for n in compute if isinstance(n.get("dbu_30d"), (int, float)) and n["dbu_30d"] > 0)
    total = len(compute)
    idle = total - active
    idle_names = [n.get("name", n.get("id", "")) for n in compute
                  if not (isinstance(n.get("dbu_30d"), (int, float)) and n["dbu_30d"] > 0)]

    pct = (active / total * 100) if total > 0 else 100
    score = _score_from_thresholds(pct, COMPUTE_THRESHOLDS)

    return {
        "name": "Compute Utilization",
        "key": "compute_utilization",
        "score": score,
        "weight": DIMENSION_WEIGHTS["compute_utilization"],
        "weighted_contribution": round(score * DIMENSION_WEIGHTS["compute_utilization"], 1),
        "available": True,
        "detail": {
            "total_compute": total,
            "active_compute": active,
            "idle_compute": idle,
            "idle_names": idle_names[:10],
        },
    }


# ── Offender Detection ─────────────────────────────────────────────────

def _detect_offenders(tables: list[dict], nodes: list[dict], graph, cost_data: dict) -> list[dict]:
    """Detect offender categories with impact ranking."""
    from server.graph._offender_detail import _table_detail, _job_detail
    cost_nodes = cost_data.get("nodes", {}) if cost_data and cost_data.get("available") else {}
    total_dbu = cost_data.get("summary", {}).get("total_workspace_dbu_30d", 0) if cost_data else 0

    offenders = []

    # 1. Cold + Costly Tables
    cold_costly = []
    for t in tables:
        if t.get("type") not in COST_TYPES or _is_foreign(t):
            continue
        if t.get("heat") != "cold":
            continue
        dbu = cost_nodes.get(t["id"], {}).get("total_dbu", 0)
        if dbu <= 0:
            continue
        days = t.get("days_since_query")
        cold_costly.append({
            "id": t["id"],
            "fqn": t.get("fqn", ""),
            "name": t.get("name", ""),
            "days_since_last_query": days if days is not None else 999,
            "monthly_dbu": round(dbu, 1),
            "impact_score": round(dbu / max(total_dbu, 1) * DIMENSION_WEIGHTS["cost_efficiency"] * 100, 1),
            **_table_detail(t),
        })
    cold_costly.sort(key=lambda x: -x["monthly_dbu"])
    if cold_costly:
        offenders.append({
            "category": "cold_costly_tables",
            "label": "Cold + Costly Tables",
            "count": len(cold_costly),
            "items": cold_costly,
        })

    # 2. Idle Compute
    compute = [n for n in nodes if n.get("type") in COMPUTE_TYPES]
    idle = [n for n in compute if not (isinstance(n.get("dbu_30d"), (int, float)) and n["dbu_30d"] > 0)]
    if idle:
        offenders.append({
            "category": "idle_compute",
            "label": "Idle Compute",
            "count": len(idle),
            "items": [{
                "id": n["id"],
                "name": n.get("name", ""),
                "type": n.get("type", ""),
                "state": n.get("state", ""),
                "dbu_30d": 0,
            } for n in idle],
        })

    # 3. Orphaned Tables
    orphaned = []
    for t in tables:
        if t.get("type") not in TABLE_TYPES:
            continue
        node_id = t["id"]
        if not graph.has_node(node_id):
            orphaned.append(t)
            continue
        has_edge = False
        for _, _, data in graph.edges(node_id, data=True):
            if data.get("relationship") in NON_STRUCTURAL_EDGES:
                has_edge = True
                break
        if not has_edge:
            for pred in graph.predecessors(node_id):
                edge_data = graph.get_edge_data(pred, node_id) or {}
                if edge_data.get("relationship") in NON_STRUCTURAL_EDGES:
                    has_edge = True
                    break
        if not has_edge:
            orphaned.append(t)
    if orphaned:
        offenders.append({
            "category": "orphaned_tables",
            "label": "Orphaned Tables",
            "count": len(orphaned),
            "items": [{
                "id": t["id"],
                "fqn": t.get("fqn", ""),
                "name": t.get("name", ""),
                "monthly_dbu": round(cost_nodes.get(t["id"], {}).get("total_dbu", 0), 1),
                **_table_detail(t),
            } for t in orphaned],
        })

    # 4. Untagged Tables
    untagged = [t for t in tables if t.get("type") in TABLE_TYPES
                and not (t.get("uc_tags") and len(t["uc_tags"]) > 0)]
    if untagged:
        offenders.append({
            "category": "untagged_tables",
            "label": "Untagged Tables",
            "count": len(untagged),
            "items": [{
                "id": t["id"],
                "fqn": t.get("fqn", ""),
                "name": t.get("name", ""),
                **_table_detail(t),
            } for t in untagged],
        })

    # 5. Failing Jobs
    jobs = [n for n in nodes if n.get("type") == "Job"]
    failing = [j for j in jobs if isinstance(j.get("success_rate_pct"), (int, float))
               and j["success_rate_pct"] < 80 and j.get("total_runs_30d", 0) > 0]
    failing.sort(key=lambda x: x.get("success_rate_pct", 100))
    if failing:
        offenders.append({
            "category": "failing_jobs",
            "label": "Failing Jobs",
            "count": len(failing),
            "items": [{
                "id": j["id"],
                "name": j.get("name", ""),
                "success_rate_pct": round(j.get("success_rate_pct", 0), 1),
                "total_runs_30d": j.get("total_runs_30d", 0),
                "last_run": j.get("last_run", ""),
                **_job_detail(j),
            } for j in failing],
        })

    # 6. Stale Jobs
    stale_jobs = [j for j in jobs if j.get("total_runs_30d", 0) == 0
                  and not j.get("success_rate_pct")]
    if stale_jobs:
        offenders.append({
            "category": "stale_jobs",
            "label": "Stale Jobs",
            "count": len(stale_jobs),
            "items": [{
                "id": j["id"],
                "name": j.get("name", ""),
                "last_run": j.get("last_run", ""),
                **_job_detail(j),
            } for j in stale_jobs],
        })

    # 7. Undocumented Tables (prioritized by query frequency)
    undoc = [t for t in tables if t.get("type") in TABLE_TYPES
             and not (t.get("comment") and t["comment"].strip())]
    undoc.sort(key=lambda x: -(x.get("query_count_30d", 0) or 0))
    if undoc:
        offenders.append({
            "category": "undocumented_tables",
            "label": "Undocumented Tables",
            "count": len(undoc),
            "items": [{
                "id": t["id"],
                "fqn": t.get("fqn", ""),
                "name": t.get("name", ""),
                **_table_detail(t),
            } for t in undoc],
        })

    return offenders


# ── Workspace Structure ────────────────────────────────────────────────

def _detect_structure(nodes: list[dict], tables: list[dict]) -> list[dict]:
    """Detect workspace structure observations."""
    observations = []

    # Build schema → table count map
    schema_counts: dict[str, int] = {}
    catalog_counts: dict[str, int] = {}
    default_schema_counts: dict[str, int] = {}

    for t in tables:
        if t.get("type") not in TABLE_TYPES:
            continue
        cat = t.get("catalog_name", "")
        sch = t.get("schema_name", "")
        fqn_schema = f"{cat}.{sch}" if cat and sch else sch
        schema_counts[fqn_schema] = schema_counts.get(fqn_schema, 0) + 1
        catalog_counts[cat] = catalog_counts.get(cat, 0) + 1
        if sch == "default":
            default_schema_counts[cat] = default_schema_counts.get(cat, 0) + 1

    # Oversized schemas (200+)
    oversized = [(s, c) for s, c in schema_counts.items() if c >= 200]
    if oversized:
        oversized.sort(key=lambda x: -x[1])
        observations.append({
            "observation": "oversized_schemas",
            "severity": "warning",
            "message": f"{len(oversized)} schema{'s' if len(oversized) != 1 else ''} {'have' if len(oversized) != 1 else 'has'} 200+ tables",
            "details": [{"schema": s, "table_count": c} for s, c in oversized[:10]],
        })

    # Tables in default schema
    total_default = sum(default_schema_counts.values())
    if total_default > 0:
        observations.append({
            "observation": "default_schema_tables",
            "severity": "warning",
            "message": f"{total_default} table{'s' if total_default != 1 else ''} in 'default' schema",
            "details": [{"catalog": cat, "table_count": cnt} for cat, cnt in default_schema_counts.items()],
        })

    # Empty schemas
    schemas = [n for n in nodes if n.get("type") == "Schema" and not _is_excluded(n)]
    empty_schemas = [s for s in schemas if f"{s.get('catalog_name', '')}.{s.get('name', '')}" not in schema_counts]
    if empty_schemas:
        observations.append({
            "observation": "empty_schemas",
            "severity": "info",
            "message": f"{len(empty_schemas)} empty schema{'s' if len(empty_schemas) != 1 else ''} (no tables)",
            "details": [{"schema": f"{s.get('catalog_name', '')}.{s.get('name', '')}"} for s in empty_schemas[:10]],
        })

    # Single-table schemas
    single = [(s, c) for s, c in schema_counts.items() if c == 1]
    if len(single) >= 3:  # Only flag if there are several
        observations.append({
            "observation": "single_table_schemas",
            "severity": "info",
            "message": f"{len(single)} schema{'s' if len(single) != 1 else ''} with only 1 table",
            "details": [{"schema": s} for s, _ in single[:10]],
        })

    # Catalog concentration
    total_tables = sum(catalog_counts.values())
    if total_tables > 0 and catalog_counts:
        max_cat = max(catalog_counts, key=catalog_counts.get)
        max_pct = catalog_counts[max_cat] / total_tables * 100
        if max_pct > 80 and len(catalog_counts) > 1:
            observations.append({
                "observation": "catalog_concentration",
                "severity": "info",
                "message": f"{max_pct:.0f}% of tables in catalog '{max_cat}'",
                "details": [{"catalog": max_cat, "table_count": catalog_counts[max_cat], "pct": round(max_pct, 1)}],
            })

    # Well-sized schemas (positive)
    well_sized = [(s, c) for s, c in schema_counts.items() if 5 <= c <= 100]
    if well_sized:
        observations.append({
            "observation": "well_sized_schemas",
            "severity": "positive",
            "message": f"{len(well_sized)} schema{'s' if len(well_sized) != 1 else ''} with 5–100 tables (well-sized)",
            "details": [],
        })

    # Sort: warnings first, then info, then positive
    severity_order = {"warning": 0, "info": 1, "positive": 2}
    observations.sort(key=lambda x: severity_order.get(x["severity"], 1))

    return observations


# ── Per-Catalog Breakdown ──────────────────────────────────────────────

def _by_catalog(tables: list[dict], nodes: list[dict], graph, cost_data: dict) -> list[dict]:
    """Compute per-catalog scores."""
    catalogs: dict[str, list[dict]] = {}
    for t in tables:
        cat = t.get("catalog_name", "")
        if cat and cat not in ("system", "__databricks_internal"):
            catalogs.setdefault(cat, []).append(t)

    if len(catalogs) <= 1:
        return []

    results = []
    for cat_name, cat_tables in catalogs.items():
        dims = []
        f = _score_freshness(cat_tables)
        if f:
            dims.append(f)
        o = _score_orphan_rate(cat_tables, graph)
        if o:
            dims.append(o)
        tc = _score_tag_coverage(cat_tables)
        if tc:
            dims.append(tc)

        # Simplified composite for catalog (only available dimensions)
        if dims:
            total_weight = sum(d["weight"] for d in dims)
            composite = sum(d["score"] * d["weight"] / total_weight for d in dims) if total_weight > 0 else 0
        else:
            composite = 0

        grade_letter, _ = _grade(composite)
        results.append({
            "catalog_name": cat_name,
            "composite": round(composite),
            "grade": grade_letter,
            "table_count": len(cat_tables),
        })

    results.sort(key=lambda x: x["composite"])
    return results


# ── Main Entry Point ───────────────────────────────────────────────────

def compute_scorecard(
    graph_data: dict,
    cost_data: dict | None = None,
    previous_snapshot: dict | None = None,
    notes: str = "",
    notes_updated_at: str = "",
    catalog_filter: str | None = None,
    staleness_days: int = 30,
    top_offenders: int = 10,
) -> dict:
    """
    Compute the full Workspace Scorecard.

    Args:
        graph_data: The in-memory graph dict with nodes, edges, _graph
        cost_data: Cost attribution data from compute_cost_attribution()
        previous_snapshot: Previous scorecard snapshot for delta calculation
        notes: User notes text
        notes_updated_at: ISO timestamp of last notes edit
        catalog_filter: Optional catalog name to filter scoring
        staleness_days: Staleness window for freshness (default 30)
        top_offenders: Max offenders per category

    Returns:
        Full scorecard response dict
    """
    G = graph_data.get("_graph")
    if G is None:
        return {"available": False, "reason": "Graph not ready.", "enrichment_available": False}

    all_nodes = graph_data.get("nodes", [])

    # Check enrichment
    has_enrichment = any(n.get("heat") for n in all_nodes if n.get("type") in TABLE_TYPES)
    if not has_enrichment:
        return {
            "available": False,
            "reason": "Workspace Scorecard requires system table access. Configure a SQL warehouse and grant access in Settings.",
            "enrichment_available": False,
        }

    # Filter nodes
    tables = [n for n in all_nodes if n.get("type") in TABLE_TYPES and not _is_excluded(n)]
    if catalog_filter:
        tables = [t for t in tables if t.get("catalog_name") == catalog_filter]

    # Compute dimensions
    dimensions = []
    for scorer in [
        lambda: _score_freshness(tables),
        lambda: _score_cost_efficiency(tables, cost_data or {}),
        lambda: _score_orphan_rate(tables, G),
        lambda: _score_tag_coverage(tables),
        lambda: _score_compute_utilization(all_nodes),
    ]:
        result = scorer()
        if result:
            dimensions.append(result)
        else:
            # N/A dimension
            key = scorer.__code__.co_freevars  # hack to get name
            pass  # Will handle below

    # Compute composite with N/A reweighting
    available_dims = [d for d in dimensions if d.get("available")]
    total_weight = sum(d["weight"] for d in available_dims)

    if total_weight > 0 and available_dims:
        # Reweight proportionally
        composite = 0.0
        for d in available_dims:
            adjusted_weight = d["weight"] / total_weight
            d["weighted_contribution"] = round(d["score"] * adjusted_weight, 1)
            composite += d["score"] * adjusted_weight
        composite = round(composite)
    else:
        composite = 0

    grade_letter, grade_label = _grade(composite)

    # Delta
    delta = None
    delta_direction = None
    previous_composite = None
    if previous_snapshot and isinstance(previous_snapshot.get("composite"), (int, float)):
        previous_composite = previous_snapshot["composite"]
        delta = composite - previous_composite
        delta_direction = "up" if delta > 0 else ("down" if delta < 0 else "flat")

    # Offenders
    offenders = _detect_offenders(tables, all_nodes, G, cost_data or {})

    # Workspace structure
    structure = _detect_structure(all_nodes, tables)

    # Per-catalog
    by_catalog = _by_catalog(tables, all_nodes, G, cost_data or {})

    computed_at = datetime.now(timezone.utc).isoformat()

    return {
        "available": True,
        "score": {
            "composite": composite,
            "grade": grade_letter,
            "label": grade_label,
            "delta": delta,
            "delta_direction": delta_direction,
            "previous_composite": previous_composite,
            "computed_at": computed_at,
        },
        "dimensions": dimensions,
        "offenders": offenders,
        "workspace_structure": structure,
        "by_catalog": by_catalog,
        "notes": notes,
        "notes_updated_at": notes_updated_at,
        "table_count": len(tables),
        "compute_count": len([n for n in all_nodes if n.get("type") in COMPUTE_TYPES]),
        "enrichment_available": True,
    }


def snapshot_for_cache(scorecard: dict) -> dict:
    """Extract a minimal snapshot for caching (used for delta calculation)."""
    if not scorecard.get("available"):
        return {}
    score = scorecard.get("score", {})
    return {
        "composite": score.get("composite"),
        "grade": score.get("grade"),
        "computed_at": score.get("computed_at"),
    }
