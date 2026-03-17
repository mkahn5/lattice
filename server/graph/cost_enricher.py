from __future__ import annotations
from collections import defaultdict


def compute_cost_attribution(graph_data: dict, gen: int | None = None) -> dict:
    """
    Walk the in-memory NetworkX graph from cost sources (nodes with dbu_30d > 0),
    attribute DBU spend to reachable Table/View nodes, then roll up to Schema/Catalog.
    Returns {available, nodes, summary} or {} if the generation is superseded.
    """
    try:
        from server.api.routes import get_ingestion_gen
        if gen is not None and gen != get_ingestion_gen():
            return {}
    except Exception:
        pass

    G = graph_data.get("_graph")
    if G is None:
        return {"available": False, "nodes": {}, "summary": {
            "total_workspace_dbu_30d": 0,
            "top_catalogs": [], "top_schemas": [], "top_tables": [],
        }}

    nodes_list = graph_data.get("nodes", [])
    node_by_id = {n["id"]: n for n in nodes_list}

    # Collect cost sources: nodes where dbu_30d > 0
    cost_sources = {
        nid: n for nid, n in node_by_id.items()
        if isinstance(n.get("dbu_30d"), (int, float)) and float(n["dbu_30d"]) > 0
    }

    if not cost_sources:
        # Distinguish: enrichment ran (tables have heat) but no billing vs enrichment never ran
        has_enrichment = any(n.get("heat") for n in nodes_list)
        reason = "no_billing_data" if has_enrichment else "no_enrichment"
        print(f"[cost_enricher] no cost sources found (reason={reason}, "
              f"nodes={len(nodes_list)}, has_enrichment={has_enrichment})")
        return {"available": False, "reason": reason, "nodes": {}, "summary": {
            "total_workspace_dbu_30d": 0,
            "top_catalogs": [], "top_schemas": [], "top_tables": [],
        }}

    TABLE_TYPES = {"Table", "View", "StreamingTable", "MaterializedView"}
    LINEAGE_RELS = {"writesTo", "readsFrom", "feedsInto", "queries", "uses"}

    # table_id → {compute_id: dbu}
    table_attribution: dict[str, dict[str, float]] = {}

    for src_id, src_node in cost_sources.items():
        dbu = float(src_node["dbu_30d"])
        src_type = src_node.get("type", "")

        # Find consumer nodes (Dashboards, Jobs) that runOn this compute node
        # (they have outgoing runsOn edges pointing TO this node)
        consumers: set[str] = set()
        if G.has_node(src_id):
            for pred in G.predecessors(src_id):
                edge_data = G.get_edge_data(pred, src_id) or {}
                if edge_data.get("relationship") == "runsOn":
                    consumers.add(pred)

        # Jobs with direct DBU count as their own consumer
        if src_type == "Job":
            consumers.add(src_id)

        # From each consumer, BFS to find reachable Table nodes via lineage edges
        reachable_tables: set[str] = set()
        for consumer_id in consumers:
            if not G.has_node(consumer_id):
                continue
            visited = {consumer_id}
            queue = [consumer_id]
            while queue:
                cur = queue.pop()
                for succ in G.successors(cur):
                    if succ in visited:
                        continue
                    visited.add(succ)
                    edge_data = G.get_edge_data(cur, succ) or {}
                    rel = edge_data.get("relationship", "")
                    if rel in LINEAGE_RELS:
                        ntype = node_by_id.get(succ, {}).get("type", "")
                        if ntype in TABLE_TYPES:
                            reachable_tables.add(succ)
                        queue.append(succ)

        for tbl_id in reachable_tables:
            if tbl_id not in table_attribution:
                table_attribution[tbl_id] = {}
            # Take max rather than sum for same compute node hitting table via multiple paths
            table_attribution[tbl_id][src_id] = max(
                table_attribution[tbl_id].get(src_id, 0.0), dbu
            )

    # Build result_nodes
    result_nodes: dict = {}

    # Table nodes
    for tbl_id, consumers_map in table_attribution.items():
        tbl_node = node_by_id.get(tbl_id)
        if not tbl_node:
            continue
        direct = float(tbl_node.get("dbu_30d") or 0)
        attributed = sum(consumers_map.values())
        total = direct + attributed
        top_consumers = sorted(
            [
                {
                    "id": cid,
                    "name": node_by_id.get(cid, {}).get("name", cid),
                    "dbu": round(dbu, 1),
                }
                for cid, dbu in consumers_map.items()
            ],
            key=lambda x: -x["dbu"],
        )[:5]
        result_nodes[tbl_id] = {
            "direct_dbu": round(direct, 1),
            "attributed_dbu": round(attributed, 1),
            "total_dbu": round(total, 1),
            "cost_rank_pct": 0.0,
            "top_consumers": top_consumers,
        }

    # Compute source nodes themselves
    for src_id, src_node in cost_sources.items():
        dbu = float(src_node["dbu_30d"])
        result_nodes[src_id] = {
            "direct_dbu": round(dbu, 1),
            "attributed_dbu": 0.0,
            "total_dbu": round(dbu, 1),
            "cost_rank_pct": 0.0,
            "top_consumers": [],
        }

    # Roll up Table → Schema → Catalog via contains edges
    def _roll_up(child_type_set: set, result: dict) -> dict[str, float]:
        parent_totals: dict[str, float] = {}
        for node in nodes_list:
            pid = node["id"]
            if not G.has_node(pid):
                continue
            total = 0.0
            for succ in G.successors(pid):
                edge_data = G.get_edge_data(pid, succ) or {}
                if edge_data.get("relationship") == "contains":
                    if node_by_id.get(succ, {}).get("type") in child_type_set:
                        total += result.get(succ, {}).get("total_dbu", 0.0)
            if total > 0:
                parent_totals[pid] = total
        return parent_totals

    schema_totals = _roll_up(TABLE_TYPES, result_nodes)
    for sid, total in schema_totals.items():
        result_nodes[sid] = {
            "direct_dbu": 0.0,
            "attributed_dbu": round(total, 1),
            "total_dbu": round(total, 1),
            "cost_rank_pct": 0.0,
            "top_consumers": [],
        }

    catalog_totals = _roll_up({"Schema"}, result_nodes)
    for cid, total in catalog_totals.items():
        result_nodes[cid] = {
            "direct_dbu": 0.0,
            "attributed_dbu": round(total, 1),
            "total_dbu": round(total, 1),
            "cost_rank_pct": 0.0,
            "top_consumers": [],
        }

    # Compute cost_rank_pct per node type group (percentile rank within type)
    by_type: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for nid, nd in result_nodes.items():
        ntype = node_by_id.get(nid, {}).get("type", "Unknown")
        by_type[ntype].append((nid, nd["total_dbu"]))

    for _ntype, items in by_type.items():
        sorted_items = sorted(items, key=lambda x: x[1])
        n = len(sorted_items)
        for rank, (nid, dbu) in enumerate(sorted_items):
            if n == 1:
                pct = 1.0 if dbu > 0 else 0.0
            else:
                pct = rank / (n - 1)
            result_nodes[nid]["cost_rank_pct"] = round(pct, 3)

    # Build summary
    total_workspace_dbu = sum(float(n["dbu_30d"]) for n in cost_sources.values())

    def _top(pairs: list[tuple[str, float]], limit: int = 10) -> list[dict]:
        return [
            {
                "id": nid,
                "name": node_by_id.get(nid, {}).get("name", nid),
                "fqn": node_by_id.get(nid, {}).get("fqn", nid),
                "total_dbu": round(total, 1),
            }
            for nid, total in sorted(pairs, key=lambda x: -x[1])[:limit]
        ]

    top_catalogs = _top(list(catalog_totals.items()))
    top_schemas  = _top(list(schema_totals.items()))
    top_tables   = _top([
        (nid, result_nodes[nid]["total_dbu"])
        for nid in table_attribution
        if nid in result_nodes
    ])

    print(f"[cost_enricher] {len(result_nodes)} nodes attributed, "
          f"{len(schema_totals)} schemas, {len(catalog_totals)} catalogs, "
          f"total workspace DBU 30d: {round(total_workspace_dbu, 1)}")

    return {
        "available": True,
        "nodes": result_nodes,
        "summary": {
            "total_workspace_dbu_30d": round(total_workspace_dbu, 1),
            "top_catalogs": top_catalogs,
            "top_schemas": top_schemas,
            "top_tables": top_tables,
        },
    }
