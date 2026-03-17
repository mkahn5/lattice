import networkx as nx
from server.graph.schema import NODE_COLORS, NODE_ICONS


def build_graph(
    uc_data: dict,
    warehouses: list,
    clusters: list,
    jobs: list,
    dashboards: list,
    apps: list | None = None,
    databases: list | None = None,
    enrichment: dict | None = None,
    lineage: list | None = None,
    connections: list | None = None,
    shares: list | None = None,
    recipients: list | None = None,
    volumes: list | None = None,
    pipelines: list | None = None,
) -> dict:
    G = nx.DiGraph()

    def add_node(item: dict):
        G.add_node(item["id"], **item)

    # Add all UC nodes
    for cat in uc_data["catalogs"]:
        add_node(cat)
    for sch in uc_data["schemas"]:
        add_node(sch)
    for tbl in uc_data["tables"]:
        add_node(tbl)
    for mdl in uc_data["models"]:
        add_node(mdl)
    for vol in (volumes or uc_data.get("volumes", [])):
        add_node(vol)

    # Add compute nodes
    for wh in warehouses:
        add_node(wh)
    for cl in clusters:
        add_node(cl)

    # Add job nodes
    for job in jobs:
        add_node(job)

    # Add dashboard nodes
    for dash in dashboards:
        add_node(dash)

    # Add app nodes
    for app in (apps or []):
        add_node(app)

    # Add database (Lakebase) nodes
    for db in (databases or []):
        add_node(db)

    # Add federation nodes
    for conn in (connections or []):
        add_node(conn)
    for share in (shares or []):
        add_node(share)
    for recipient in (recipients or []):
        add_node(recipient)

    # Add pipeline nodes
    for pl in (pipelines or []):
        add_node(pl)

    # Structural edges: Catalog -> Schema
    schema_by_cat: dict[str, list] = {}
    for sch in uc_data["schemas"]:
        cat = sch["catalog_name"]
        schema_by_cat.setdefault(cat, []).append(sch)

    for cat in uc_data["catalogs"]:
        for sch in schema_by_cat.get(cat["name"], []):
            G.add_edge(cat["id"], sch["id"], relationship="contains", label="contains")

    # Schema -> Table
    table_by_schema: dict[str, list] = {}
    for tbl in uc_data["tables"]:
        key = f"{tbl['catalog_name']}.{tbl['schema_name']}"
        table_by_schema.setdefault(key, []).append(tbl)

    for sch in uc_data["schemas"]:
        key = f"{sch['catalog_name']}.{sch['name']}"
        for tbl in table_by_schema.get(key, []):
            G.add_edge(sch["id"], tbl["id"], relationship="contains", label="contains")

    # Schema -> Model
    model_by_schema: dict[str, list] = {}
    for mdl in uc_data["models"]:
        key = f"{mdl['catalog_name']}.{mdl['schema_name']}"
        model_by_schema.setdefault(key, []).append(mdl)

    for sch in uc_data["schemas"]:
        key = f"{sch['catalog_name']}.{sch['name']}"
        for mdl in model_by_schema.get(key, []):
            G.add_edge(sch["id"], mdl["id"], relationship="contains", label="contains")

    # Schema -> Volume
    _all_volumes = volumes or uc_data.get("volumes", [])
    volume_by_schema: dict[str, list] = {}
    for vol in _all_volumes:
        key = f"{vol['catalog_name']}.{vol['schema_name']}"
        volume_by_schema.setdefault(key, []).append(vol)

    for sch in uc_data["schemas"]:
        key = f"{sch['catalog_name']}.{sch['name']}"
        for vol in volume_by_schema.get(key, []):
            G.add_edge(sch["id"], vol["id"], relationship="contains", label="contains")

    # Job -> Cluster (runsOn) — tasks that pin to an existing cluster
    cluster_by_id = {cl["fqn"]: cl["id"] for cl in clusters}
    for job in jobs:
        for cid in job.get("cluster_ids", []):
            if cid in cluster_by_id:
                G.add_edge(job["id"], cluster_by_id[cid], relationship="runsOn", label="runs on")

    # Serverless compute pool node — created only if serverless jobs exist
    serverless_jobs = [j for j in jobs if j.get("uses_serverless")]
    if serverless_jobs:
        pool_id = "serverless:pool"
        G.add_node(pool_id, **{
            "id": pool_id,
            "type": "Serverless",
            "name": "Serverless Compute",
            "fqn": "serverless",
            "state": "ACTIVE",
        })
        for job in serverless_jobs:
            G.add_edge(job["id"], pool_id, relationship="runsOn", label="runs on")

    # Dashboard -> Warehouse/Serverless (runsOn) — index all warehouse-like nodes by fqn
    warehouse_by_id = {wh["fqn"]: wh["id"] for wh in warehouses}
    for dash in dashboards:
        wh_id = dash.get("warehouse_id", "")
        if wh_id and wh_id in warehouse_by_id:
            G.add_edge(dash["id"], warehouse_by_id[wh_id], relationship="runsOn", label="runs on")

    # Dashboard -> Table/View (queries) — extracted from dataset SQL
    # Build lookup from existing table/view nodes
    table_fqn_to_id = {
        str(data.get("fqn", "")).lower(): nid
        for nid, data in G.nodes(data=True)
        if data.get("type") in ("Table", "View")
    }
    dash_query_count = 0
    stub_count = 0
    for dash in dashboards:
        for fqn in dash.get("table_fqns", []):
            tgt_id = table_fqn_to_id.get(fqn.lower())
            if not tgt_id:
                # Table is outside catalog filter — create a stub node so the edge is visible
                stub_id = f"stub:{fqn.lower()}"
                if stub_id not in G:
                    parts = fqn.split(".")
                    stub_name = parts[-1] if parts else fqn
                    G.add_node(stub_id, **{
                        "id": stub_id,
                        "type": "Table",
                        "name": stub_name,
                        "fqn": fqn,
                        "stub": True,
                        "comment": "Referenced by dashboard (catalog not in current scope)",
                    })
                    table_fqn_to_id[fqn.lower()] = stub_id
                    stub_count += 1
                tgt_id = table_fqn_to_id[fqn.lower()]
            G.add_edge(dash["id"], tgt_id, relationship="queries", label="queries")
            dash_query_count += 1
    if dash_query_count:
        print(f"[builder] dashboard→table: {dash_query_count} edges added ({stub_count} stub nodes created)")

    # App -> Warehouse (runsOn), App -> Job (triggers), App -> Database (uses), App -> Catalog (uses)
    job_by_id = {job["fqn"]: job["id"] for job in jobs}
    db_by_name = {db["name"].lower(): db["id"] for db in (databases or [])}
    for app in (apps or []):
        for wh_id in app.get("warehouse_ids", []):
            if wh_id in warehouse_by_id:
                G.add_edge(app["id"], warehouse_by_id[wh_id], relationship="runsOn", label="runs on")
        for job_id in app.get("job_ids", []):
            if job_id in job_by_id:
                G.add_edge(app["id"], job_by_id[job_id], relationship="triggers", label="triggers")
        for inst_name in app.get("database_instance_names", []):
            db_id = db_by_name.get(inst_name.lower())
            if db_id:
                G.add_edge(app["id"], db_id, relationship="uses", label="uses")

    # Connection -> ForeignCatalog (exposes) — connection is the source of a federated catalog
    connection_id_by_name = {conn["name"].lower(): conn["id"] for conn in (connections or [])}
    for cat in uc_data["catalogs"]:
        if cat.get("type") == "ForeignCatalog" and cat.get("connection_name"):
            conn_id = connection_id_by_name.get(cat["connection_name"].lower())
            if conn_id:
                G.add_edge(conn_id, cat["id"], relationship="exposes", label="exposes")

    # Share -> Table (includes) — tables exposed by each share
    if shares:
        fqn_to_id_share: dict[str, str] = {
            str(data.get("fqn", "")).lower(): nid
            for nid, data in G.nodes(data=True)
        }
        for share in shares:
            for tname in share.get("table_names", []):
                tgt_id = fqn_to_id_share.get(tname)
                if tgt_id:
                    G.add_edge(share["id"], tgt_id, relationship="includes", label="includes")

    # Database (Lakebase) -> Catalog (exposes) — instance creates a UC catalog of the same name
    catalog_by_name = {cat["name"].lower(): cat["id"] for cat in uc_data["catalogs"]}
    for db in (databases or []):
        cat_id = catalog_by_name.get(db["name"].lower())
        if cat_id:
            G.add_edge(db["id"], cat_id, relationship="exposes", label="exposes")

    # App -> Catalog (uses) — from uc_securable resource declarations
    for app in (apps or []):
        for cat_name in app.get("uc_catalog_names", []):
            cat_id = catalog_by_name.get(cat_name.lower())
            if cat_id:
                G.add_edge(app["id"], cat_id, relationship="uses", label="uses")

    # Lineage edges (table→table feedsInto, job→table writesTo/readsFrom)
    if lineage:
        fqn_to_id: dict[str, str] = {}
        for node_id, data in G.nodes(data=True):
            fqn_val = str(data.get("fqn", "")).lower()
            if fqn_val:
                fqn_to_id[fqn_val] = node_id

        label_map = {"feedsInto": "feeds into", "writesTo": "writes to", "readsFrom": "reads from"}
        added = 0
        for edge in lineage:
            src_id = fqn_to_id.get(edge["source_fqn"])
            tgt_id = fqn_to_id.get(edge["target_fqn"])
            if src_id and tgt_id and src_id != tgt_id and not G.has_edge(src_id, tgt_id):
                etype = edge["edge_type"]
                G.add_edge(src_id, tgt_id, relationship=etype,
                           label=label_map.get(etype, etype), lineage=True)
                added += 1
        print(f"[builder] lineage: {added} edges added ({len(lineage)} input, {len(lineage)-added} skipped/duplicate)")

    # Serialize
    nodes = []
    for node_id, data in G.nodes(data=True):
        node_type = data.get("type", "Unknown")
        nodes.append({
            **data,
            "color": NODE_COLORS.get(node_type, "#94a3b8"),
            "icon": NODE_ICONS.get(node_type, "circle"),
        })

    # Apply system table enrichment if provided
    if enrichment:
        from server.connectors.system_tables import apply_enrichment
        nodes = apply_enrichment(nodes, enrichment)

    edges = []
    for src, tgt, data in G.edges(data=True):
        edges.append({
            "id": f"{src}--{tgt}",
            "source": src,
            "target": tgt,
            "relationship": data.get("relationship", "relatedTo"),
            "label": data.get("label", ""),
            "lineage": data.get("lineage", False),
        })

    stats = {
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
        "node_types": {},
    }
    for _, data in G.nodes(data=True):
        t = data.get("type", "Unknown")
        stats["node_types"][t] = stats["node_types"].get(t, 0) + 1

    return {"nodes": nodes, "edges": edges, "stats": stats, "_graph": G}
