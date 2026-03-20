"""
Lineage-driven backfill: fetch jobs and tables that appear in lineage
but weren't captured by the primary ingestion (due to limits).

This ensures every lineage edge has both endpoints in the graph.

Limits are configurable via environment variables:
  LATTICE_LINEAGE_BACKFILL_JOBS   — max jobs to backfill (default 500)
  LATTICE_LINEAGE_BACKFILL_TABLES — max tables to backfill (default 2000)
"""
from __future__ import annotations

import os
import concurrent.futures
from databricks.sdk import WorkspaceClient


def backfill_from_lineage(
    w: WorkspaceClient,
    lineage: list[dict],
    existing_jobs: list[dict],
    existing_tables: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Given lineage edges and already-ingested jobs/tables, fetch any missing
    jobs and tables so lineage edges can be wired up.

    Returns (new_jobs, new_tables) to append to the existing lists.
    """
    if not lineage:
        return [], []

    # Collect all job IDs and table FQNs referenced in lineage
    lineage_job_ids: set[str] = set()
    lineage_table_fqns: set[str] = set()

    for edge in lineage:
        etype = edge.get("edge_type", "")
        src = edge.get("source_fqn", "")
        tgt = edge.get("target_fqn", "")

        if etype == "writesTo":
            # src = job_id, tgt = table fqn
            lineage_job_ids.add(src)
            if tgt:
                lineage_table_fqns.add(tgt)
        elif etype == "readsFrom":
            # src = job_id, tgt = table fqn
            lineage_job_ids.add(src)
            if tgt:
                lineage_table_fqns.add(tgt)
        elif etype == "feedsInto":
            # src = table fqn, tgt = table fqn
            if src:
                lineage_table_fqns.add(src)
            if tgt:
                lineage_table_fqns.add(tgt)

    # Determine what's missing
    existing_job_fqns = {j["fqn"] for j in existing_jobs}
    existing_table_fqns = {t["fqn"].lower() for t in existing_tables}

    missing_job_ids = lineage_job_ids - existing_job_fqns
    missing_table_fqns = lineage_table_fqns - existing_table_fqns

    # Filter out empty strings
    missing_job_ids.discard("")
    missing_table_fqns.discard("")

    if not missing_job_ids and not missing_table_fqns:
        return [], []

    print(f"[lineage_backfill] {len(missing_job_ids)} missing jobs, "
          f"{len(missing_table_fqns)} missing tables to backfill")

    new_jobs: list[dict] = []
    new_tables: list[dict] = []

    # Backfill jobs in parallel
    def _fetch_job(job_id: str) -> dict | None:
        try:
            j = w.jobs.get(int(job_id))
            settings = j.settings
            cluster_ids: list[str] = []
            serverless_tasks = 0
            if settings and settings.tasks:
                for task in settings.tasks:
                    cid = getattr(task, "existing_cluster_id", None)
                    jck = getattr(task, "job_cluster_key", None)
                    if cid:
                        cluster_ids.append(str(cid))
                    elif not jck:
                        serverless_tasks += 1
            total_tasks = len(settings.tasks) if settings and settings.tasks else 0
            return {
                "id": f"job:{j.job_id}",
                "type": "Job",
                "name": settings.name if settings else str(j.job_id),
                "fqn": str(j.job_id),
                "creator_user_name": j.creator_user_name or "",
                "created_time": str(j.created_time) if j.created_time else None,
                "task_count": total_tasks,
                "schedule": str(settings.schedule.quartz_cron_expression) if settings and settings.schedule else None,
                "cluster_ids": list(set(cluster_ids)),
                "uses_serverless": serverless_tasks > 0 and len(cluster_ids) == 0,
                "backfilled": True,
            }
        except Exception:
            return None

    # Backfill tables in parallel
    def _fetch_table(fqn: str) -> dict | None:
        try:
            t = w.tables.get(fqn)
            tt = str(t.table_type).upper() if t.table_type else ""
            node_type = (
                "StreamingTable" if "STREAMING_TABLE" in tt else
                "MaterializedView" if "MATERIALIZED_VIEW" in tt else
                "View" if "VIEW" in tt else
                "Table"
            )
            # Resolve view dependencies
            source_tables = []
            if node_type in ("View", "MaterializedView") and t.view_dependencies:
                for dep in (t.view_dependencies.dependencies or []):
                    if dep.table and dep.table.table_full_name:
                        source_tables.append(dep.table.table_full_name)

            parts = fqn.split(".")
            cat_name = parts[0] if len(parts) >= 1 else ""
            sch_name = parts[1] if len(parts) >= 2 else ""
            return {
                "id": f"table:{t.full_name}",
                "type": node_type,
                "name": t.name,
                "fqn": t.full_name or fqn,
                "owner": t.owner or "",
                "comment": t.comment or "",
                "catalog_name": cat_name,
                "schema_name": sch_name,
                "table_type": str(t.table_type) if t.table_type else "",
                "data_source_format": str(t.data_source_format) if t.data_source_format else "",
                "created_at": str(t.created_at) if t.created_at else None,
                "updated_at": str(t.updated_at) if t.updated_at else None,
                "row_count": t.properties.get("spark.sql.statistics.numRows") if t.properties else None,
                "source_tables": source_tables,
                "backfilled": True,
            }
        except Exception:
            return None

    job_limit = int(os.environ.get("LATTICE_LINEAGE_BACKFILL_JOBS", "500"))
    table_limit = int(os.environ.get("LATTICE_LINEAGE_BACKFILL_TABLES", "2000"))

    if len(missing_job_ids) > job_limit:
        print(f"[lineage_backfill] capping jobs: {len(missing_job_ids)} → {job_limit} "
              f"(increase LATTICE_LINEAGE_BACKFILL_JOBS to raise)")
    if len(missing_table_fqns) > table_limit:
        print(f"[lineage_backfill] capping tables: {len(missing_table_fqns)} → {table_limit} "
              f"(increase LATTICE_LINEAGE_BACKFILL_TABLES to raise)")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        # Submit all backfill requests
        job_futs = {ex.submit(_fetch_job, jid): jid for jid in list(missing_job_ids)[:job_limit]}
        table_futs = {ex.submit(_fetch_table, fqn): fqn for fqn in list(missing_table_fqns)[:table_limit]}

        for fut in concurrent.futures.as_completed(job_futs, timeout=90):
            result = fut.result()
            if result:
                new_jobs.append(result)

        for fut in concurrent.futures.as_completed(table_futs, timeout=90):
            result = fut.result()
            if result:
                new_tables.append(result)

    print(f"[lineage_backfill] backfilled {len(new_jobs)} jobs, {len(new_tables)} tables")
    return new_jobs, new_tables
