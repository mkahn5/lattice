import json
import re
import concurrent.futures
import requests
from databricks.sdk import WorkspaceClient

# Match 3-part table refs: catalog.schema.table (with optional backtick quoting)
_TABLE_RE = re.compile(
    r'\b(?:FROM|JOIN)\s+`?([a-zA-Z0-9_]+)`?\.`?([a-zA-Z0-9_]+)`?\.`?([a-zA-Z0-9_]+)`?',
    re.IGNORECASE,
)


def _extract_table_fqns(sql: str) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []
    for cat, sch, tbl in _TABLE_RE.findall(sql):
        fqn_lower = f"{cat}.{sch}.{tbl}".lower()
        if fqn_lower not in seen:
            seen.add(fqn_lower)
            results.append(f"{cat}.{sch}.{tbl}")
    return results


def _fetch_dashboard_tables(host: str, headers: dict, dashboard_id: str) -> list[str]:
    """Fetch a dashboard's serialized spec and extract all 3-part table FQNs from dataset queries."""
    try:
        resp = requests.get(
            f"{host}/api/2.0/lakeview/dashboards/{dashboard_id}",
            headers=headers,
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        serialized = resp.json().get("serialized_dashboard", "")
        if not serialized:
            return []
        spec = json.loads(serialized)
        seen: set[str] = set()
        fqns: list[str] = []
        for dataset in spec.get("datasets", []):
            # Query may be a plain string or split across a "queryLines" list
            sql = dataset.get("query") or "".join(dataset.get("queryLines", []))
            for fqn in _extract_table_fqns(sql):
                if fqn.lower() not in seen:
                    seen.add(fqn.lower())
                    fqns.append(fqn)
        return fqns
    except Exception as e:
        print(f"[dashboards] detail error for {dashboard_id}: {e}")
        return []


def fetch_dashboards(w: WorkspaceClient) -> list[dict]:
    results = []
    try:
        host = w.config.host.rstrip("/")
        # Use SDK's authenticate() so OAuth/M2M/PAT all work — avoids "Bearer None"
        headers = w.config.authenticate()

        # Paginate through all dashboards
        all_dashboards: list[dict] = []
        page_token: str | None = None
        while True:
            params = {"page_size": 100}
            if page_token:
                params["page_token"] = page_token
            resp = requests.get(
                f"{host}/api/2.0/lakeview/dashboards",
                headers=headers, params=params, timeout=15,
            )
            if resp.status_code != 200:
                print(f"[dashboards] list error: {resp.status_code} {resp.text[:200]}")
                break
            body = resp.json()
            all_dashboards.extend(body.get("dashboards", []))
            page_token = body.get("next_page_token")
            if not page_token:
                break

        dashboards = all_dashboards
        for d in dashboards:
            results.append({
                "id": f"dashboard:{d.get('dashboard_id')}",
                "type": "Dashboard",
                "name": d.get("display_name", d.get("dashboard_id")),
                "fqn": d.get("dashboard_id"),
                "warehouse_id": d.get("warehouse_id", ""),
                "owner": d.get("owner_user_name", ""),
                "created_time": d.get("create_time", ""),
                "updated_time": d.get("update_time", ""),
                "lifecycle_state": d.get("lifecycle_state", ""),
                "table_fqns": [],
            })

        # Fetch table refs for all dashboards in parallel
        # Re-fetch headers so each thread gets a fresh token (important for OAuth)
        ids = [d.get("dashboard_id") for d in dashboards if d.get("dashboard_id")]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            futs = {
                ex.submit(_fetch_dashboard_tables, host, w.config.authenticate(), did): did
                for did in ids
            }
            fqns_by_id = {}
            for fut in concurrent.futures.as_completed(futs):
                did = futs[fut]
                try:
                    fqns_by_id[did] = fut.result()
                except Exception:
                    fqns_by_id[did] = []

        # Merge table FQNs back into results
        for item in results:
            did = item["fqn"]
            item["table_fqns"] = fqns_by_id.get(did, [])
            if item["table_fqns"]:
                print(f"[dashboards] {item['name']}: {len(item['table_fqns'])} table refs")

    except Exception as e:
        print(f"[dashboards] error: {e}")
    return results
