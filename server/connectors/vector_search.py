from databricks.sdk import WorkspaceClient


def fetch_vector_search_indexes(w: WorkspaceClient) -> list[dict]:
    """Fetch Vector Search indexes and their source tables / serving endpoints."""
    results = []
    try:
        for ep in w.vector_search_endpoints.list_endpoints():
            ep_name = ep.name or ""
            try:
                indexes = list(w.vector_search_indexes.list_indexes(endpoint_name=ep_name))
            except Exception:
                indexes = []
            for idx in indexes:
                source_table = ""
                embedding_endpoint = ""
                try:
                    if getattr(idx, "delta_sync_index_spec", None):
                        spec = idx.delta_sync_index_spec
                        source_table = getattr(spec, "source_table", "") or ""
                        # Embedding model endpoint (if using auto-embedding)
                        for col_spec in (getattr(spec, "embedding_source_columns", None) or []):
                            ep_ref = getattr(col_spec, "embedding_model_endpoint_name", "") or ""
                            if ep_ref:
                                embedding_endpoint = ep_ref
                                break
                except Exception:
                    pass
                idx_name = getattr(idx, "name", "") or ""
                results.append({
                    "id": f"vsindex:{idx_name}",
                    "type": "VectorSearchIndex",
                    "name": idx_name.split(".")[-1] if "." in idx_name else idx_name,
                    "fqn": idx_name,
                    "endpoint_name": ep_name,
                    "source_table": source_table.lower() if source_table else "",
                    "embedding_endpoint": embedding_endpoint,
                    "index_type": str(getattr(idx, "index_type", "")) or "",
                    "status": str(getattr(idx, "status", "")) or "",
                })
    except AttributeError:
        print("[vector_search] SDK does not support vector_search_endpoints — skipping")
    except Exception as e:
        print(f"[vector_search] error: {e}")
    if results:
        print(f"[vector_search] {len(results)} indexes fetched")
    return results
