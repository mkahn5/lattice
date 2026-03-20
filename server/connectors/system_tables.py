from __future__ import annotations

from datetime import datetime, timezone
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState, Disposition


def _run_sql(w: WorkspaceClient, warehouse_id: str, sql: str, label: str = "") -> list[dict]:
    """Execute SQL via warehouse and return rows as list of dicts. Silently returns [] on any error."""
    try:
        resp = w.statement_execution.execute_statement(
            warehouse_id=warehouse_id,
            statement=sql,
            wait_timeout="50s",
            disposition=Disposition.INLINE,
        )
        if resp.status.state != StatementState.SUCCEEDED:
            print(f"[system_tables:{label}] statement state={resp.status.state}")
            return []
        if not resp.result or not resp.result.data_array:
            return []
        cols = [c.name for c in resp.manifest.schema.columns]
        return [dict(zip(cols, row)) for row in resp.result.data_array]
    except Exception as e:
        print(f"[system_tables:{label}] error: {e}")
        return []


def _days_ago(ts_str: str) -> int | None:
    """Return how many days ago a timestamp string was. None if unparseable."""
    if not ts_str:
        return None
    try:
        ts = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - ts
        return max(0, delta.days)
    except Exception:
        return None


def _table_heat(last_accessed: str) -> str:
    days = _days_ago(last_accessed)
    if days is None:
        return "cold"
    if days <= 7:
        return "hot"
    if days <= 30:
        return "warm"
    return "cold"


def fetch_enrichment(w: WorkspaceClient, warehouse_id: str) -> dict:
    """
    Query system tables and return usage enrichment data.

    Returns a dict:
        {
            "warehouse_dbu": {warehouse_id: {"total_dbu_30d": float}},
            "cluster_dbu": {cluster_id: {"total_dbu_30d": float}},
            "job_dbu": {job_id: {"total_dbu_30d": float}},
            "job_runs": {job_id: {"total_runs_30d": int, "success_runs_30d": int, "last_run": str}},
            "table_access": {full_name_lower: {"last_accessed": str, "query_count_30d": int}},
        }
    """
    enrichment: dict = {
        "warehouse_dbu": {},
        "cluster_dbu": {},
        "job_dbu": {},
        "job_runs": {},
        "table_access": {},
        "table_storage": {},
        "table_tags": {},
        "serverless_dbu": 0.0,
    }

    # --- Warehouse DBU (30d) ---
    for r in _run_sql(w, warehouse_id, """
        SELECT
            usage_metadata.warehouse_id AS wid,
            ROUND(SUM(usage_quantity), 1) AS dbu_30d
        FROM system.billing.usage
        WHERE usage_start_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND usage_metadata.warehouse_id IS NOT NULL
        GROUP BY 1
    """, "warehouse_dbu"):
        if r.get("wid"):
            enrichment["warehouse_dbu"][r["wid"]] = {"total_dbu_30d": float(r.get("dbu_30d") or 0)}

    # --- Cluster DBU (30d) ---
    for r in _run_sql(w, warehouse_id, """
        SELECT
            usage_metadata.cluster_id AS cid,
            ROUND(SUM(usage_quantity), 1) AS dbu_30d
        FROM system.billing.usage
        WHERE usage_start_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND usage_metadata.cluster_id IS NOT NULL
        GROUP BY 1
    """, "cluster_dbu"):
        if r.get("cid"):
            enrichment["cluster_dbu"][r["cid"]] = {"total_dbu_30d": float(r.get("dbu_30d") or 0)}

    # --- Job DBU (30d) ---
    for r in _run_sql(w, warehouse_id, """
        SELECT
            CAST(usage_metadata.job_id AS STRING) AS jid,
            ROUND(SUM(usage_quantity), 1) AS dbu_30d
        FROM system.billing.usage
        WHERE usage_start_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND usage_metadata.job_id IS NOT NULL
        GROUP BY 1
    """, "job_dbu"):
        if r.get("jid"):
            enrichment["job_dbu"][r["jid"]] = {"total_dbu_30d": float(r.get("dbu_30d") or 0)}

    # --- Job run stats (30d) ---
    for r in _run_sql(w, warehouse_id, """
        SELECT
            CAST(job_id AS STRING) AS job_id,
            COUNT(*) AS total_runs,
            SUM(CASE WHEN result_state = 'SUCCEEDED' THEN 1 ELSE 0 END) AS success_runs,
            MAX(period_start_time) AS last_run
        FROM system.lakeflow.job_run_timeline
        WHERE period_start_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND run_type = 'JOB_RUN'
        GROUP BY 1
    """, "job_runs"):
        jid = r.get("job_id")
        if jid:
            enrichment["job_runs"][jid] = {
                "total_runs_30d": int(r.get("total_runs") or 0),
                "success_runs_30d": int(r.get("success_runs") or 0),
                "last_run": str(r.get("last_run") or ""),
            }

    # --- Serverless aggregate DBU (30d) ---
    rows = _run_sql(w, warehouse_id, """
        SELECT ROUND(SUM(usage_quantity), 1) AS dbu_30d
        FROM system.billing.usage
        WHERE usage_start_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND sku_name ILIKE '%SERVERLESS%'
    """, "serverless_dbu")
    if rows:
        enrichment["serverless_dbu"] = float(rows[0].get("dbu_30d") or 0)

    # --- Table storage stats ---
    for r in _run_sql(w, warehouse_id, """
        SELECT
            LOWER(CONCAT_WS('.', table_catalog, table_schema, table_name)) AS full_name,
            num_rows,
            ROUND(total_size / 1048576.0, 1) AS size_mb
        FROM system.information_schema.table_storage_utilization
        WHERE num_rows IS NOT NULL
          AND total_size IS NOT NULL
        LIMIT 20000
    """, "table_storage"):
        fn = r.get("full_name")
        if fn:
            enrichment["table_storage"][fn] = {
                "num_rows": int(r.get("num_rows") or 0),
                "size_mb": float(r.get("size_mb") or 0),
            }

    # --- Table access via query history (30d) ---
    # accessed_tables is ARRAY<STRUCT<catalog_name, schema_name, name>>
    for r in _run_sql(w, warehouse_id, """
        SELECT
            LOWER(CONCAT_WS('.', t.catalog_name, t.schema_name, t.name)) AS full_name,
            MAX(q.execution_start_time) AS last_queried,
            COUNT(DISTINCT q.statement_id) AS query_count_30d
        FROM system.query.history q
        LATERAL VIEW EXPLODE(accessed_tables) t_table AS t
        WHERE q.execution_start_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND q.status = 'FINISHED'
          AND q.accessed_tables IS NOT NULL
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 5000
    """, "table_access"):
        fn = r.get("full_name")
        if fn:
            enrichment["table_access"][fn] = {
                "last_queried": str(r.get("last_queried") or ""),
                "query_count_30d": int(r.get("query_count_30d") or 0),
            }

    # --- UC tags (user + system) ---
    for r in _run_sql(w, warehouse_id, """
        SELECT
            LOWER(CONCAT_WS('.', catalog_name, schema_name, table_name)) AS full_name,
            tag_name,
            tag_value
        FROM system.information_schema.table_tags
        LIMIT 20000
    """, "table_tags"):
        fn = r.get("full_name")
        if fn:
            enrichment["table_tags"].setdefault(fn, []).append({
                "key": r.get("tag_name") or "",
                "value": r.get("tag_value") or "",
            })
    tag_count = sum(len(v) for v in enrichment["table_tags"].values())
    if tag_count:
        print(f"[system_tables] {tag_count} tags across {len(enrichment['table_tags'])} tables")

    return enrichment


def fetch_column_lineage(w: WorkspaceClient, warehouse_id: str) -> dict:
    """
    Query system.access.column_lineage for column-level provenance (30-day window).

    Returns dict keyed by target table FQN (lowercase):
        {"catalog.schema.table": [{"target_col": str, "source_table": str, "source_col": str}, ...]}
    """
    result: dict[str, list[dict]] = {}
    for r in _run_sql(w, warehouse_id, """
        SELECT DISTINCT
            LOWER(target_table_full_name) AS tgt_table,
            target_column_name           AS tgt_col,
            LOWER(source_table_full_name) AS src_table,
            source_column_name           AS src_col
        FROM system.access.column_lineage
        WHERE event_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND target_table_full_name IS NOT NULL
          AND source_table_full_name IS NOT NULL
          AND target_table_full_name != source_table_full_name
        LIMIT 10000
    """, "column_lineage"):
        tgt = r.get("tgt_table", "")
        if not tgt:
            continue
        result.setdefault(tgt, []).append({
            "target_col": r.get("tgt_col") or "",
            "source_table": r.get("src_table") or "",
            "source_col": r.get("src_col") or "",
        })
    total_edges = sum(len(v) for v in result.values())
    print(f"[column_lineage] {total_edges} column edges across {len(result)} tables")
    return result


def fetch_lineage(w: WorkspaceClient, warehouse_id: str) -> list[dict]:
    """
    Query system.access.table_lineage for data movement edges (30-day window).

    Returns a list of edge dicts:
        {"edge_type": "feedsInto"|"writesTo"|"readsFrom",
         "source_fqn": str,  "target_fqn": str}

    Query row limit is configurable via LATTICE_LINEAGE_QUERY_LIMIT (default 10000).
    """
    import os
    query_limit = int(os.environ.get("LATTICE_LINEAGE_QUERY_LIMIT", "10000"))
    rows: list[dict] = []
    seen: set[tuple] = set()

    def _add(edge_type: str, src: str, tgt: str) -> None:
        key = (edge_type, src, tgt)
        if key not in seen and src and tgt:
            seen.add(key)
            rows.append({"edge_type": edge_type, "source_fqn": src, "target_fqn": tgt})

    # Table → Table lineage
    for r in _run_sql(w, warehouse_id, f"""
        SELECT DISTINCT
            LOWER(source_table_full_name) AS src,
            LOWER(target_table_full_name) AS tgt
        FROM system.access.table_lineage
        WHERE event_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND source_table_full_name IS NOT NULL
          AND target_table_full_name IS NOT NULL
          AND source_table_full_name != target_table_full_name
        LIMIT {query_limit}
    """, "lineage_table"):
        _add("feedsInto", r.get("src", ""), r.get("tgt", ""))

    # Job → Table: writesTo (job → target) and readsFrom (job → source)
    for r in _run_sql(w, warehouse_id, f"""
        SELECT DISTINCT
            CAST(entity_id AS STRING)          AS job_id,
            LOWER(source_table_full_name)       AS src_table,
            LOWER(target_table_full_name)       AS tgt_table
        FROM system.access.table_lineage
        WHERE event_time >= CURRENT_DATE - INTERVAL 30 DAYS
          AND entity_type = 'JOB'
          AND entity_id IS NOT NULL
        LIMIT {query_limit}
    """, "lineage_job"):
        job_id  = r.get("job_id", "")
        src_tbl = r.get("src_table", "")
        tgt_tbl = r.get("tgt_table", "")
        if job_id and tgt_tbl:
            _add("writesTo",  job_id, tgt_tbl)
        if job_id and src_tbl:
            _add("readsFrom", job_id, src_tbl)

    print(f"[lineage] {len(rows)} edges fetched")
    return rows


def apply_enrichment(nodes: list[dict], enrichment: dict) -> list[dict]:
    """Merge enrichment data into node dicts in-place. Returns nodes."""
    wh_dbu = enrichment.get("warehouse_dbu", {})
    cl_dbu = enrichment.get("cluster_dbu", {})
    job_dbu = enrichment.get("job_dbu", {})
    job_runs = enrichment.get("job_runs", {})
    table_acc = enrichment.get("table_access", {})
    table_storage = enrichment.get("table_storage", {})
    table_tags = enrichment.get("table_tags", {})
    serverless_dbu = enrichment.get("serverless_dbu", 0.0)

    for node in nodes:
        ntype = node.get("type", "")
        fqn = str(node.get("fqn", ""))

        if ntype in ("Table", "View", "StreamingTable", "MaterializedView"):
            acc = table_acc.get(fqn.lower())
            if acc:
                node["last_queried"] = acc["last_queried"]
                node["query_count_30d"] = acc["query_count_30d"]
                days = _days_ago(acc["last_queried"])
                node["days_since_query"] = days
                node["heat"] = _table_heat(acc["last_queried"])
            else:
                node["heat"] = "cold"
            storage = table_storage.get(fqn.lower())
            if storage:
                node["num_rows"] = storage["num_rows"]
                node["size_mb"] = storage["size_mb"]
            tags = table_tags.get(fqn.lower())
            if tags:
                node["uc_tags"] = tags

        elif ntype == "Warehouse":
            dbu = wh_dbu.get(fqn)
            if dbu:
                node["dbu_30d"] = dbu["total_dbu_30d"]
                node["heat"] = "hot" if dbu["total_dbu_30d"] > 0 else "cold"

        elif ntype == "Serverless":
            if fqn == "serverless":
                # Pool node — aggregate of all serverless SKU billing
                if serverless_dbu > 0:
                    node["dbu_30d"] = serverless_dbu
                    node["heat"] = "hot"
            else:
                # Actual serverless SQL warehouse — keyed by warehouse ID in billing
                dbu = wh_dbu.get(fqn)
                if dbu:
                    node["dbu_30d"] = dbu["total_dbu_30d"]
                    node["heat"] = "hot" if dbu["total_dbu_30d"] > 0 else "cold"

        elif ntype == "Cluster":
            dbu = cl_dbu.get(fqn)
            if dbu:
                node["dbu_30d"] = dbu["total_dbu_30d"]
                node["heat"] = "hot" if dbu["total_dbu_30d"] > 0 else "cold"

        elif ntype == "Job":
            runs = job_runs.get(fqn)
            dbu = job_dbu.get(fqn)
            if runs:
                node["total_runs_30d"] = runs["total_runs_30d"]
                node["success_runs_30d"] = runs["success_runs_30d"]
                node["last_run"] = runs["last_run"]
                total = runs["total_runs_30d"]
                succ = runs["success_runs_30d"]
                rate = round(succ / total * 100, 1) if total > 0 else 0.0
                node["success_rate_pct"] = rate
                node["heat"] = "hot" if rate >= 80 else ("warm" if rate >= 50 else "cold")
            if dbu:
                node["dbu_30d"] = dbu["total_dbu_30d"]

    return nodes
