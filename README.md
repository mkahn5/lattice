```
    __          __  __  _
   / /   ____ _/ /_/ /_(_)_______
  / /   / __ `/ __/ __/ / ___/ _ \
 / /___/ /_/ / /_/ /_/ / /__/  __/
/_____/\__,_/\__/\__/_/\___/\___/

  Visual Intelligence for Databricks

     ┌──────────┐
     │ Catalog  │
     └────┬─────┘
    ┌─────┴─────┐
    │  Schema   │
    └──┬─────┬──┘
  ┌────┴──┐ ┌┴────────┐    ┌───────────┐    ┌───────────┐
  │ Table │ │  View   │<───│ Dashboard │───>│ Warehouse │
  └─┬──┬──┘ └─────────┘    └───────────┘    └─────┬─────┘
    │  │ feedsInto                ▲                 │
    │  v                         │ queries          │ runsOn
    │ ┌───────┐    ┌───────┐  ┌──┴────┐       ┌────┴──────┐
    │ │ Table │<───│  Job  │─>│Cluster│       │GenieSpace │
    │ └───────┘    └───────┘  └───────┘       └───────────┘
    │              writesTo    runsOn
    │ indexesFrom
    v                  serves          embeddedBy
  ┌──────────────┐   ┌────────────────┐   ┌───────┐
  │ VectorSearch │──>│ServingEndpoint │──>│ Model │
  └──────────────┘   └────────────────┘   └───────┘
```

# Lattice

**Ontology and visual intelligence platform for Databricks workspaces.**

Lattice builds a live ontology of your Databricks environment — every Unity Catalog asset, compute resource, job, dashboard, app, serving endpoint, vector search index, Genie space, and connected system mapped as typed entities with semantic relationships, enriched with operational intelligence from system tables. Built for data teams and AI agents alike.

![Stack](https://img.shields.io/badge/React-19-blue) ![Stack](https://img.shields.io/badge/FastAPI-0.115-green) ![Stack](https://img.shields.io/badge/NetworkX-3.x-orange) ![Stack](https://img.shields.io/badge/Databricks_SDK-0.40+-red)

**Created by** Mike Kahn — [mike.kahn@databricks.com](mailto:mike.kahn@databricks.com)

---

## Screenshots

### Main Canvas — Full Graph View
![Main Canvas](docs/screenshots/01-main-canvas.png)
*3,630 assets mapped across 23 node types with activity timeline, health panel, and type filters.*

### Detail Panel — Asset Intelligence
![Detail Panel](docs/screenshots/02-detail-panel.png)
*Select any node to see properties, connections, cost attribution, and impact analysis.*

### Settings — Catalog Scope & System Access
![Settings](docs/screenshots/04-settings.png)
*Configure catalog scope, scale limits, and view system access pre-flight checks.*

### Swimlane Layout — Grouped by Type
![Swimlane](docs/screenshots/05-swimlane.png)
*Swimlane layout groups UC data assets, compute resources, and apps into horizontal lanes.*

### Compute View — Apps, Warehouses & Clusters
![Compute View](docs/screenshots/06-compute-view.png)
*Compute view shows Databricks Apps, SQL Warehouses, Serverless compute, and their relationships.*

### UC Tree — Catalog Hierarchy
![UC Tree](docs/screenshots/08-uc-tree.png)
*UC Tree view shows the Catalog → Schema → Table hierarchy with heat dots and ownership.*

---

## Use Cases

### Identifying Costs — Warehouse DBU Heatmap
![Cost Overlay](docs/screenshots/14-compute-cost.png)
*Enable the cost overlay to see a heatmap of DBU spend across warehouses and compute. Darker orange = higher 30-day spend. Click any warehouse to see its cost attribution breakdown in the detail panel.*

### Finding Dependencies — Impact Analysis
![Impact Analysis](docs/screenshots/10-impact-analysis.png)
*Select any asset and click "Analyze" to see its blast radius — which schemas, apps, dashboards, and jobs depend on it. Essential before making breaking changes.*

### Exploring Connections — Focus View
![Focus View](docs/screenshots/03-focus-view.png)
*Pull any asset out of the lane view and click "Focus" to arrange its connections — callers above, targets below. Here a single schema's 39 dependencies are isolated for analysis while the full 3,630-asset lane layout stays visible for context.*

### Filtering by Asset Type — Targeted Analysis
![Type Filter](docs/screenshots/04-type-filter.png)
*Toggle asset types in the sidebar to isolate specific categories. Here only Apps (300) and Databases (21) are active — 321 nodes out of 3,630 — revealing the "uses" relationships between deployed applications and their backing databases.*

### Multi-Workspace & Catalog Switcher
![Workspace Switcher](docs/screenshots/05-workspace-catalog-switcher.png)
*Switch between workspace profiles to analyze different environments (dev, staging, prod) without restarting. The catalog selector below lets you scope the graph to specific catalogs — with live search across 200+ catalogs including foreign and Delta Sharing sources.*

### Save View — Export PNG, JSON & CSV
![Save View](docs/screenshots/15-save-view.png)
*Click "Save View" to freeze the current canvas into a side-by-side comparison pane. Export as high-resolution PNG (4x) for presentations, JSON for programmatic analysis, or CSV for a tabular export of all filtered assets — ready for spreadsheet analysis, stakeholder reviews, and cross-team collaboration.*

### Detecting Orphaned Assets — Health Panel
![Health Panel](docs/screenshots/09-health-orphans.png)
*The Health panel surfaces orphaned tables (zero queries in 30 days) and active assets with no owner. Click any item to navigate directly to it on the canvas.*

### Cost Attribution — Per-Asset Spend
![Cost Detail](docs/screenshots/12-cost-overlay.png)
*With cost overlay enabled, every node shows its attributed DBU spend. The detail panel breaks down cost sources — which warehouses and jobs drive spend for a given table.*

### Activity Timeline — Identifying Inactive Resources
![Activity Timeline](docs/screenshots/16-activity-timeline-7d.png)
*Use the activity timeline filter (7d, 30d, 90d, 1y) to highlight recently active assets and dim inactive ones. A notification above the canvas confirms the filter is active. Dimmed nodes with dashed borders have had zero activity in the selected window — ideal for identifying stale tables, unused schemas, and candidates for cleanup.*

### Data Governance — Ownership & Compliance
![Data Governance](docs/screenshots/17-data-governance.png)
*Lattice provides a comprehensive governance toolkit for data architects and platform teams:*

- **Orphan detection** — The Health panel identifies cold tables (zero queries in 30 days) and active assets with no owner, exportable to CSV for audit workflows
- **Impact analysis** — Select any asset and click "Analyze" to see its full blast radius — every downstream schema, table, job, and dashboard that depends on it. Essential before making breaking changes
- **Activity heat classification** — Every table is classified as hot (queried in 7d), warm (7–30d), or cold (30d+) based on `system.query.history`, with heat dots visible directly on the canvas
- **Cost-aware governance** — Per-asset DBU attribution traces compute spend from warehouses and jobs through lineage to the tables and schemas that drive it, helping teams prioritize optimization and decommissioning decisions

---

## What It Does

- **Models** your workspace as a live ontology — typed entities (23 node types) with semantic relationships (15+ edge types), forming a complete platform knowledge graph
- **Discovers** every asset — catalogs, schemas, tables, views, models, volumes, warehouses, clusters, jobs, dashboards, apps, pipelines, Delta Shares, foreign catalogs, Lakebase databases, model serving endpoints, vector search indexes, and Genie spaces
- **Connects** them with structural, compute, lineage, AI, and federation edges that carry meaning (contains, runsOn, queries, feedsInto, writesTo, readsFrom, serves, indexesFrom, embeddedBy)
- **Enriches** with system table data — DBU spend, query frequency, heat (last-accessed age), job success rates, storage size
- **Visualizes** the ontology on an interactive canvas with multiple layout modes, search, filters, and drill-down
- **Analyzes** cost attribution, impact/blast radius, orphaned assets, and column-level lineage
- **Annotates** with persistent tags and notes backed by a Delta table
- **Exports** as JSON or JSON-LD (semantic web vocabulary) for downstream consumption by AI agents

---

## Features

### Graph & Canvas
- **23 node types:** Catalog, ForeignCatalog, Schema, Table, View, Model, Volume, StreamingTable, MaterializedView, Warehouse, Serverless, Cluster, Job, Dashboard, App, Pipeline, Connection, Share, Recipient, Database, ServingEndpoint, VectorSearchIndex, GenieSpace
- **15+ edge types:** contains, runsOn, queries, feedsInto, writesTo, readsFrom, triggers, uses, exposes, includes, serves, indexesFrom, embeddedBy
- **3 layout modes:** Tree (top-down), Tree (left-right), Swimlane (grouped by type)
- **Schema collapse/expand** to manage large catalogs
- **Search** across name, FQN, comment, and owner
- **Type filter** sidebar to show/hide node categories
- **Freshness filter** — slider to show only assets active within N days
- **Focus Neighbors** — radial layout around a selected node with direct connections
- **Save View** — freeze canvas to a comparison pane at exact viewport/zoom
- **PNG export** (4x resolution) and **JSON export** from frozen pane
- **Console URL links** on every node — click to open in Databricks

### Intelligence
- **Heat dots** on nodes: green (hot, ≤7d), amber (warm, ≤30d), gray (cold)
- **DBU badges** — 30-day compute spend shown inline on node tiles
- **Cost overlay** — DBU attribution from compute → lineage → tables, rolled up to schema and catalog
- **Health panel** — detects orphaned tables (cold + 0 queries in 30d) and unowned assets
- **Impact analysis** — BFS traversal showing "depends on this" (consumers) and "contained within" (descendants)
- **Column lineage** — source_table.source_col → target_col, from `system.access.column_lineage`

### Lineage
- **Table lineage** from `system.access.table_lineage` — feedsInto, writesTo, readsFrom edges (blue dashed, toggleable)
- **Dashboard → Table** lineage — SQL parsed from Lakeview dataset specs; external tables create stub nodes (dashed border)
- **Column lineage** — per-column source tracing in the detail panel

### Annotations (Delta-backed)
- **Tags:** built-in (critical, pii, needs-migration, under-review, deprecated, verified) + custom
- **Notes:** free-text per asset (up to 2000 chars)
- **Bulk tagging** across multiple nodes via multi-select
- **UC tag sync** — optionally writes `lattice_`-prefixed tags back to Unity Catalog native tags
- **Persistent** — stored in `lattice.metadata.annotations` Delta table, survives redeploys

### AI/ML Stack
- **Model Serving Endpoints** — AI Gateway and custom model serving, linked to UC registered models
- **Vector Search Indexes** — indexes linked to source tables and embedding endpoints (RAG pipeline visibility)
- **Genie Spaces** — AI/BI rooms linked to warehouses and configured tables

### Federation & Connected Systems
- **Foreign catalogs** (Snowflake, PostgreSQL, MySQL connections)
- **Delta Sharing** — Shares, Recipients, included tables
- **Lakebase** — Database instances linked to apps and catalogs
- **Pipelines** — DLT and Autoloader pipelines

### Multi-Workspace
- **Workspace profiles** — add workspaces via Settings or the setup wizard (name + host + PAT), stored in `lattice_config.json`
- **Profile switcher** — switch between workspaces in the sidebar without restarting; supports PAT-based profiles, CLI profiles from `~/.databrickscfg`, and the primary app workspace
- **Test connection** — validate credentials before saving a profile
- **Catalog selector** — live search with 200-limit dropdown
- **Progress polling** — non-blocking ingestion banner during workspace switch

### Export
- **JSON** — full graph with nodes, edges, and enrichment stats
- **JSON-LD** — RDF-compatible format with `@context`, `@id`, `@type` for AI agent consumption (`GET /api/export/jsonld`)

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

## Requirements

### Minimum (canvas + topology)

| Requirement | Details |
|---|---|
| **Databricks workspace** | Unity Catalog enabled |
| **Databricks Apps** | Enabled on the workspace (serverless) |
| **Workspace access** | Permission to create Databricks Apps |
| **GitHub PAT** | Read-only access to the Lattice repo |

With just these, Lattice discovers and visualizes all UC assets, compute resources, jobs, dashboards, apps, serving endpoints, vector search indexes, and Genie spaces — full topology, search, filtering, layout modes, focus view, and export.

### Full features (mapped to requirements)

| Feature | Requires | System table |
|---|---|---|
| **Canvas + topology** | Workspace + Apps | — |
| **Search, filter, focus** | Workspace + Apps | — |
| **Workspace switching** | Multiple CLI profiles or Apps | — |
| **Catalog switching** | `USE CATALOG` on target catalogs | — |
| **Cost overlay & DBU badges** | SQL warehouse | `system.billing.usage` |
| **Heat dots (hot/warm/cold)** | SQL warehouse | `system.query.history` |
| **Orphan detection** | SQL warehouse | `system.query.history` |
| **Table lineage edges** | SQL warehouse | `system.access.table_lineage` |
| **Column-level lineage** | SQL warehouse | `system.access.column_lineage` |
| **Job success rates** | SQL warehouse | `system.lakeflow.job_run_timeline` |
| **Row counts & table sizes** | SQL warehouse | `system.information_schema.table_storage_utilization` |
| **Annotations (tags & notes)** | SQL warehouse + CREATE TABLE on `lattice.metadata` | — |
| **App sharing** | Set **Can Use** permission on the app for workspace users | — |

> **Graceful degradation:** Every system table feature is optional. If a warehouse isn't configured or a grant is missing, that feature is disabled and the rest of the app works normally. Check **Settings → System Access** inside Lattice for per-feature status.

---

## Quick Start — Deploy as a Databricks App

### 1. Fork the repo

Databricks Apps requires you to deploy from a repo you own. Fork the Lattice repo to your GitHub account:

1. Go to [github.com/databricks-field-eng/lattice](https://github.com/databricks-field-eng/lattice)
2. Click **Fork** (top right) → create the fork under your account
3. Create a [fine-grained personal access token](https://github.com/settings/tokens?type=beta) with **Contents → Read-only** on your fork

### 2. Create the app

In your Databricks workspace: **Compute → Apps → Create App**

| Setting | Value |
|---|---|
| **Name** | `lattice` |
| **Source** | Git repository |
| **Repo URL** | `https://github.com/<your-username>/lattice.git` |
| **Branch** | `main` |

During setup, enter your **GitHub username + PAT** when prompted for Git credentials, and select a **SQL warehouse** (required for cost, lineage, heat, and orphan detection features).

### 3. Check system table access (optional)

On many workspaces, the app service principal inherits system table access automatically — no explicit grants needed. After launch, check **Settings → System Access** inside Lattice to see which features are active.

If features show as unavailable, an **account admin** can grant access to the `system` catalog. See [INSTALL.md](INSTALL.md) for the full grant SQL. This step can be skipped — the canvas and all core features work without it.

### 4. Set app permissions

Go to **Compute → Apps → lattice → Permissions**. Add **All workspace users** with the **Can Use** role to share Lattice across your organization. Without this, only the app creator can access it.

### 5. Open Lattice

Go to **Compute → Apps → lattice**. Once the status shows **Running**, click the app URL link next to the status badge to launch Lattice. The first-run wizard will guide you through catalog selection, workspace profiles, and system access checks.

> **First load:** The initial ingestion discovers all workspace assets and queries system tables for usage, lineage, and cost data. This typically takes **30–90 seconds** depending on workspace size. Subsequent loads are faster thanks to caching — the cached graph loads instantly while a background refresh runs.

### 6. Add additional workspaces (optional)

Connect Lattice to other Databricks workspaces (dev, staging, production) to switch between them without redeploying.

1. In the target workspace: go to **Settings → Developer → Access tokens**
2. Click **Generate new token**, set a description (e.g. `lattice`) and expiration
3. Copy the token value
4. In Lattice: open **Settings** (gear icon) → **Workspace Profiles** → click **Add**
5. Enter a profile name (e.g. `production`), the workspace host URL, and paste the token
6. Click **Test connection** to verify, then **Save**

The workspace switcher appears in the sidebar once you have 2+ profiles. Click any profile to switch — Lattice re-ingests the new workspace automatically.

> You can also add workspaces during the first-run setup wizard (step 3).

### Run Locally (development)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABRICKS_PROFILE=my-workspace
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

See [INSTALL.md](INSTALL.md) for full setup details including warehouse configuration options, all required grants, and environment variables.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABRICKS_PROFILE` | — | CLI profile name (local dev) |
| `DATABRICKS_HOST` | — | Workspace host URL (local dev) |
| `DATABRICKS_TOKEN` | — | PAT (local dev) |
| `DATABRICKS_WAREHOUSE_ID` | — | SQL warehouse for system table queries |
| `LATTICE_CATALOGS` | (all) | Comma-separated catalog filter |
| `LATTICE_CATALOG_LIMIT` | 20 | Max catalogs when no filter set |
| `LATTICE_SCHEMA_LIMIT` | 20 | Schemas per catalog |
| `LATTICE_TABLE_LIMIT` | 50 | Tables per schema |
| `LATTICE_MODEL_LIMIT` | 200 | Max ML models |
| `LATTICE_PIPELINE_LIMIT` | 200 | Max pipelines |
| `LATTICE_ANNOTATIONS_CATALOG` | lattice | Annotations table catalog |
| `LATTICE_ANNOTATIONS_SCHEMA` | metadata | Annotations table schema |

### In-App Settings

After first launch, configure catalog scope, limits, and warehouse in **Settings** (gear icon) — no redeploy needed.

---

## API Reference

### Graph Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/graph` | Full graph (nodes + edges), filtered by view mode |
| GET | `/api/nodes/{id}` | Single node + connected edges + column lineage |
| GET | `/api/nodes/{id}/descendants` | All reachable FQNs via "contains" edges |
| GET | `/api/impact?node_id={id}` | Impact analysis: consumers + contained assets |
| GET | `/api/search?q={query}` | Full-text search across name, FQN, comment, owner |
| POST | `/api/refresh` | Manual re-ingest (10s cooldown) |

### Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Current settings |
| POST | `/api/config` | Save settings (merge), triggers re-ingest if scope changed |
| GET | `/api/info` | Workspace host, catalog filter, ingestion status |
| POST | `/api/switch` | Switch profile/catalog + re-ingest (10s cooldown) |
| GET | `/api/profiles` | List all workspace profiles (primary + stored + CLI) |
| POST | `/api/profiles` | Create or update a stored workspace profile |
| DELETE | `/api/profiles/{name}` | Delete a stored workspace profile |
| POST | `/api/profiles/test` | Test workspace credentials before saving |
| GET | `/api/catalogs` | List catalogs with search + active filter |

### Enrichment & Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress` | Ingestion step, % complete, graph_ready flag |
| GET | `/api/status` | Pre-flight check results (warehouse, grants, features) |
| GET | `/api/health` | Orphaned & unowned asset counts |
| GET | `/api/cost` | Cost attribution summary + per-node DBU spend |

### Annotations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/annotations` | All annotations + tag vocabulary + tag config |
| POST | `/api/annotations/{fqn}` | Upsert tags + note for a node |
| POST | `/api/annotations/bulk` | Bulk tag multiple FQNs |
| DELETE | `/api/annotations/{fqn}` | Delete annotation |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export` | Download graph as JSON |
| GET | `/api/export/jsonld` | Download graph as JSON-LD (AI/agent format) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ReactFlow Canvas │ Sidebar │ DetailPanel │ Settings     │
│  Zustand Store    │ Tailwind CSS │ Lucide Icons          │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API
┌──────────────────────────┴──────────────────────────────┐
│                   FastAPI Backend                         │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Connectors  │  │ Graph Engine │  │ Annotation     │  │
│  │  (13 sources)│──│ (NetworkX)   │──│ Store (Delta)  │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Preflight   │  │ Cost         │  │ Config         │  │
│  │  Checks      │  │ Enricher     │  │ Persistence    │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ Databricks SDK + SQL
┌──────────────────────────┴──────────────────────────────┐
│              Databricks Workspace                        │
│  Unity Catalog │ Compute │ Jobs │ Dashboards │ System    │
│  Apps │ Shares │ Pipelines │ Serving │ VectorSearch │Genie│
└─────────────────────────────────────────────────────────┘
```

### Ingestion Flow
1. Load cached graph immediately (instant canvas)
2. Fetch all connectors in parallel with 45s timeout each
3. Publish partial graph while slower connectors finish
4. Fetch system table enrichment (usage, heat, lineage, cost)
5. Build full NetworkX graph + compute cost attribution
6. Merge annotations + cache to disk

### Security
- Input validation: catalog/profile names validated against strict regex
- Rate limiting: 10s cooldown on `/api/refresh` and `/api/switch`
- Path traversal protection on all user inputs
- Generation counter prevents stale ingestion data from overwriting newer state

---

## Release Notes

### v0.5.3 — View Dependency Edges (Mar 20, 2026)
- **View → Table edges:** New `derivedFrom` edge type shows which source tables a view is built from. Includes chained view→view→table relationships.
- **Automatic dependency resolution:** View dependencies resolved via `tables.get()` API in parallel after the main catalog fetch. Only creates edges when both the view and its source table are in the graph.
- **Edge styling:** `derivedFrom` edges render in cyan (#06b6d4) with solid lines, distinct from lineage edges.
- **Edge legend updated:** New `derivedFrom` entry in the Edge Types panel.

### v0.5.2 — AI/ML Stack Connectors (Mar 19, 2026)
- **Model Serving Endpoints:** Discovers all Model Serving and AI Gateway endpoints. Links each endpoint to the UC registered models it serves via `serves` edges. Shows endpoint state and creator.
- **Vector Search Indexes:** Discovers all Vector Search indexes across endpoints. Links each index to its source Delta table (`indexesFrom`) and embedding model endpoint (`embeddedBy`). Surfaces index type and sync status.
- **Genie Spaces:** Discovers all Genie AI/BI rooms. Links each space to its SQL warehouse (`runsOn`) and configured tables (`queries`). Shows space description and creator.
- **23 node types** (up from 20): ServingEndpoint, VectorSearchIndex, GenieSpace join the graph alongside all existing UC, compute, and federation types.
- **15+ edge types** (up from 10+): New relationships — `serves`, `indexesFrom`, `embeddedBy` — complete the AI stack path: Table → VectorSearchIndex → ServingEndpoint → Model, plus Genie → Warehouse/Table.
- **Full AI pipeline visibility:** See the complete path from source tables through vector indexes and embedding endpoints to serving endpoints and Genie spaces — all in a single graph.
- **Graceful fallback:** All three connectors run in the parallel fetch pool with 45s timeouts. If an API isn't available on a workspace (e.g., no Vector Search provisioned), that connector returns empty and the rest of the graph loads normally.
- **Console URL links:** ServingEndpoint nodes link to `/ml/endpoints/{name}`, GenieSpace nodes link to `/genie/rooms/{id}`.
- **Swimlane & type filters updated:** New types appear in the correct lanes — VectorSearchIndex in the UC group, ServingEndpoint and GenieSpace in the Compute group.
- **Edge legend updated:** Three new edge types (serves, indexesFrom, embeddedBy) appear in the Edge Types panel with matching colors.

### v0.5.1 — Multi-Workspace & Screenshots (Mar 18, 2026)
- **Workspace profiles in Settings:** Add, edit, test, and delete workspace profiles (name + host + PAT) directly in the Settings UI. Profiles stored in `lattice_config.json` alongside CLI profiles from `~/.databrickscfg`.
- **Setup wizard — Workspaces step:** New step 3 in the first-run wizard lets users add additional workspaces during initial setup.
- **Workspace switcher improvements:** Primary workspace always visible, spinner during switch, click-outside to close dropdown, PAT/APP/CLI source badges.
- **Seamless workspace switching:** Canvas clears immediately on switch, progress section shows real-time ingestion steps (Connect → Compute → UC → Lineage → Build), cached workspaces load instantly on repeat visits.
- **Per-workspace caching:** Each workspace's graph is cached separately by profile name. Switching to a previously visited workspace serves the cached graph in ~500ms while a background refresh runs.
- **Auth isolation:** Stored PAT profiles override Databricks App auto-injected credentials. Env vars (CLIENT_ID/SECRET) temporarily cleared during PAT auth to prevent SDK conflicts.
- **Autocomplete suppressed:** Profile forms no longer trigger browser password manager prompts.
- **Progress polling:** Sidebar ingestion status and App-level poller now run continuously, detecting workspace switches and updating in real-time.
- **Screenshot refresh:** Retook 6 screenshots — main canvas (bird's eye), swimlane (wider zoom), focus view (schema with 15+ connections), health/orphans (30d active vs dimmed), cost overlay (warehouse DBU heatmap with attribution), activity timeline (30d filter), settings (redacted hostname).
- **Documentation:** Added 30–90 second first-load timing note, step-by-step PAT instructions (Settings → Developer → Access tokens), workspace profiles setup guide in both README and INSTALL.md.

### v0.5.0 — Deployment & Canvas UX (Mar 17–18, 2026)
- **Databricks Apps deployment:** Git-based deployment with GitHub PAT, SQL warehouse resource injection, and `.venv/bin/python3` fix for uvicorn module resolution.
- **Frontend included in repo:** `frontend/dist/` committed so Git-based deployments work without Node.js in the app runtime.
- **Auto-reflow on search:** Typing in the search box now resets layout and zooms to filtered results automatically — no need to click a layout button.
- **Auto-reflow on type filter:** Clicking asset types in the sidebar re-layouts and zooms to the filtered nodes instantly.
- **Smart layout preservation:** When nodes have been manually arranged (drag or Focus), filter/search changes preserve positions instead of hard-resetting. A "Reset layout of filtered view" button appears to re-layout on demand.
- **Volume console links:** Volume nodes now show the "Open in Databricks" link (Catalog Explorer URL).
- **Database owner field:** Database nodes now capture owner (from SDK or app creator fallback) and display it in the detail panel.
- **Ontology positioning:** README, INSTALL, and demo script updated to position Lattice as an ontology platform. Phase 6 roadmap updated to "Ontology writeback."
- **Requirements section:** Feature-to-requirement mapping showing minimum vs full requirements.
- **Installation guide rewrite:** Step-by-step Databricks Apps deployment with GitHub PAT, warehouse config, system table grants (account admin clarification), and app permissions.
- **Troubleshooting guide rewrite:** Covers uvicorn module error, frontend 404, system catalog PERMISSION_DENIED, partial system table access, and non-fatal log warnings.

### v0.4.0 — Intelligence Layer (Mar 13, 2026)
- **Health panel:** Detects orphaned tables (cold + 0 queries in 30d) and unowned assets. Collapsible sidebar section with clickable node list.
- **Impact analysis:** "Analyze" button on any node triggers BFS — shows "Depends on this" (consumers) and "Contained within" (descendants).
- **Column lineage:** Fetched from `system.access.column_lineage`, shown in detail panel as `target_col ← source_table.source_col`.
- **JSON-LD export:** `GET /api/export/jsonld` — full graph as JSON-LD with `@context`, `@id`, `@type` for AI agent consumption.
- **Terminated clusters filtered** from graph (TERMINATED, TERMINATING, ERROR states).
- **Ingestion hang fix:** Replaced blocking `ThreadPoolExecutor` context manager with explicit `shutdown(wait=False)`.
- **FitView on deselect:** Closing detail panel or clicking background animates canvas back to fit-all view.

### v0.3.0 — Security Hardening (Mar 12, 2026)
- **Input validation:** Catalog names, profile names, and host URLs validated against strict regex before use.
- **Rate limiting:** 10s cooldown on `/api/refresh` and `/api/switch` (returns 429 with retry hint).
- **Path traversal protection** on catalog/profile inputs.
- **Generation counter:** Superseded ingestion threads detect replacement and abort, preventing stale data overwrites.

### v0.2.1 — Canvas UX Improvements (Mar 12, 2026)
- **Position persistence:** Filter/type toggle changes no longer reset manual node positions.
- **Save View:** Freeze canvas to side-by-side comparison pane at exact viewport/zoom.
- **PNG export** (4x resolution) + **JSON export** from frozen comparison pane.
- **Focus Neighbors:** Radial ring layout around selected node with direct connections.
- **Profile switcher** + **Catalog selector** (live search, 200 limit, click-outside close).
- **Freshness filter:** Slider to show only nodes active within N days.
- **Multi-workspace switch** with progress polling + non-blocking IngestBanner.

### v0.2.0 — Enrichment & Lineage (Mar 11–12, 2026)
- **System table enrichment:** `system.billing.usage` (DBU 30d), `system.lakeflow.job_run_timeline` (run count + success rate), `system.query.history` (query count + last queried), `system.information_schema.table_storage_utilization` (row count + size MB).
- **Heat dots:** Green (hot ≤7d), amber (warm ≤30d), gray (cold).
- **DBU + query count** shown inline on node tiles.
- **Table lineage edges** from `system.access.table_lineage` — feedsInto, writesTo, readsFrom. Blue dashed edges, toggleable.
- **Dashboard → Table lineage:** SQL parsed from Lakeview dataset specs. External tables create stub nodes (dashed border).
- **Federation nodes:** ForeignCatalog, Connection, Share, Recipient + relationship edges.
- **Partial graph** published ~15s after startup while UC ingestion finishes.

### v0.1.0 — MVP (Mar 11, 2026)
- FastAPI backend + React/TypeScript/ReactFlow/Zustand/Tailwind frontend.
- **Unity Catalog connector:** Catalogs, schemas, tables, views, models.
- **Compute connector:** SQL warehouses + clusters.
- **Jobs connector:** Workflows with cluster_ids and serverless flag.
- **Dashboards connector:** Lakeview dashboards with warehouse_id.
- **Apps connector:** Databricks Apps + Lakebase Database instances.
- **NetworkX DiGraph** with structural, compute, and app edges.
- **Graph canvas:** Dagre hierarchical layout (tree-TB, tree-LR) + swimlane layout.
- **View modes:** UC (catalog tree only), Compute (warehouses/clusters/jobs/dashboards), All.
- **Schema collapse/expand**, node selection, zoom-to-node, zoom-to-fit.
- **Search** (name/FQN/comment/owner), type filter sidebar.
- **Console URL links** on all node types.
- **Detail panel:** Usage stats, properties, connections, referenced tables.
- **JSON export** + progress endpoint with `graph_ready` flag.
- **Disk cache** keyed by profile+catalog filter — loaded on startup for instant canvas, then refreshed live.

---

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | MVP: connectors, graph, canvas, search, export | Done |
| 2 | System table enrichment + lineage edges | Done |
| 3 | Security hardening + ingestion stability | Done |
| 4 | Intelligence: health, impact analysis, column lineage, JSON-LD | Done |
| 5 | First-run wizard, permissions checker, settings, bundle packaging | Done |
| 5.1 | Multi-workspace profiles, screenshots, UX polish | Done |
| 5.2 | AI/ML stack connectors: Serving Endpoints, Vector Search, Genie Spaces | Done |
| 10 | Annotation & Bookmarking: tags, notes, canvas dots, tag filter, multi-select, UC sync | Done |
| 6 | MCP server: expose graph as agent-callable tools (search, lineage, impact, orphans) | Planned |
| 7 | Automated architecture diagram export (Mermaid, draw.io, Lucidchart) | Planned |
| 8 | Governance scorecard: workspace health score with trend over time | Planned |
| 9 | Ontology writeback: edit owner, description, tags inline → write back to UC. Draft/publish workflow | Planned |

---

## Project Structure

```
lattice/
├── app.py                       # FastAPI entry point, ingestion orchestration
├── app.yaml                     # Databricks App deployment manifest
├── databricks.yml               # Databricks bundle configuration
├── requirements.txt             # Python dependencies
├── lattice_config.json          # User-persisted settings (excluded from sync)
├── INSTALL.md                   # Installation guide
├── TROUBLESHOOTING.md           # Diagnostics & common issues
├── server/
│   ├── config.py                # Workspace client setup, config I/O
│   ├── preflight.py             # Pre-flight permission checks
│   ├── api/
│   │   └── routes.py            # All API endpoints
│   ├── connectors/
│   │   ├── unity_catalog.py     # UC catalogs, schemas, tables, models, volumes
│   │   ├── compute.py           # Warehouses, clusters
│   │   ├── jobs.py              # Jobs (serverless + cluster-bound)
│   │   ├── dashboards.py        # Lakeview dashboards + table lineage
│   │   ├── apps.py              # Databricks Apps, Lakebase databases
│   │   ├── federation.py        # Connections, Delta Shares, Recipients
│   │   ├── pipelines.py         # DLT, Autoloader pipelines
│   │   ├── serving_endpoints.py # Model Serving / AI Gateway endpoints
│   │   ├── vector_search.py     # Vector Search indexes
│   │   ├── genie.py             # Genie spaces (AI/BI rooms)
│   │   └── system_tables.py     # System table queries
│   └── graph/
│       ├── builder.py           # Builds NetworkX graph from all sources
│       ├── schema.py            # Node colors & icons
│       ├── annotation_store.py  # Delta-backed tags & notes
│       └── cost_enricher.py     # DBU spend attribution
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx              # Root component
│   │   ├── stores/graphStore.ts # Zustand state management
│   │   ├── components/
│   │   │   ├── Canvas/          # ReactFlow graph + layouts
│   │   │   ├── Sidebar/         # Search, filters, health panel
│   │   │   ├── DetailPanel/     # Asset details, annotations, lineage
│   │   │   ├── SettingsPanel/   # Config, warehouse, catalog scope
│   │   │   ├── FirstRunWizard/  # Onboarding
│   │   │   ├── FreshnessFilter/ # Age filter
│   │   │   ├── IngestBanner/    # Progress indicator
│   │   │   └── EdgeLegend/      # Relationship type legend
│   │   ├── types/               # TypeScript interfaces
│   │   ├── utils/               # Helpers (cost colors, etc.)
│   │   └── constants/           # Tag config, display constants
│   └── dist/                    # Built output
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues including:
- Blank canvas on load
- Missing usage stats or heat dots
- Empty UC tree
- Warehouse not found
- System table permission errors

---

## Known Limitations

- Column-level cost attribution not yet supported (table-level only)
- Stub table nodes (from cross-catalog dashboard queries) have no visual legend
- Health panel orphan detection requires `system.query.history` access
- Column lineage requires `system.access.column_lineage` grant — silently returns empty if unavailable
- File-based JSON caching (not distributed)
