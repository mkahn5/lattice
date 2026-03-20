from databricks.sdk import WorkspaceClient


def fetch_genie_spaces(w: WorkspaceClient) -> list[dict]:
    """Fetch Genie spaces (AI/BI rooms)."""
    results = []
    try:
        # Genie spaces are accessed via the workspace API as they're stored as workspace objects
        # The SDK exposes w.genie for conversation, but listing spaces uses the REST API
        resp = w.api_client.do(
            "GET",
            "/api/2.0/genie/spaces",
        )
        spaces = resp.get("spaces", []) if isinstance(resp, dict) else []
        for space in spaces:
            space_id = space.get("space_id", "") or space.get("id", "")
            title = space.get("title", "") or space.get("name", "") or space_id
            warehouse_id = space.get("warehouse_id", "")
            table_identifiers: list[str] = []
            try:
                for tbl in (space.get("tables", []) or []):
                    fqn = tbl if isinstance(tbl, str) else (tbl.get("table_identifier", "") or tbl.get("name", ""))
                    if fqn:
                        table_identifiers.append(fqn.lower())
            except Exception:
                pass
            results.append({
                "id": f"genie:{space_id}",
                "type": "GenieSpace",
                "name": title,
                "fqn": space_id,
                "warehouse_id": warehouse_id,
                "table_identifiers": table_identifiers,
                "description": space.get("description", "") or "",
                "creator": space.get("creator_id", "") or "",
            })
    except Exception as e:
        # Genie spaces API may not be available on all workspaces
        print(f"[genie] error: {e}")
    if results:
        print(f"[genie] {len(results)} spaces fetched")
    return results
