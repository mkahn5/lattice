from databricks.sdk import WorkspaceClient


def fetch_pipelines(w: WorkspaceClient, limit: int = 200) -> list[dict]:
    results = []
    try:
        for p in w.pipelines.list_pipelines(max_results=limit):
            results.append({
                "id": f"pipeline:{p.pipeline_id}",
                "type": "Pipeline",
                "name": p.name or p.pipeline_id,
                "fqn": p.pipeline_id,
                "state": str(p.state) if p.state else "",
                "creator_user_name": getattr(p, "creator_user_name", "") or "",
            })
            if len(results) >= limit:
                print(f"[pipelines] limit={limit} reached; set LATTICE_PIPELINE_LIMIT to increase")
                break
    except Exception as e:
        print(f"[pipelines] error: {e}")
    return results
