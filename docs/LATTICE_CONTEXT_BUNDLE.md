# Lattice - Context Bundle for Feature Development

This document contains all context needed to continue building Lattice features.
Pass this to any agent or conversation to give it full project understanding.

---

## Project Overview

Lattice is a visual intelligence tool for Databricks workspaces. It builds a live
ontology of Unity Catalog assets, compute, jobs, dashboards, and apps as typed
entities with semantic relationships, enriched with cost attribution, lineage, and
governance insights. Lattice discovers assets from multiple Databricks APIs in
parallel, then connects them through typed edges that carry meaning - structural
(catalog→schema→table), compute (job→cluster), lineage (job→table→view), AI/ML
(endpoint→model), and federation (connection→foreign catalog). The result is a
navigable knowledge graph of workspaces, built for data teams and AI agents.

**Version:** v0.5.4
**Repo:** `~/projects/lattice`
**Public repo:** https://github.com/mkahn5/lattice
**Internal repo:** https://github.com/databricks-field-eng/lattice

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + ReactFlow + Zustand + Tailwind CSS |
| Backend | Python 3.11+ + FastAPI + Uvicorn |
| Graph Engine | NetworkX DiGraph |
| SDK | databricks-sdk (Python) |
| Export Format | JSON-LD |
| Deployment | Databricks Apps |

---

## Architecture

```
Frontend (React 19 + ReactFlow + Zustand + Tailwind)
    │ REST API
Backend (FastAPI)
    ├── Connectors (13 sources: UC, compute, jobs, dashboards, apps,
    │   federation, pipelines, serving, vector search, genie, system tables,
    │   lineage backfill)
    ├── Graph Engine (NetworkX DiGraph)
    ├── Cost Enricher (BFS-based DBU attribution)
    ├── Annotation Store (Delta-backed tags & notes)
    ├── Preflight Checks (system table access validation)
    └── Config Persistence (lattice_config.json)
        │ Databricks SDK + SQL
Databricks Workspace
    UC │ Compute │ Jobs │ Dashboards │ System Tables │ Apps │ Shares │ etc.
```

### Ingestion Flow
1. Load cached graph immediately (instant canvas)
2. Fetch all connectors in parallel with 45s timeout each
3. Publish partial graph while slower connectors finish
4. Fetch system table enrichment (usage, heat, tags, lineage, cost)
5. Backfill missing jobs/tables referenced in lineage
6. Build full NetworkX graph + compute cost attribution
7. Merge annotations + cache to disk

---

## Key Files

| File | Purpose |
|------|---------|
| `app.py` | FastAPI entry point, ingestion orchestration, version (`__version__`) |
| `server/config.py` | Workspace client setup, config I/O, `apply_app_config()` |
| `server/api/routes.py` | All API endpoints (graph, config, health, cost, annotations, scorecard) |
| `server/connectors/unity_catalog.py` | UC catalogs, schemas, tables, models, volumes, view dependencies |
| `server/connectors/compute.py` | Warehouses, clusters |
| `server/connectors/jobs.py` | Jobs (serverless + cluster-bound) |
| `server/connectors/dashboards.py` | Lakeview dashboards + table lineage extraction |
| `server/connectors/apps.py` | Databricks Apps, Lakebase databases |
| `server/connectors/federation.py` | Connections, Delta Shares, Recipients |
| `server/connectors/pipelines.py` | DLT, Autoloader pipelines |
| `server/connectors/serving_endpoints.py` | Model Serving / AI Gateway endpoints |
| `server/connectors/vector_search.py` | Vector Search indexes |
| `server/connectors/genie.py` | Genie spaces (AI/BI rooms) |
| `server/connectors/system_tables.py` | System table queries: enrichment, lineage, tags |
| `server/connectors/lineage_backfill.py` | Backfill missing jobs/tables from lineage |
| `server/graph/builder.py` | Builds NetworkX graph from all sources, adds all edge types |
| `server/graph/schema.py` | Node colors & icons |
| `server/graph/cost_enricher.py` | DBU spend attribution via BFS |
| `server/graph/annotation_store.py` | Delta-backed tags & notes |
| `server/preflight.py` | Pre-flight permission checks |
| `frontend/src/stores/graphStore.ts` | Zustand state management, all TypeScript interfaces |
| `frontend/src/components/Canvas/index.tsx` | ReactFlow graph, layouts, search filtering, edge styling |
| `frontend/src/components/Sidebar/index.tsx` | Search, filters, health panel, stats |
| `frontend/src/components/DetailPanel/index.tsx` | Asset details, usage, cost, UC tags, connections |
| `frontend/src/components/SettingsPanel/index.tsx` | Config, warehouse, catalog scope, advanced limits |
| `frontend/src/components/EdgeLegend/index.tsx` | Edge type legend |
| `lattice_config.json` | User-persisted settings (excluded from sync/git) |

---

## Current Asset Coverage

### Node Types (23)
Catalog, ForeignCatalog, Schema, Table, View, Model, Volume, StreamingTable,
MaterializedView, Warehouse, Serverless, Cluster, Job, Dashboard, App, Pipeline,
Connection, Share, Recipient, Database, ServingEndpoint, VectorSearchIndex, GenieSpace

### Edge Types (16+)
contains, runsOn, queries, feedsInto, writesTo, readsFrom, derivedFrom,
triggers, uses, exposes, includes, serves, indexesFrom, embeddedBy

### Enrichment Data on Nodes

**Tables/Views:**
- `heat` (hot/warm/cold), `last_queried`, `query_count_30d`, `days_since_query`
- `num_rows`, `size_mb`
- `uc_tags` (array of {key, value})
- `owner`, `comment`, `created_at`, `updated_at`
- `source_tables` (view dependencies - array of FQNs)

**Jobs:**
- `total_runs_30d`, `success_runs_30d`, `success_rate_pct`, `last_run`
- `dbu_30d`, `heat`

**Warehouses/Clusters/Serverless:**
- `dbu_30d`, `heat`

**Cost Attribution (from `/api/cost`):**
- `direct_dbu`, `attributed_dbu`, `total_dbu`, `cost_rank_pct`, `top_consumers`

**Health (from `/api/health`):**
- `orphaned_count`, `unowned_count`, `orphaned[]`, `unowned[]`

---

## Configurable Limits

| Setting | Default | Max | Env var | UI location |
|---------|---------|-----|---------|-------------|
| Tables / schema | 50 | 1,000 | `LATTICE_TABLE_LIMIT` | Settings → Catalog Scope |
| Schemas / catalog | 20 | 500 | `LATTICE_SCHEMA_LIMIT` | Settings → Catalog Scope |
| Jobs | 200 | 200 | -| Not yet configurable |
| Lineage query limit | 10,000 | 100,000 | `LATTICE_LINEAGE_QUERY_LIMIT` | Settings → Advanced |
| Job backfill limit | 500 | 5,000 | `LATTICE_LINEAGE_BACKFILL_JOBS` | Settings → Advanced |
| Table backfill limit | 2,000 | 20,000 | `LATTICE_LINEAGE_BACKFILL_TABLES` | Settings → Advanced |

---

## Known Limitations

- ReactFlow performs well up to ~2,000–3,000 visible nodes; clips at 2,000
- `system.query.history` only captures SQL warehouse queries - Spark-only tables appear "cold"
- Lineage uses a 30-day window - monthly pipelines may be missing
- Cost attribution is BFS-based (directional, not per-query)
- Job reliability is noisy (includes retries, cancels, dev/test)
- UC tags and column lineage require grants; silently empty if unavailable
- UC `owner` field is often creator or service principal, not business owner
- `frontend/dist/` must be committed for git-based deploys

---

## Positioning (within Databricks FE Ontology Projects)

Lattice is the **operational layer** of the Databricks ontology stack. Other projects
focus on different layers:

| Project | Layer | Focus |
|---------|-------|-------|
| **Ontos** | Business semantics | Data products, contracts, data mesh, RDF ontologies |
| **OntoBricks** | Business knowledge graph | Visual business relationship design, Q&A |
| **OntoFlow** | Business workflow | Business entities → stored procedures |
| **Vibe Modeling** | Data modeling | Graph-ready business data models |
| **System Tables KG** | Infrastructure | System tables → RDF triples |
| **sparql2sql** | Query translation | SPARQL → SQL over triple tables |
| **spark-r2r** | ETL | R2RML-style tabular → graph transforms |
| **Tagsonomy** | Taxonomy | RDFS/SKOS taxonomies → UC tags, MCP server |
| **Lattice** | **Operational intelligence** | Discovers actual workspace state - what exists, how connected, what it costs, health |

### Key Differentiators
1. **Discovery-first** - zero upfront modeling; ontology is generated from APIs
2. **Operational enrichment** - cost, lineage, health, not business semantics
3. **Visual-first** - interactive canvas, not API-only or notebook-based
4. **Broadest coverage** -23 node types across UC, compute, AI/ML, federation
5. **Zero infrastructure** - single Databricks App, no triplestore

### Integration Opportunities
- Could consume RDF triples from System Tables KG
- Could read tags authored by Ontos/Tagsonomy for filtering/scoring
- OntoBricks business layer could sit on top of Lattice's operational graph

---

## Workspace Governance Scorecard

**Full spec:** See `docs/SPEC_DATA_QUALITY_SCORECARD.md` for the complete implementation spec.

### Summary

Header badge (`[B 68 ▲+3]`) + slide-out panel with dimensions, offenders, per-catalog breakdown, and Workspace Structure insights.

### Scored Dimensions (5)

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 1 | **Freshness** | 35% | % tables queried/modified within 30d |
| 2 | **Cost Efficiency** | 25% | % DBU not wasted on cold assets |
| 3 | **Orphan Rate** | 20% | % tables with ≥1 non-structural edge |
| 4 | **UC Tag Coverage** | 10% | % tables with ≥1 UC tag |
| 5 | **Compute Utilization** | 10% | % warehouses/clusters with activity in 30d |

### Dropped from Scoring (offenders list only)
- Job Reliability (noisy), Lineage Coverage (blind spots), Documentation (presence ≠ quality)

### Offender Categories (7)
Cold+Costly Tables, Idle Compute, Orphaned Tables, Untagged Tables, Failing Jobs, Stale Jobs, Undocumented Tables

### Workspace Structure (not scored, observational)
Oversized schemas, tables in `default`, empty schemas, single-table schemas, catalog concentration

### Grade Brackets
A (80–100), B (65–79), C (50–64), D (35–49), F (0–34)

### Estimated Effort
~660 lines total: `scorecard.py` (~250), `ScorecardPanel.tsx` (~300), badge + wiring (~110)

---

## Git Remotes

- `field-eng` → https://github.com/databricks-field-eng/lattice.git (internal)
- `origin` → https://github.com/mike-kahn_data/lattice.git (internal)
- Public → https://github.com/mkahn5/lattice (synced via `lattice-sync-public`)
- **Always push to BOTH remotes, then run `lattice-sync-public`**
- **All docs/frontend links must use `mkahn5/lattice`, never `databricks-field-eng/lattice`**

---

## Local Dev

```bash
cd ~/projects/lattice && DATABRICKS_PROFILE=e2-demo-west .venv/bin/python - m uvicorn app:app --host 0.0.0.0 --port 8000
# http://localhost:8000

# Frontend dev (hot reload):
cd frontend && npm run dev
# http://localhost:5173
```
