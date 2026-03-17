from databricks.sdk import WorkspaceClient


def fetch_catalogs(
    w: WorkspaceClient,
    catalog_filter: list[str] | None = None,
    limit: int | None = None,
) -> list[dict]:
    results = []
    try:
        for c in w.catalogs.list():
            if catalog_filter and c.name not in catalog_filter:
                continue
            # Skip internal/system catalogs when no explicit filter is set
            if not catalog_filter and c.name.startswith("__"):
                continue
            cat_type_str = str(c.catalog_type).replace("CatalogType.", "") if c.catalog_type else ""
            is_foreign = cat_type_str in {"FOREIGN", "DELTASHARING"}
            results.append({
                "id": f"catalog:{c.name}",
                "type": "ForeignCatalog" if is_foreign else "Catalog",
                "name": c.name,
                "fqn": c.name,
                "owner": c.owner or "",
                "comment": c.comment or "",
                "created_at": str(c.created_at) if c.created_at else None,
                "updated_at": str(c.updated_at) if c.updated_at else None,
                "metastore_id": c.metastore_id or "",
                "catalog_type": cat_type_str,
                "connection_name": getattr(c, "connection_name", "") or "",
            })
            # Early exit: explicit filter fully satisfied
            if catalog_filter and len(results) == len(catalog_filter):
                break
            # Hard cap when no filter is set (avoids iterating thousands of catalogs)
            if not catalog_filter and limit and len(results) >= limit:
                print(f"[catalogs] reached limit={limit}; set LATTICE_CATALOGS to ingest specific ones")
                break
    except Exception as e:
        print(f"[catalogs] error: {e}")
    return results


def fetch_schemas(w: WorkspaceClient, catalog_name: str, limit: int | None = None) -> list[dict]:
    results = []
    try:
        for s in w.schemas.list(catalog_name=catalog_name):
            results.append({
                "id": f"schema:{catalog_name}.{s.name}",
                "type": "Schema",
                "name": s.name,
                "fqn": f"{catalog_name}.{s.name}",
                "owner": s.owner or "",
                "comment": s.comment or "",
                "catalog_name": catalog_name,
                "created_at": str(s.created_at) if s.created_at else None,
                "updated_at": str(s.updated_at) if s.updated_at else None,
            })
            if limit and len(results) >= limit:
                break
    except Exception as e:
        print(f"[schemas:{catalog_name}] error: {e}")
    return results


def fetch_tables(w: WorkspaceClient, catalog_name: str, schema_name: str, limit: int | None = None) -> list[dict]:
    results = []
    try:
        for t in w.tables.list(catalog_name=catalog_name, schema_name=schema_name):
            tt = str(t.table_type).upper() if t.table_type else ""
            node_type = (
                "StreamingTable" if "STREAMING_TABLE" in tt else
                "MaterializedView" if "MATERIALIZED_VIEW" in tt else
                "View" if "VIEW" in tt else
                "Table"
            )
            results.append({
                "id": f"table:{t.full_name}",
                "type": node_type,
                "name": t.name,
                "fqn": t.full_name or f"{catalog_name}.{schema_name}.{t.name}",
                "owner": t.owner or "",
                "comment": t.comment or "",
                "catalog_name": catalog_name,
                "schema_name": schema_name,
                "table_type": str(t.table_type) if t.table_type else "",
                "data_source_format": str(t.data_source_format) if t.data_source_format else "",
                "created_at": str(t.created_at) if t.created_at else None,
                "updated_at": str(t.updated_at) if t.updated_at else None,
                "row_count": t.properties.get("spark.sql.statistics.numRows") if t.properties else None,
            })
            if limit and len(results) >= limit:
                break
    except Exception as e:
        print(f"[tables:{catalog_name}.{schema_name}] error: {e}")
    return results


def fetch_models(w: WorkspaceClient, catalog_filter: list[str] | None = None, limit: int = 200) -> list[dict]:
    results = []
    catalogs_to_scan = catalog_filter if catalog_filter else [None]
    for cat in catalogs_to_scan:
        try:
            kwargs = {}
            if cat:
                kwargs["catalog_name"] = cat
            for m in w.registered_models.list(**kwargs):
                results.append({
                    "id": f"model:{m.full_name}",
                    "type": "Model",
                    "name": m.name,
                    "fqn": m.full_name or m.name,
                    "owner": m.owner or "",
                    "comment": m.comment or "",
                    "catalog_name": m.catalog_name or "",
                    "schema_name": m.schema_name or "",
                    "created_at": str(m.created_at) if m.created_at else None,
                    "updated_at": str(m.updated_at) if m.updated_at else None,
                })
                if len(results) >= limit:
                    print(f"[models] limit={limit} reached; set LATTICE_MODEL_LIMIT to increase")
                    return results
        except Exception as e:
            print(f"[models:{cat}] error: {e}")
    return results


def fetch_volumes(w: WorkspaceClient, catalog_name: str, schema_name: str, limit: int | None = None) -> list[dict]:
    results = []
    try:
        for v in w.volumes.list(catalog_name=catalog_name, schema_name=schema_name):
            results.append({
                "id": f"volume:{v.full_name}",
                "type": "Volume",
                "name": v.name,
                "fqn": v.full_name or f"{catalog_name}.{schema_name}.{v.name}",
                "owner": v.owner or "",
                "comment": v.comment or "",
                "catalog_name": catalog_name,
                "schema_name": schema_name,
                "volume_type": str(v.volume_type) if v.volume_type else "",
                "storage_location": v.storage_location or "",
                "created_at": str(v.created_at) if v.created_at else None,
                "updated_at": str(v.updated_at) if v.updated_at else None,
            })
            if limit and len(results) >= limit:
                break
    except Exception as e:
        print(f"[volumes:{catalog_name}.{schema_name}] error: {e}")
    return results


def fetch_all(
    w: WorkspaceClient,
    catalog_filter: list[str] | None = None,
    catalog_limit: int | None = None,
    schema_limit: int | None = None,
    table_limit: int | None = None,
    model_limit: int = 200,
) -> dict:
    """
    Ingest catalogs, schemas, tables, and models.
    catalog_filter: explicit list of catalog names to include
    catalog_limit: max catalogs when no filter set
    schema_limit: max schemas per catalog
    table_limit: max tables per schema
    """
    import concurrent.futures

    catalogs = fetch_catalogs(w, catalog_filter=catalog_filter, limit=catalog_limit)

    SHALLOW_TYPES = {"DELTASHARING", "FOREIGN"}

    def _cat_type(cat: dict) -> str:
        return cat.get("catalog_type", "").replace("CatalogType.", "").upper()

    def _ingest_catalog(cat: dict) -> tuple[list, list, list]:
        cat_name = cat["name"]
        cat_schemas = [
            s for s in fetch_schemas(w, cat_name, limit=schema_limit)
            if s["name"] != "information_schema"
        ]
        if not cat_schemas:
            return [], [], []
        # Fetch all schemas' tables and volumes in parallel
        cat_tables: list = []
        cat_volumes: list = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as tex:
            table_futs = {
                tex.submit(fetch_tables, w, cat_name, sch["name"], table_limit): sch["name"]
                for sch in cat_schemas
            }
            volume_futs = {
                tex.submit(fetch_volumes, w, cat_name, sch["name"]): sch["name"]
                for sch in cat_schemas
            }
            for fut in concurrent.futures.as_completed(table_futs):
                try:
                    cat_tables.extend(fut.result())
                except Exception as e:
                    print(f"[tables] {cat_name}.{table_futs[fut]}: error — {e}")
            for fut in concurrent.futures.as_completed(volume_futs, timeout=30):
                try:
                    cat_volumes.extend(fut.result())
                except Exception as e:
                    print(f"[volumes] {cat_name}.{volume_futs[fut]}: error — {e}")
        return cat_schemas, cat_tables, cat_volumes

    schemas: list = []
    tables: list = []
    volumes: list = []
    normal_cats = [c for c in catalogs if _cat_type(c) not in SHALLOW_TYPES]

    for cat in catalogs:
        if _cat_type(cat) in SHALLOW_TYPES:
            print(f"[fetch_all] {cat['name']}: {cat.get('catalog_type','')} — node only")

    # Process all catalogs in parallel (6 concurrent)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(_ingest_catalog, cat): cat for cat in normal_cats}
        for fut in concurrent.futures.as_completed(futs, timeout=300):
            cat = futs[fut]
            try:
                s, t, v = fut.result()
                schemas.extend(s)
                tables.extend(t)
                volumes.extend(v)
                print(f"[fetch_all] {cat['name']}: {len(s)} schemas, {len(t)} tables, {len(v)} volumes")
            except concurrent.futures.TimeoutError:
                print(f"[fetch_all] {cat['name']}: timed out — skipping")
            except Exception as e:
                print(f"[fetch_all] {cat['name']}: error — {e}")

    models = fetch_models(w, catalog_filter=catalog_filter, limit=model_limit)
    return {"catalogs": catalogs, "schemas": schemas, "tables": tables, "volumes": volumes, "models": models}
