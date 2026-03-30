"""Helper to build a rich detail dict for offender items."""


def _table_detail(t: dict) -> dict:
    """Extract common detail fields from a table node for offender display."""
    return {
        "owner": t.get("owner", ""),
        "created_at": t.get("created_at", ""),
        "updated_at": t.get("updated_at", ""),
        "last_queried": t.get("last_queried", ""),
        "query_count_30d": t.get("query_count_30d", 0),
        "heat": t.get("heat", ""),
        "comment": (t.get("comment") or "")[:100],
        "catalog_name": t.get("catalog_name", ""),
        "schema_name": t.get("schema_name", ""),
        "table_type": t.get("table_type", ""),
        "num_rows": t.get("num_rows"),
        "size_mb": t.get("size_mb"),
    }


def _job_detail(j: dict) -> dict:
    """Extract common detail fields from a job node for offender display."""
    return {
        "creator_user_name": j.get("creator_user_name", ""),
        "created_time": j.get("created_time", ""),
        "task_count": j.get("task_count", 0),
        "schedule": j.get("schedule", ""),
    }
