from databricks.sdk import WorkspaceClient


def fetch_connections(w: WorkspaceClient) -> list[dict]:
    """Fetch external connections (Snowflake, BigQuery, MySQL, etc.)."""
    results = []
    try:
        for conn in w.connections.list():
            results.append({
                "id": f"connection:{conn.name}",
                "type": "Connection",
                "name": conn.name,
                "fqn": conn.name,
                "connection_type": str(conn.connection_type).replace("ConnectionType.", "") if conn.connection_type else "",
                "owner": conn.owner or "",
                "comment": conn.comment or "",
                "created_at": str(conn.created_at) if getattr(conn, "created_at", None) else None,
                "updated_at": str(conn.updated_at) if getattr(conn, "updated_at", None) else None,
            })
    except Exception as e:
        print(f"[connections] error: {e}")
    return results


def fetch_shares(w: WorkspaceClient) -> list[dict]:
    """Fetch Delta Sharing shares with their table objects (parallel detail fetching)."""
    import concurrent.futures

    try:
        share_list = list(w.shares.list())
    except Exception as e:
        print(f"[shares] error: {e}")
        return []

    def _get_one(share):
        table_names: list[str] = []
        try:
            detail = w.shares.get(share.name)
            for obj in (detail.objects or []):
                obj_type = str(getattr(obj, "data_object_type", "")).upper()
                if "TABLE" in obj_type and getattr(obj, "name", None):
                    table_names.append(obj.name.lower())
        except Exception:
            pass
        return {
            "id": f"share:{share.name}",
            "type": "Share",
            "name": share.name,
            "fqn": share.name,
            "owner": share.owner or "",
            "comment": share.comment or "",
            "table_names": table_names,
            "created_at": str(share.created_at) if getattr(share, "created_at", None) else None,
            "updated_at": str(share.updated_at) if getattr(share, "updated_at", None) else None,
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        return list(ex.map(_get_one, share_list))


def fetch_recipients(w: WorkspaceClient) -> list[dict]:
    """Fetch Delta Sharing recipients."""
    results = []
    try:
        for r in w.recipients.list():
            auth_type = str(getattr(r, "authentication_type", "")).replace("AuthenticationType.", "")
            results.append({
                "id": f"recipient:{r.name}",
                "type": "Recipient",
                "name": r.name,
                "fqn": r.name,
                "authentication_type": auth_type,
                "comment": r.comment or "",
                "created_at": str(r.created_at) if getattr(r, "created_at", None) else None,
                "updated_at": str(r.updated_at) if getattr(r, "updated_at", None) else None,
            })
    except Exception as e:
        print(f"[recipients] error: {e}")
    return results
