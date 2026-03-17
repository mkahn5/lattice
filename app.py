import os
import json
import re
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from server.api.routes import router, set_graph, set_progress, set_column_lineage, set_cost_attribution, set_annotation_store, set_preflight, next_ingestion_gen, get_ingestion_gen
from server.config import get_workspace_client, apply_app_config
from server.connectors import unity_catalog, compute, jobs, dashboards
from server.connectors import apps as apps_connector
from server.connectors.federation import fetch_connections, fetch_shares, fetch_recipients
from server.connectors.system_tables import fetch_enrichment, fetch_lineage, fetch_column_lineage
from server.connectors.pipelines import fetch_pipelines
from server.graph.builder import build_graph

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")


def _cache_key() -> str:
    profile = os.environ.get("DATABRICKS_PROFILE", "default")
    catalogs = os.environ.get("LATTICE_CATALOGS", "all")
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", f"{profile}__{catalogs}")
    return os.path.join(CACHE_DIR, f"{safe}.json")


def _load_cache() -> dict | None:
    path = _cache_key()
    try:
        with open(path) as f:
            data = json.load(f)
        print(f"[lattice] Loaded cache: {data.get('stats', {}).get('node_count', 0)} nodes from {path}")
        return data
    except Exception:
        return None


def _save_cache(data: dict):
    os.makedirs(CACHE_DIR, exist_ok=True, mode=0o700)
    path = _cache_key()
    try:
        # Strip the networkx graph object before serialising
        serialisable = {k: v for k, v in data.items() if k != "_graph"}
        with open(path, "w") as f:
            json.dump(serialisable, f)
        os.chmod(path, 0o600)  # owner read/write only — cache contains workspace metadata
        print(f"[lattice] Cache saved: {path}")
    except Exception as e:
        print(f"[lattice] Cache save failed: {e}")


def _uc_limits() -> dict:
    cat_filter_val = os.environ.get("LATTICE_CATALOGS", "")
    cat_filter = [c.strip() for c in cat_filter_val.split(",") if c.strip()] or None
    return {
        "catalog_filter": cat_filter,
        "catalog_limit": None if cat_filter else int(os.environ.get("LATTICE_CATALOG_LIMIT", "20")),
        "schema_limit": int(os.environ.get("LATTICE_SCHEMA_LIMIT", "20")) or None,
        "table_limit": int(os.environ.get("LATTICE_TABLE_LIMIT", "50")) or None,
        "model_limit": int(v) if (v := os.environ.get("LATTICE_MODEL_LIMIT", "200").strip()) else 200,
    }


def _run_ingestion(gen: int):
    """Run ingestion synchronously in a background thread. Aborts if gen is superseded."""

    def _alive() -> bool:
        """Returns False if this ingestion has been superseded by a newer one."""
        return get_ingestion_gen() == gen

    try:
        limits = _uc_limits()
        cat_filter = limits["catalog_filter"]
        cat_desc = str(cat_filter) if cat_filter else f"ALL (limit={limits['catalog_limit']})"
        print(f"[lattice:{gen}] Starting ingestion (catalogs: {cat_desc}, "
              f"schemas/cat: {limits['schema_limit'] or 'all'}, "
              f"tables/schema: {limits['table_limit'] or 'all'})...")

        import concurrent.futures

        # Serve cached graph immediately so canvas is populated on load
        cached = _load_cache()
        if cached:
            set_graph(cached, host=cached.get("host", ""), gen=gen)
            set_progress("Refreshing from workspace...", 3, gen=gen)
        else:
            set_progress("Connecting to workspace...", 5, gen=gen)

        if not _alive(): return
        w = get_workspace_client()

        # Unblock canvas with empty graph if no cache
        if not cached:
            set_graph({"nodes": [], "edges": [], "stats": {"node_count": 0, "edge_count": 0, "node_types": {}}},
                      host=w.config.host or "", gen=gen)

        if not _alive(): return

        # Start UC immediately — it parallelises internally and takes the longest
        uc_pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        f_uc = uc_pool.submit(unity_catalog.fetch_all, w, **limits)

        # Fast connectors in parallel; each has a 45s timeout so a slow API can't block
        set_progress("Ingesting compute, jobs & apps...", 12, gen=gen)
        FAST_TIMEOUT = 45

        def _safe(fut):
            try:
                return fut.result(timeout=FAST_TIMEOUT)
            except Exception:
                return []

        # Submit all fast connectors to a non-blocking pool (shutdown(wait=False) so hung
        # threads don't block the pipeline — _safe() enforces the per-future timeout).
        ex = concurrent.futures.ThreadPoolExecutor(max_workers=8)
        f_wh = ex.submit(compute.fetch_warehouses, w)
        f_cl = ex.submit(compute.fetch_clusters, w)
        f_jb = ex.submit(jobs.fetch_jobs, w)
        f_db = ex.submit(dashboards.fetch_dashboards, w)
        f_ap = ex.submit(apps_connector.fetch_apps, w)
        f_lb = ex.submit(apps_connector.fetch_databases, w)
        f_cn = ex.submit(fetch_connections, w)
        f_sh = ex.submit(fetch_shares, w)
        f_rc = ex.submit(fetch_recipients, w)
        f_pl = ex.submit(fetch_pipelines, w, int(os.environ.get("LATTICE_PIPELINE_LIMIT", "200")))
        wh         = _safe(f_wh)
        cl         = _safe(f_cl)
        jb         = _safe(f_jb)
        db         = _safe(f_db)
        ap         = _safe(f_ap)
        lakebase   = _safe(f_lb) or apps_connector.collect_database_instances(ap or [])
        conns      = _safe(f_cn)
        shares     = _safe(f_sh)
        recipients = _safe(f_rc)
        pl         = _safe(f_pl)
        ex.shutdown(wait=False)  # don't block on hung threads

        if not _alive(): return

        # Publish partial graph with fast data while UC finishes
        set_progress("Compute & jobs ready — loading catalog...", 40, gen=gen)
        empty_uc = {"catalogs": [], "schemas": [], "tables": [], "models": []}
        partial = build_graph(empty_uc, wh, cl, jb, db, apps=ap, databases=lakebase,
                              connections=conns, shares=shares, recipients=recipients,
                              pipelines=pl)
        set_graph(partial, host=w.config.host or "", gen=gen)
        print(f"[lattice:{gen}] Partial graph ready: {partial['stats']['node_count']} nodes")

        if not _alive(): return

        # Wait for UC
        set_progress("Loading Unity Catalog...", 45, gen=gen)
        uc_data = f_uc.result()
        uc_pool.shutdown(wait=False)
        set_progress("Unity Catalog loaded...", 68, gen=gen)

        if not _alive(): return

        # System table enrichment
        enrichment = None
        warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
        if not warehouse_id and wh:
            running = [x for x in wh if x.get("state", "").upper() in ("RUNNING", "IDLE")]
            warehouse_id = (running[0] if running else wh[0])["fqn"]
        if warehouse_id:
            set_progress("Fetching usage data...", 80, gen=gen)
            try:
                print(f"[lattice:{gen}] Fetching system table enrichment via warehouse {warehouse_id}...")
                enrichment = fetch_enrichment(w, warehouse_id)
            except Exception as e:
                print(f"[lattice:{gen}] Enrichment skipped: {e}")

        if not _alive(): return

        lineage = None
        col_lineage = {}
        if warehouse_id:
            set_progress("Fetching lineage...", 88, gen=gen)
            try:
                print(f"[lattice:{gen}] Fetching lineage via warehouse {warehouse_id}...")
                lineage = fetch_lineage(w, warehouse_id)
            except Exception as e:
                print(f"[lattice:{gen}] Lineage skipped: {e}")
            try:
                print(f"[lattice:{gen}] Fetching column lineage via warehouse {warehouse_id}...")
                col_lineage = fetch_column_lineage(w, warehouse_id)
            except Exception as e:
                print(f"[lattice:{gen}] Column lineage skipped: {e}")

        if not _alive(): return

        set_progress("Building graph...", 95, gen=gen)
        data = build_graph(uc_data, wh, cl, jb, db, apps=ap, databases=lakebase,
                           enrichment=enrichment, lineage=lineage,
                           connections=conns, shares=shares, recipients=recipients,
                           pipelines=pl)
        data["host"] = w.config.host or ""
        set_graph(data, host=data["host"], gen=gen)
        set_column_lineage(col_lineage, gen=gen)
        print(f"[lattice:{gen}] Graph built: {data['stats']['node_count']} nodes, {data['stats']['edge_count']} edges")
        _save_cache(data)
        # Cost attribution (runs on already-enriched in-memory graph)
        try:
            from server.graph.cost_enricher import compute_cost_attribution
            cost = compute_cost_attribution(data, gen=gen)
            set_cost_attribution(cost, gen=gen)
            print(f"[lattice:{gen}] Cost attribution: {len(cost.get('nodes', {}))} nodes attributed")
        except Exception as e:
            print(f"[lattice:{gen}] Cost attribution skipped: {e}")

        # Merge annotations into graph so they flow through /api/nodes/{id}
        try:
            from server.api.routes import _annotation_store
            if _annotation_store and _annotation_store.available and data.get("_graph"):
                _annotation_store.merge_into_graph(data["_graph"])
                print(f"[lattice:{gen}] Annotations merged into graph")
        except Exception as e:
            print(f"[lattice:{gen}] Annotation merge skipped: {e}")

        set_progress("Ready", 100, done=True, gen=gen)
    except Exception as e:
        print(f"[lattice:{gen}] Ingestion error: {e}")
        import traceback; traceback.print_exc()
        set_progress(f"Error: {e}", 0, done=True, error=True, gen=gen)


async def _run_ingestion_async(gen: int):
    """Run ingestion in a thread executor. gen is passed through for abort detection."""
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_ingestion, gen)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import threading

    # Apply saved config before ingestion starts (sets LATTICE_CATALOGS etc. from lattice_config.json)
    apply_app_config()

    gen = next_ingestion_gen()
    asyncio.ensure_future(_run_ingestion_async(gen))

    # Initialize annotation store in background (non-blocking)
    warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
    if warehouse_id:
        try:
            from server.graph.annotation_store import AnnotationStore
            from server.config import get_workspace_client as _gwc
            _store = AnnotationStore(
                workspace_client=_gwc(),
                warehouse_id=warehouse_id,
                catalog=os.environ.get("LATTICE_ANNOTATIONS_CATALOG", "lattice"),
                schema=os.environ.get("LATTICE_ANNOTATIONS_SCHEMA", "metadata"),
            )
            set_annotation_store(_store)
            threading.Thread(target=_store.initialize, daemon=True).start()
        except Exception as e:
            print(f"[annotations] Could not start annotation store: {e}")
    else:
        print("[annotations] DATABRICKS_WAREHOUSE_ID not set — annotations unavailable until warehouse is configured")

    # Run pre-flight checks in background (non-blocking — canvas loads while checks run)
    try:
        from server.preflight import PreflightChecker
        from server.config import get_workspace_client as _gwc2
        _checker = PreflightChecker(
            workspace_client=_gwc2(),
            warehouse_id=os.environ.get("DATABRICKS_WAREHOUSE_ID", ""),
        )
        set_preflight(_checker)
        threading.Thread(target=_checker.run, daemon=True).start()
        print("[preflight] Running checks in background...")
    except Exception as e:
        print(f"[preflight] Could not start pre-flight checks: {e}")

    yield


app = FastAPI(title="Lattice", lifespan=lifespan)

# CORS: only allow same-origin and the local dev port.
# When running as a Databricks App, all traffic is same-origin anyway.
from fastapi.middleware.cors import CORSMiddleware
_allowed_origins = ["http://localhost:8000", "http://localhost:5173"]
_extra = os.environ.get("LATTICE_ALLOWED_ORIGINS", "")
if _extra:
    _allowed_origins += [o.strip() for o in _extra.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(router)

# Serve React frontend (built output)
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(os.path.join(frontend_dist, "index.html"))
