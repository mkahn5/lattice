from databricks.sdk import WorkspaceClient


def _extract_resources(app_detail) -> dict:
    """Extract warehouse_ids, job_ids, database_instance_names, and uc_catalog_names from app resources."""
    warehouse_ids: list[str] = []
    job_ids: list[str] = []
    database_instance_names: list[str] = []
    uc_catalog_names: set[str] = set()
    try:
        for res in (app_detail.resources or []):
            if getattr(res, "sql_warehouse", None):
                wh_id = getattr(res.sql_warehouse, "id", None)
                if wh_id:
                    warehouse_ids.append(str(wh_id))
            if getattr(res, "job", None):
                job_id = getattr(res.job, "id", None)
                if job_id:
                    job_ids.append(str(job_id))
            if getattr(res, "database", None):
                inst = getattr(res.database, "instance_name", None)
                if inst:
                    database_instance_names.append(str(inst))
            if getattr(res, "uc_securable", None):
                fqn = getattr(res.uc_securable, "securable_full_name", "") or ""
                parts = fqn.split(".")
                if len(parts) >= 2:
                    uc_catalog_names.add(parts[0])
    except Exception:
        pass
    return {
        "warehouse_ids": warehouse_ids,
        "job_ids": job_ids,
        "database_instance_names": database_instance_names,
        "uc_catalog_names": sorted(uc_catalog_names),
    }


def fetch_apps(w: WorkspaceClient) -> list[dict]:
    import concurrent.futures

    try:
        app_list = list(w.apps.list())
    except Exception as e:
        print(f"[apps] list error: {e}")
        return []

    def _get_one(app):
        state = url = ""
        try:
            state = str(app.status.state) if app.status else ""
        except Exception:
            pass
        try:
            url = app.url or ""
        except Exception:
            pass
        resources: dict = {"warehouse_ids": [], "job_ids": [], "database_instance_names": [], "uc_catalog_names": []}
        try:
            detail = w.apps.get(app.name)
            resources = _extract_resources(detail)
        except Exception:
            pass
        return {
            "id": f"app:{app.name}",
            "type": "App",
            "name": app.name,
            "fqn": app.name,
            "state": state,
            "url": url,
            "description": getattr(app, "description", "") or "",
            "creator": getattr(app, "creator", "") or "",
            **resources,
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        return list(ex.map(_get_one, app_list))


def collect_database_instances(apps: list[dict]) -> list[dict]:
    """
    Derive Lakebase Database node dicts from app resource declarations.
    Since database_instances.list() is not available in all SDK versions or workspaces,
    we infer instances from app resource references.
    """
    seen: dict[str, dict] = {}
    for app in apps:
        for inst_name in app.get("database_instance_names", []):
            if inst_name not in seen:
                seen[inst_name] = {
                    "id": f"database:{inst_name}",
                    "type": "Database",
                    "name": inst_name,
                    "fqn": inst_name,
                    "catalog_name": inst_name,  # Lakebase creates a UC catalog of the same name
                    "state": "",
                    "creator": "",
                    "read_only": False,
                }
    instances = list(seen.values())
    if instances:
        print(f"[databases] {len(instances)} Lakebase instances inferred from app resources")
    return instances


def fetch_databases(w: WorkspaceClient) -> list[dict]:
    """Fetch Lakebase (Postgres) database instances via SDK (falls back to empty list)."""
    results = []
    try:
        for db in w.database_instances.list():
            results.append({
                "id": f"database:{db.name}",
                "type": "Database",
                "name": db.name,
                "fqn": db.name,
                "catalog_name": db.name,
                "state": str(db.state) if getattr(db, "state", None) else "",
                "creator": getattr(db, "creator", "") or "",
                "read_only": getattr(db, "read_only", False),
            })
    except AttributeError:
        pass  # SDK version doesn't support database_instances; caller should use collect_database_instances
    except Exception as e:
        print(f"[databases] error: {e}")
    return results
