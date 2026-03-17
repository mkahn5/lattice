import json
import os
import re
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, field_validator

# Catalog name: alphanumerics, underscores, hyphens only (no path separators, no shell chars)
_CATALOG_NAME_RE = re.compile(r'^[a-zA-Z0-9_\-]{1,255}$')

# Simple per-endpoint cooldown for expensive mutating operations
_last_refresh_time: float = 0.0
_REFRESH_COOLDOWN_S = 10  # minimum seconds between /api/refresh or /api/switch calls


def _check_cooldown(endpoint: str) -> None:
    """Raise 429 if the endpoint was called too recently."""
    global _last_refresh_time
    now = time.monotonic()
    if now - _last_refresh_time < _REFRESH_COOLDOWN_S:
        remaining = int(_REFRESH_COOLDOWN_S - (now - _last_refresh_time)) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Ingestion already in progress. Retry in {remaining}s."
        )
    _last_refresh_time = now

router = APIRouter()

# Graph state held in module-level variable (rebuilt on /refresh)
_graph_data: dict = {"nodes": [], "edges": [], "stats": {}}

# Column lineage: {target_table_fqn_lower: [{target_col, source_table, source_col}]}
_column_lineage: dict = {}
_workspace_host: str = ""

# Cost attribution: {available, nodes, summary}
_cost_data: dict = {}

# Annotation store (initialized in app.py startup)
_annotation_store = None

# Pre-flight checker (initialized in app.py startup)
_preflight = None


def set_annotation_store(store) -> None:
    global _annotation_store
    _annotation_store = store


def set_preflight(checker) -> None:
    global _preflight
    _preflight = checker

# Ingestion progress state
_progress: dict = {"step": "Starting...", "pct": 0, "done": False, "error": False, "graph_ready": False}

# Generation counter — incremented on each new ingestion start.
# Lets old ingestion threads detect they've been superseded and abort.
_ingestion_gen: int = 0


def get_ingestion_gen() -> int:
    return _ingestion_gen


def next_ingestion_gen() -> int:
    """Increment and return the new generation number. Call before starting a new ingestion."""
    global _ingestion_gen
    _ingestion_gen += 1
    return _ingestion_gen


def set_graph(data: dict, host: str = "", gen: int | None = None):
    """Update graph state. If gen is provided, only updates if it matches the current generation."""
    global _workspace_host
    if gen is not None and gen != _ingestion_gen:
        return  # superseded ingestion — discard
    _graph_data.clear()
    _graph_data.update(data)
    if host:
        _workspace_host = host
    _progress["graph_ready"] = True  # signal: canvas can render now


def set_progress(step: str, pct: int, done: bool = False, error: bool = False, gen: int | None = None):
    """Update progress state. If gen is provided, only updates if it matches the current generation."""
    if gen is not None and gen != _ingestion_gen:
        return  # superseded ingestion — discard
    _progress["step"] = step
    _progress["pct"] = pct
    _progress["done"] = done
    _progress["error"] = error


def set_column_lineage(data: dict, gen: int | None = None):
    """Update column lineage state. If gen is provided, only updates if it matches current generation."""
    if gen is not None and gen != _ingestion_gen:
        return
    _column_lineage.clear()
    _column_lineage.update(data)


def set_cost_attribution(data: dict, gen: int | None = None):
    """Update cost attribution state. If gen is provided, only updates if it matches current generation."""
    if gen is not None and gen != _ingestion_gen:
        return
    _cost_data.clear()
    _cost_data.update(data)


@router.get("/api/cost")
def get_cost():
    """Cost attribution: DBU spend attributed to catalogs, schemas, tables, and compute nodes."""
    result: dict = {
        "available": _cost_data.get("available", False),
        "summary": _cost_data.get("summary", {}),
        "nodes": _cost_data.get("nodes", {}),
    }
    if "reason" in _cost_data:
        result["reason"] = _cost_data["reason"]
    return result


@router.get("/api/profiles")
def get_profiles():
    """List available Databricks CLI profiles."""
    import configparser
    profiles = []
    cfg_path = os.path.expanduser("~/.databrickscfg")
    try:
        cfg = configparser.ConfigParser()
        cfg.read(cfg_path)
        current = os.environ.get("DATABRICKS_PROFILE", "")
        for name in cfg.sections():
            host = cfg[name].get("host", "")
            profiles.append({
                "name": name,
                "host": host,
                "active": name == current,
            })
    except Exception as e:
        print(f"[profiles] error: {e}")
    return {"profiles": profiles, "active": os.environ.get("DATABRICKS_PROFILE", "")}


@router.get("/api/catalogs")
def get_catalogs(q: str = Query(""), limit: int = Query(200)):
    """List available catalogs in the current workspace, with optional search."""
    from server.config import get_workspace_client
    current_filter = os.environ.get("LATTICE_CATALOGS", "")
    active_set = {c.strip() for c in current_filter.split(",") if c.strip()}
    q_lower = q.strip().lower()
    try:
        w = get_workspace_client()
        results = []
        # Always include active catalogs first
        active_entries = []
        for c in w.catalogs.list():
            if not c.name or c.name.startswith("__"):
                continue
            cat_type = str(c.catalog_type).replace("CatalogType.", "") if c.catalog_type else ""
            is_active = c.name in active_set
            entry = {"name": c.name, "type": cat_type, "active": is_active}
            if is_active:
                active_entries.append(entry)
            elif not q_lower or q_lower in c.name.lower():
                results.append(entry)
            if not q_lower and len(results) >= limit:
                break
        return {"catalogs": active_entries + results[:limit], "filter": current_filter, "total_hint": len(results) + len(active_entries)}
    except Exception as e:
        return {"catalogs": [], "filter": current_filter, "error": str(e)}


@router.post("/api/switch")
async def switch_profile(body: dict):
    """Switch to a different Databricks profile and/or catalog filter, then re-ingest."""
    import asyncio, configparser
    _check_cooldown("switch")

    profile = body.get("profile", "").strip()
    catalog = body.get("catalog", "").strip()

    # Validate catalog: comma-separated list of valid catalog names
    if catalog:
        for part in catalog.split(","):
            part = part.strip()
            if part and not _CATALOG_NAME_RE.match(part):
                raise HTTPException(status_code=400, detail=f"Invalid catalog name: {part!r}")

    # Profile is optional — if omitted, keep current
    if profile:
        cfg = configparser.ConfigParser()
        cfg.read(os.path.expanduser("~/.databrickscfg"))
        if profile not in cfg:
            raise HTTPException(status_code=404, detail=f"Profile '{profile}' not found in ~/.databrickscfg")
        os.environ["DATABRICKS_PROFILE"] = profile

    os.environ["LATTICE_CATALOGS"] = catalog

    # Increment generation — any currently-running ingestion will detect this and abort
    gen = next_ingestion_gen()

    # Reset progress + graph
    _graph_data.clear()
    _graph_data.update({"nodes": [], "edges": [], "stats": {}})
    _progress.update({"step": "Switching workspace...", "pct": 0, "done": False, "error": False, "graph_ready": False})

    # Re-run ingestion in background with new generation
    from app import _run_ingestion_async
    asyncio.ensure_future(_run_ingestion_async(gen))
    return {"status": "ok", "profile": profile, "catalog": catalog}


@router.get("/api/info")
def get_info():
    cat_val = os.environ.get("LATTICE_CATALOGS", "")
    cat_filter = [c.strip() for c in cat_val.split(",") if c.strip()] or None
    return {
        "host": _workspace_host,
        "catalog_filter": cat_filter,
        "catalog_limit": None if cat_filter else int(os.environ.get("LATTICE_CATALOG_LIMIT", "20")),
        "schema_limit": int(os.environ.get("LATTICE_SCHEMA_LIMIT", "20")) or None,
        "table_limit": int(os.environ.get("LATTICE_TABLE_LIMIT", "50")) or None,
        "ingested": bool(_graph_data["nodes"]),
    }


@router.get("/api/status")
def get_status():
    """Pre-flight status: workspace connectivity, feature availability, system table access."""
    if _preflight is None:
        return {"ready": False, "running": False, "checks": [], "user": None, "warehouse_id": None}
    return _preflight.get_status()


@router.get("/api/config")
def get_config():
    """Return current Lattice configuration (from lattice_config.json + env overrides)."""
    from server.config import load_app_config, CONFIG_PATH
    cfg = load_app_config()
    cat_val = os.environ.get("LATTICE_CATALOGS", "")
    current_catalogs = cfg.get("catalogs") or [c.strip() for c in cat_val.split(",") if c.strip()]
    return {
        "version": cfg.get("version", 1),
        "catalogs": current_catalogs,
        "schema_limit": cfg.get("schema_limit", int(os.environ.get("LATTICE_SCHEMA_LIMIT", "20"))),
        "table_limit": cfg.get("table_limit", int(os.environ.get("LATTICE_TABLE_LIMIT", "50"))),
        "warehouse_id": cfg.get("warehouse_id", os.environ.get("DATABRICKS_WAREHOUSE_ID", "")),
        "is_first_run": not os.path.exists(CONFIG_PATH),
    }


class ConfigBody(BaseModel):
    catalogs: list[str] | None = None
    schema_limit: int | None = None
    table_limit: int | None = None
    warehouse_id: str | None = None


@router.post("/api/config")
async def save_config(body: ConfigBody):
    """Save configuration. Re-triggers ingestion if scope-affecting params changed."""
    import asyncio
    from server.config import save_app_config, CONFIG_PATH

    updates: dict = {}
    scope_changed = False

    if body.catalogs is not None:
        for cat in body.catalogs:
            if cat and not _CATALOG_NAME_RE.match(cat):
                raise HTTPException(status_code=400, detail=f"Invalid catalog name: {cat!r}")
        cat_val = ",".join(body.catalogs)
        if cat_val != os.environ.get("LATTICE_CATALOGS", ""):
            os.environ["LATTICE_CATALOGS"] = cat_val
            scope_changed = True
        updates["catalogs"] = body.catalogs

    if body.schema_limit is not None:
        limit = max(1, min(body.schema_limit, 500))
        if str(limit) != os.environ.get("LATTICE_SCHEMA_LIMIT", "20"):
            os.environ["LATTICE_SCHEMA_LIMIT"] = str(limit)
            scope_changed = True
        updates["schema_limit"] = limit

    if body.table_limit is not None:
        limit = max(1, min(body.table_limit, 1000))
        if str(limit) != os.environ.get("LATTICE_TABLE_LIMIT", "50"):
            os.environ["LATTICE_TABLE_LIMIT"] = str(limit)
            scope_changed = True
        updates["table_limit"] = limit

    if body.warehouse_id is not None:
        os.environ["DATABRICKS_WAREHOUSE_ID"] = body.warehouse_id
        updates["warehouse_id"] = body.warehouse_id
        # Update preflight checker with new warehouse ID
        if _preflight is not None:
            _preflight.warehouse_id = body.warehouse_id

    saved = save_app_config(updates)

    if scope_changed:
        gen = next_ingestion_gen()
        _graph_data.clear()
        _graph_data.update({"nodes": [], "edges": [], "stats": {}})
        _progress.update({"step": "Applying new settings...", "pct": 0, "done": False, "error": False, "graph_ready": False})
        from app import _run_ingestion_async
        asyncio.ensure_future(_run_ingestion_async(gen))

    return {"saved": saved, "re_ingesting": scope_changed}


@router.get("/api/progress")
def get_progress():
    # Don't leak raw exception messages to the client
    step = _progress["step"]
    if _progress.get("error") and step.startswith("Error:"):
        step = "Ingestion failed. Check server logs for details."
    return {
        "step": step,
        "pct": _progress["pct"],
        "done": _progress["done"],
        "error": _progress["error"],
        "graph_ready": _progress["graph_ready"],
    }


@router.get("/api/graph")
def get_graph():
    return {
        "nodes": _graph_data["nodes"],
        "edges": _graph_data["edges"],
        "stats": _graph_data["stats"],
    }


@router.get("/api/nodes/{node_id:path}/descendants")
def get_descendants(node_id: str):
    """Return flat list of FQNs for all nodes reachable via 'contains' edges."""
    g = _graph_data.get("_graph")
    if g is None:
        return {"descendants": []}
    if node_id not in g:
        raise HTTPException(status_code=404, detail="Node not found")
    if _annotation_store is None:
        # Fallback: compute without store
        import networkx as nx
        node_by_id = {n["id"]: n for n in _graph_data["nodes"]}
        fqns = []
        for desc_id in nx.descendants(g, node_id):
            fqn = node_by_id.get(desc_id, {}).get("fqn", "")
            if fqn:
                fqns.append(fqn)
        return {"descendants": fqns}
    return {"descendants": _annotation_store.get_descendants_fqns(node_id, g)}


@router.get("/api/nodes/{node_id:path}")
def get_node(node_id: str):
    node = next((n for n in _graph_data["nodes"] if n["id"] == node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    connected = [e for e in _graph_data["edges"] if e["source"] == node_id or e["target"] == node_id]
    fqn = str(node.get("fqn", "")).lower()
    col_lineage = _column_lineage.get(fqn, [])
    return {"node": node, "edges": connected, "column_lineage": col_lineage}


@router.get("/api/health")
def get_health():
    """Workspace health summary: orphaned tables (cold + unqueried) and unowned assets."""
    orphaned = []
    unowned = []
    enrichment_available = any(n.get("heat") for n in _graph_data["nodes"])
    for node in _graph_data["nodes"]:
        ntype = node.get("type", "")
        if ntype in ("Table", "View"):
            if node.get("heat") == "cold" and (node.get("query_count_30d") or 0) == 0:
                orphaned.append({"id": node["id"], "name": node.get("name", ""), "fqn": node.get("fqn", ""), "type": ntype})
        # Unowned = active Tables/Views (hot or warm) with no owner set.
        # Cold/unqueried tables without owners are already captured in orphaned.
        # Warehouses, schemas, catalogs, etc. rarely have owners set — not actionable.
        if ntype in ("Table", "View") and node.get("heat") in ("hot", "warm") and not node.get("owner"):
            unowned.append({"id": node["id"], "name": node.get("name", ""), "fqn": node.get("fqn", ""), "type": ntype})
    return {
        "orphaned_count": len(orphaned),
        "unowned_count": len(unowned),
        "orphaned": orphaned,
        "unowned": unowned,
        "enrichment_available": enrichment_available,
    }


@router.get("/api/impact")
def get_impact(node_id: str = Query(..., max_length=1000)):
    """
    Return impact analysis for a node:
    - 'contains': nodes reachable via outgoing edges (e.g. Schema → Tables within it)
    - 'consumers': nodes that point TO this node (e.g. Dashboards that query a Table)
    """
    g = _graph_data.get("_graph")
    if g is None:
        return {"contains": [], "consumers": [], "total": 0, "graph_available": False}
    if node_id not in g:
        raise HTTPException(status_code=404, detail="Node not found")
    import networkx as nx
    node_by_id = {n["id"]: n for n in _graph_data["nodes"]}

    def _serialize(nid: str) -> dict | None:
        n = node_by_id.get(nid)
        if not n:
            return None
        return {"id": n["id"], "name": n.get("name", ""), "type": n.get("type", ""), "fqn": n.get("fqn", "")}

    # Descendants: things contained within / fed by this node (follow outgoing edges)
    contains = sorted(
        [s for nid in nx.descendants(g, node_id) if (s := _serialize(nid))],
        key=lambda x: x["type"]
    )
    # Ancestors: things that consume/use/query this node (follow incoming edges)
    consumers = sorted(
        [s for nid in nx.ancestors(g, node_id) if (s := _serialize(nid))],
        key=lambda x: x["type"]
    )
    return {
        "contains": contains,
        "consumers": consumers,
        "total": len(contains) + len(consumers),
        "graph_available": True,
    }


@router.get("/api/search")
def search(q: str = Query("", max_length=500), type: str = Query("", max_length=100)):
    q_lower = q.lower()
    results = []
    for node in _graph_data["nodes"]:
        if type and node.get("type", "") != type:
            continue
        searchable = " ".join([
            node.get("name", ""),
            node.get("fqn", ""),
            node.get("comment", ""),
            node.get("owner", ""),
        ]).lower()
        if not q_lower or q_lower in searchable:
            results.append(node)
    return {"results": results, "count": len(results)}


@router.get("/api/export")
def export_graph():
    annotations = _annotation_store.get_all() if (_annotation_store and _annotation_store.available) else {}
    nodes_out = []
    for node in _graph_data["nodes"]:
        n = dict(node)
        fqn = n.get("fqn", "")
        ann = annotations.get(fqn)
        if ann:
            n["annotations"] = {"tags": ann["tags"], "note": ann["note"]}
        nodes_out.append(n)
    payload = json.dumps({
        "nodes": nodes_out,
        "edges": _graph_data["edges"],
        "stats": _graph_data["stats"],
    }, indent=2)
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=lattice_graph.json"},
    )


@router.get("/api/export/jsonld")
def export_jsonld():
    """Export graph as JSON-LD for AI agents and knowledge graph consumers."""
    annotations = _annotation_store.get_all() if (_annotation_store and _annotation_store.available) else {}
    context = {
        "@vocab": "https://databricks.com/lattice/",
        "name": "https://schema.org/name",
        "owner": "https://databricks.com/lattice/owner",
        "fqn": "https://databricks.com/lattice/fqn",
        "description": "https://schema.org/description",
        "lattice": "https://lattice.databricks.tools/ontology/",
        "lattice:tags": {"@container": "@set"},
        "lattice:note": "xsd:string",
    }
    graph = []
    for node in _graph_data["nodes"]:
        entry: dict = {
            "@id": f"urn:lattice:{node['id']}",
            "@type": node.get("type", "Unknown"),
            "name": node.get("name", ""),
        }
        if node.get("fqn"):
            entry["fqn"] = node["fqn"]
        if node.get("owner"):
            entry["owner"] = node["owner"]
        if node.get("comment"):
            entry["description"] = node["comment"]
        ann = annotations.get(node.get("fqn", ""))
        if ann and ann.get("tags"):
            entry["lattice:tags"] = ann["tags"]
        if ann and ann.get("note"):
            entry["lattice:note"] = ann["note"]
        graph.append(entry)
    for edge in _graph_data["edges"]:
        graph.append({
            "@type": "Relationship",
            "subject": f"urn:lattice:{edge['source']}",
            "predicate": edge.get("relationship", "relatedTo"),
            "object": f"urn:lattice:{edge['target']}",
        })
    payload = json.dumps({"@context": context, "@graph": graph}, indent=2)
    return Response(
        content=payload,
        media_type="application/ld+json",
        headers={"Content-Disposition": "attachment; filename=lattice_graph.jsonld"},
    )


# ------------------------------------------------------------------ #
#  Annotation endpoints                                                #
# ------------------------------------------------------------------ #

class AnnotationUpsertBody(BaseModel):
    tags: list[str] = []
    note: str = ""

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError("Cannot assign more than 20 tags per node")
        return v

    @field_validator("note")
    @classmethod
    def validate_note(cls, v):
        if len(v) > 2000:
            raise ValueError("Note exceeds 2000 character limit")
        return v


class AnnotationBulkBody(BaseModel):
    fqns: list[str]
    tags: list[str] = []
    note: str = ""

    @field_validator("fqns")
    @classmethod
    def validate_fqns(cls, v):
        if not v:
            raise ValueError("fqns list cannot be empty")
        if len(v) > 5000:
            raise ValueError("Cannot bulk tag more than 5000 nodes at once")
        return v


@router.get("/api/annotations")
def get_annotations():
    """Return all annotations, tag config, and full tag vocabulary."""
    if _annotation_store is None or not _annotation_store.available:
        err = getattr(_annotation_store, "_init_error", None) if _annotation_store else "Store not initialized"
        return {
            "available": False,
            "error": err or "Annotation store unavailable — SQL warehouse required",
            "annotations": {},
            "all_tags": [],
            "tag_config": {},
        }
    return {
        "available": True,
        "annotations": _annotation_store.get_all(),
        "all_tags": _annotation_store.get_all_tags(),
        "tag_config": _annotation_store.get_tag_config(),
    }


@router.post("/api/annotations/bulk")
def bulk_annotate(body: AnnotationBulkBody):
    """Apply the same tags+note to multiple nodes (merge, not replace)."""
    if _annotation_store is None or not _annotation_store.available:
        raise HTTPException(status_code=503, detail="Annotation store unavailable")
    try:
        affected = _annotation_store.bulk_upsert(body.fqns, body.tags, body.note)
        # Re-merge into graph so in-memory state stays consistent
        g = _graph_data.get("_graph")
        if g is not None:
            _annotation_store.merge_into_graph(g)
        return {"affected": affected}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/api/annotations/{fqn:path}")
def upsert_annotation(fqn: str, body: AnnotationUpsertBody):
    """Create or update annotation for a node. Empty tags+note deletes the annotation."""
    if _annotation_store is None or not _annotation_store.available:
        raise HTTPException(status_code=503, detail="Annotation store unavailable")
    try:
        result = _annotation_store.upsert(fqn, body.tags, body.note)
        g = _graph_data.get("_graph")
        if g is not None:
            _annotation_store.merge_into_graph(g)
        if result is None:
            return Response(status_code=204)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/api/annotations/{fqn:path}")
def delete_annotation(fqn: str):
    """Delete annotation for a node."""
    if _annotation_store is None or not _annotation_store.available:
        raise HTTPException(status_code=503, detail="Annotation store unavailable")
    try:
        existed = _annotation_store.delete(fqn)
        if not existed:
            raise HTTPException(status_code=404, detail="Annotation not found")
        g = _graph_data.get("_graph")
        if g is not None:
            _annotation_store.merge_into_graph(g)
        return Response(status_code=204)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/api/refresh")
async def refresh_graph():
    _check_cooldown("refresh")
    import os
    from server.config import get_workspace_client
    from server.connectors import unity_catalog, compute, jobs, dashboards, apps as apps_connector
    from server.connectors.federation import fetch_connections, fetch_shares, fetch_recipients
    from server.connectors.system_tables import fetch_enrichment, fetch_lineage
    from server.graph.builder import build_graph

    cat_val = os.environ.get("LATTICE_CATALOGS", "")
    cat_filter = [c.strip() for c in cat_val.split(",") if c.strip()] or None
    model_limit_raw = os.environ.get("LATTICE_MODEL_LIMIT", "200")
    limits = {
        "catalog_filter": cat_filter,
        "catalog_limit": None if cat_filter else int(os.environ.get("LATTICE_CATALOG_LIMIT", "20")),
        "schema_limit": int(os.environ.get("LATTICE_SCHEMA_LIMIT", "20")) or None,
        "table_limit": int(os.environ.get("LATTICE_TABLE_LIMIT", "50")) or None,
        "model_limit": int(model_limit_raw) if model_limit_raw.strip() else 200,
    }

    import concurrent.futures
    w = get_workspace_client()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        f_uc = ex.submit(unity_catalog.fetch_all, w, **limits)
        f_wh = ex.submit(compute.fetch_warehouses, w)
        f_cl = ex.submit(compute.fetch_clusters, w)
        f_jb = ex.submit(jobs.fetch_jobs, w)
        f_db = ex.submit(dashboards.fetch_dashboards, w)
        f_ap = ex.submit(apps_connector.fetch_apps, w)
        f_lb = ex.submit(apps_connector.fetch_databases, w)
        f_cn = ex.submit(fetch_connections, w)
        f_sh = ex.submit(fetch_shares, w)
        f_rc = ex.submit(fetch_recipients, w)

        uc_data    = f_uc.result()
        wh         = f_wh.result()
        cl         = f_cl.result()
        jb         = f_jb.result()
        db         = f_db.result()
        ap         = f_ap.result()
        lakebase   = f_lb.result()
        conns      = f_cn.result()
        shares     = f_sh.result()
        recipients = f_rc.result()

    # System table enrichment — use first available running warehouse
    enrichment = None
    warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
    if not warehouse_id and wh:
        # Pick first running warehouse
        running = [x for x in wh if x.get("state", "").upper() in ("RUNNING", "IDLE")]
        warehouse_id = (running[0] if running else wh[0])["fqn"]
    if warehouse_id:
        try:
            print(f"[refresh] fetching system table enrichment via warehouse {warehouse_id}")
            enrichment = fetch_enrichment(w, warehouse_id)
        except Exception as e:
            print(f"[refresh] enrichment skipped: {e}")

    lineage = None
    if warehouse_id:
        try:
            print(f"[refresh] fetching lineage via warehouse {warehouse_id}")
            lineage = fetch_lineage(w, warehouse_id)
        except Exception as e:
            print(f"[refresh] lineage skipped: {e}")

    data = build_graph(uc_data, wh, cl, jb, db, apps=ap, databases=lakebase,
                       enrichment=enrichment, lineage=lineage,
                       connections=conns, shares=shares, recipients=recipients)
    set_graph(data, host=w.config.host or "")
    return {"status": "ok", "stats": data["stats"]}
