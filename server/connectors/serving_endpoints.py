from databricks.sdk import WorkspaceClient


def fetch_serving_endpoints(w: WorkspaceClient) -> list[dict]:
    """Fetch Model Serving / AI Gateway endpoints."""
    results = []
    try:
        for ep in w.serving_endpoints.list():
            state = ""
            try:
                state = str(ep.state.ready) if ep.state else ""
            except Exception:
                pass
            # Extract served model/entity names for edge building
            model_names: list[str] = []
            endpoint_type = "ServingEndpoint"
            try:
                for entity in (ep.config.served_entities or []):
                    name = getattr(entity, "entity_name", None) or getattr(entity, "name", None) or ""
                    if name:
                        model_names.append(name)
                    # Detect foundation model / external model endpoints
                    if getattr(entity, "foundation_model", None) or getattr(entity, "external_model", None):
                        endpoint_type = "ServingEndpoint"
            except Exception:
                pass
            try:
                for model in (ep.config.served_models or []):
                    name = getattr(model, "model_name", None) or ""
                    if name:
                        model_names.append(name)
            except Exception:
                pass
            results.append({
                "id": f"serving:{ep.name}",
                "type": endpoint_type,
                "name": ep.name,
                "fqn": ep.name,
                "state": state,
                "model_names": model_names,
                "creator": getattr(ep, "creator", "") or "",
                "created_at": str(ep.creation_timestamp) if getattr(ep, "creation_timestamp", None) else None,
            })
    except Exception as e:
        print(f"[serving_endpoints] error: {e}")
    if results:
        print(f"[serving_endpoints] {len(results)} endpoints fetched")
    return results
