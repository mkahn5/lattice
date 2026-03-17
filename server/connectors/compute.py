from databricks.sdk import WorkspaceClient


def fetch_warehouses(w: WorkspaceClient) -> list[dict]:
    results = []
    try:
        for wh in w.warehouses.list():
            wtype = str(wh.warehouse_type) if wh.warehouse_type else ""
            is_serverless = "SERVERLESS" in wtype.upper()
            results.append({
                "id": f"warehouse:{wh.id}",
                "type": "Serverless" if is_serverless else "Warehouse",
                "name": wh.name or wh.id,
                "fqn": wh.id,
                "warehouse_type": wtype,
                "state": str(wh.state) if wh.state else "",
                "cluster_size": wh.cluster_size or "",
                "num_clusters": wh.num_clusters or 0,
                "auto_stop_mins": wh.auto_stop_mins or 0,
                "creator_name": wh.creator_name or "",
            })
    except Exception as e:
        print(f"[warehouses] error: {e}")
    return results


_CLUSTER_SKIP_STATES = {"State.TERMINATED", "State.TERMINATING", "State.ERROR"}


def fetch_clusters(w: WorkspaceClient, limit: int = 200) -> list[dict]:
    results = []
    try:
        for cl in w.clusters.list():
            state = str(cl.state) if cl.state else ""
            if state in _CLUSTER_SKIP_STATES:
                continue
            results.append({
                "id": f"cluster:{cl.cluster_id}",
                "type": "Cluster",
                "name": cl.cluster_name or cl.cluster_id,
                "fqn": cl.cluster_id,
                "state": state,
                "spark_version": cl.spark_version or "",
                "node_type_id": cl.node_type_id or "",
                "num_workers": cl.num_workers or 0,
                "creator_user_name": cl.creator_user_name or "",
                "cluster_source": str(cl.cluster_source) if cl.cluster_source else "",
            })
            if len(results) >= limit:
                break
    except Exception as e:
        print(f"[clusters] error: {e}")
    return results
