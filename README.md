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

Lattice builds a live ontology of your Databricks environment - every Unity Catalog asset, compute resource, job, dashboard, app, serving endpoint, vector search index, Genie space, and connected system mapped as typed entities with semantic relationships, enriched with operational intelligence from system tables. Built for data teams and AI agents alike.

![Stack](https://img.shields.io/badge/React-19-blue) ![Stack](https://img.shields.io/badge/FastAPI-0.115-green) ![Stack](https://img.shields.io/badge/NetworkX-3.x-orange) ![Stack](https://img.shields.io/badge/Databricks_SDK-0.40+-red)

**Created by** Mike Kahn -[mike.kahn@databricks.com](mailto:mike.kahn@databricks.com)

---

## Screenshots

### Main Canvas - Full Graph View
![Main Canvas](docs/screenshots/01-main-canvas.png)
*3,630 assets mapped across 23 node types with activity timeline, health panel, and type filters.*

### Detail Panel - Asset Intelligence
![Detail Panel](docs/screenshots/02-detail-panel.png)
*Select any node to see properties, connections, cost attribution, and impact analysis.*

### Settings - Catalog Scope & System Access
![Settings](docs/screenshots/04-settings.png)
*Configure catalog scope, scale limits, and view system access pre-flight checks.*

### Swimlane Layout - Grouped by Type
![Swimlane](docs/screenshots/05-swimlane.png)
*Swimlane layout groups UC data assets, compute resources, and apps into horizontal lanes.*

### Compute View - Apps, Warehouses & Clusters
![Compute View](docs/screenshots/06-compute-view.png)
*Compute view shows Databricks Apps, SQL Warehouses, Serverless compute, and their relationships.*

### UC Tree - Catalog Hierarchy
![UC Tree](docs/screenshots/08-uc-tree.png)
*UC Tree view shows the Catalog → Schema → Table hierarchy with heat dots and ownership.*

---

## Use Cases

### Identifying Costs - Warehouse DBU Heatmap
![Cost Overlay](docs/screenshots/14-compute-cost.png)
*Enable the cost overlay to see a heatmap of DBU spend across warehouses and compute. Darker orange = higher 30-day spend. Click any warehouse to see its cost attribution breakdown in the detail panel.*

### Finding Dependencies - Impact Analysis
![Impact Analysis](docs/screenshots/10-impact-analysis.png)
*Select any asset and click "Analyze" to see its blast radius - which schemas, apps, dashboards, and jobs depend on it. Essential before making breaking changes.*

### Exploring Connections - Focus View
![Focus View](docs/screenshots/03-focus-view.png)
*Pull any asset out of the lane view and click "Focus" to arrange its connections - callers above, targets below. Here a single schema's 39 dependencies are isolated for analysis while the full 3,630-asset lane layout stays visible for context.*

### Filtering by Asset Type - Targeted Analysis
![Type Filter](docs/screenshots/04-type-filter.png)
*Toggle asset types in the sidebar to isolate specific categories. Here only Apps (300) and Databases (21) are active -321 nodes out of 3,630 - revealing the "uses" relationships between deployed applications and their backing databases.*

### Multi-Workspace & Catalog Switcher
![Workspace Switcher](docs/screenshots/05-workspace-catalog-switcher.png)
*Switch between workspace profiles to analyze different environments (dev, staging, prod) without restarting. The catalog selector below lets you scope the graph to specific catalogs - with live search across 200+ catalogs including foreign and Delta Sharing sources.*

### Save View - Export PNG, JSON & CSV
![Save View](docs/screenshots/15-save-view.png)
*Click "Save View" to freeze the current canvas into a side-by-side comparison pane. Export as high-resolution PNG (4x) for presentations, JSON for programmatic analysis, or CSV for a tabular export of all filtered assets - ready for spreadsheet analysis, stakeholder reviews, and cross-team collaboration.*

### Detecting Orphaned Assets - Health Panel
![Health Panel](docs/screenshots/09-health-orphans.png)
*The Health panel surfaces orphaned tables (zero queries in 30 days) and active assets with no owner. Click any item to navigate directly to it on the canvas.*

### Cost Attribution - Per-Asset Spend
![Cost Detail](docs/screenshots/12-cost-overlay.png)
*With cost overlay enabled, every node shows its attributed DBU spend. The detail panel breaks down cost sources - which warehouses and jobs drive spend for a given table.*

### Activity Timeline - Identifying Inactive Resources
![Activity Timeline](docs/screenshots/16-activity-timeline-7d.png)
*Use the activity timeline filter (7d, 30d, 90d, 1y) to highlight recently active assets and dim inactive ones. A notification above the canvas confirms the filter is active. Dimmed nodes with dashed borders have had zero activity in the selected window - ideal for identifying stale tables, unused schemas, and candidates for cleanup.*

### Data Governance - Ownership & Compliance
![Data Governance](docs/screenshots/17-data-governance.png)
*Lattice provides a comprehensive governance toolkit for data architects and platform teams:*

- **Orphan detection** - The Health panel identifies cold tables (zero queries in 30 days) and active assets with no owner, exportable to CSV for audit workflows
- **Impact analysis** - Select any asset and click "Analyze" to see its full blast radius - every downstream schema, table, job, and dashboard that depends on it. Essential before making breaking changes
- **Activity heat classification** - Every table is classified as hot (queried in 7d), warm (7–30d), or cold (30d+) based on `system.query.history`, with heat dots visible directly on the canvas
- **Cost-aware governance** - Per-asset DBU attribution traces compute spend from warehouses and jobs through lineage to the tables and schemas that drive it, helping teams prioritize optimization and decommissioning decisions

---

## What It Does

- **Models** your workspace as a live ontology - typed entities (23 node types) with semantic relationships (16+ edge types), forming a complete platform knowledge graph
- **Discovers** every asset - catalogs, schemas, tables, views, models, volumes, warehouses, clusters, jobs, dashboards, apps, pipelines, Delta Shares, foreign catalogs, Lakebase databases, model serving endpoints, vector search indexes, and Genie spaces
- **Connects** them with structural, compute, lineage, AI, and federation edges that carry meaning (contains, runsOn, queries, feedsInto, writesTo, readsFrom, derivedFrom, serves, indexesFrom, embeddedBy)
- **Enriches** with system table data - DBU spend, query frequency, heat (last-accessed age), job success rates, storage size, UC tags
- **Visualizes** the ontology on an interactive canvas with multiple layout modes, search, filters, and drill-down
- **Analyzes** cost attribution, impact/blast radius, orphaned assets, and column-level lineage
- **Annotates** with persistent tags and notes backed by a Delta table (requires SQL warehouse + CREATE TABLE permission)
- **Exports** as JSON or JSON-LD (semantic web vocabulary) for downstream consumption by AI agents

---

## Features

### Graph & Canvas
- **23 node types:** Catalog, ForeignCatalog, Schema, Table, View, Model, Volume, StreamingTable, MaterializedView, Warehouse, Serverless, Cluster, Job, Dashboard, App, Pipeline, Connection, Share, Recipient, Database, ServingEndpoint, VectorSearchIndex, GenieSpace
- **16+ edge types:** contains, runsOn, queries, feedsInto, writesTo, readsFrom, derivedFrom, triggers, uses, exposes, includes, serves, indexesFrom, embeddedBy
- **3 layout modes:** Tree (top-down), Tree (left-right), Swimlane (grouped by type)
- **Schema collapse/expand** to manage large catalogs
- **Search** across name, FQN, comment, owner, and UC tags
- **Type filter** sidebar to show/hide node categories
- **Freshness filter** - slider to show only assets active within N days
- **Focus Neighbors** - radial layout around a selected node with direct connections
- **Save View** - freeze canvas to a comparison pane at exact viewport/zoom
- **PNG export** (4x resolution) and **JSON export** from frozen pane
- **Console URL links** on every node - click to open in Databricks

### Intelligence
- **Heat dots** on nodes: green (hot, ≤7d), amber (warm, ≤30d), gray (cold)
- **DBU badges** -30-day compute spend shown inline on node tiles
- **Cost overlay** - DBU attribution from compute → lineage → tables, rolled up to schema and catalog
- **Health panel** - detects orphaned tables (cold + 0 queries in 30d) and unowned assets
- **Impact analysis** - BFS traversal showing "depends on this" (consumers) and "contained within" (descendants)
- **Column lineage** - source_table.source_col → target_col, from `system.access.column_lineage`
- **UC tags** - ingested from `system.information_schema.table_tags`, displayed as pills in the detail panel, searchable in the canvas search box

### Lineage
- **Table → Table lineage** from `system.access.table_lineage` - feedsInto edges (blue dashed, toggleable)
- **Job → Table lineage** from `system.access.table_lineage` - writesTo and readsFrom edges show which jobs produce and consume which tables
- **View → Table dependencies** from UC `view_dependencies` API - derivedFrom edges (cyan solid) show which source tables a view is built from, including chained view→view→table relationships
- **Lineage-driven backfill** - jobs and tables referenced in lineage but not captured by the primary ingestion are automatically fetched so edges connect. This ensures the full Job → Table → View chain is visible
- **Dashboard → Table lineage** - SQL parsed from Lakeview dataset specs; external tables create stub nodes (dashed border)
- **Column lineage** - per-column source tracing in the detail panel

> **Lineage limitations:** Lineage data uses a 30-day window from `system.access.table_lineage` - infrequently-run pipelines (monthly jobs) may not have edges at the time of ingestion. `system.query.history` only captures SQL warehouse queries, so tables read exclusively via Spark clusters appear as "cold." Default ingestion limits cap the number of lineage rows, backfill jobs, and backfill tables - see [Known Limitations](#known-limitations) and **Settings → Advanced** to adjust.

### AI/ML Stack
- **Model Serving Endpoints** - AI Gateway and custom model serving, linked to UC registered models via `serves` edges
- **Vector Search Indexes** - indexes linked to source tables (`indexesFrom`) and embedding endpoints (`embeddedBy`) for RAG pipeline visibility
- **Genie Spaces** - AI/BI rooms linked to warehouses (`runsOn`) and configured tables (`queries`)

### Federation & Connected Systems
- **Foreign catalogs** (Snowflake, PostgreSQL, MySQL connections)
- **Delta Sharing** - Shares, Recipients, included tables
- **Lakebase** - Database instances linked to apps and catalogs
- **Pipelines** - DLT and Autoloader pipelines

### Multi-Workspace
- **Workspace profiles** - add workspaces via Settings or the setup wizard (name + host + PAT), stored in `lattice_config.json`
- **Profile switcher** - switch between workspaces in the sidebar without restarting; supports PAT-based profiles, CLI profiles from `~/.databrickscfg`, and the primary app workspace
- **Test connection** - validate credentials before saving a profile
- **Catalog selector** - live search with 200-limit dropdown
- **Progress polling** - non-blocking ingestion banner during workspace switch

### Export
- **JSON** - full graph with nodes, edges, and enrichment stats
- **JSON-LD** - RDF-compatible format with `@context`, `@id`, `@type` for AI agent consumption (`GET /api/export/jsonld`)

---

## Limitations & Scale

Lattice is designed for workspace exploration and governance - not as a real-time monitoring system for the largest Databricks deployments. Understanding the boundaries helps set expectations and configure the tool appropriately.

### What is a "node"?

Every asset Lattice discovers becomes a **node** on the graph - a catalog, schema, table, view, job, warehouse, dashboard, app, serving endpoint, etc. A single catalog with 10 schemas averaging 50 tables each produces ~510 nodes (1 catalog + 10 schemas + 500 tables) before counting compute, jobs, and other assets. A typical workspace with 2–3 catalogs, compute resources, and jobs lands in the 1,000–3,000 node range.

**Workspaces organized into catalogs work best with Lattice.** When data is organized into catalogs (e.g., `bronze`, `silver`, `gold` or by domain like `finance`, `marketing`), you can scope Lattice to specific catalogs in **Settings → Catalog Scope** to focus on the subset you care about. Workspaces where everything lives in a single catalog with hundreds of schemas are harder to navigate - consider using type filters and search to work with manageable subsets.

### Canvas Rendering

The frontend uses [ReactFlow](https://reactflow.dev/) to render the graph canvas. ReactFlow performs well up to ~2,000–3,000 visible nodes. Beyond that, interactions (pan, zoom, drag) become sluggish and layout calculations slow down.

| Workspace size | Expected experience |
|---------------|-------------------|
| < 1,000 nodes | Smooth - all layouts, search, and interactions feel instant |
| 1,000–3,000 nodes | Good - minor delay on layout changes, fully usable |
| 3,000–5,000 nodes | Usable - filter by type or catalog to reduce visible nodes for best performance |
| 5,000+ nodes | Use type filters, catalog scope, or search to work with subsets at a time |

Lattice clips rendering at 2,000 visible nodes and shows a notification when this limit is hit. Use type filters, catalog scope, or search to narrow the visible set.

### API & Ingestion Limits

Lattice applies default ingestion limits to balance coverage against API rate limits, ingestion time, and rendering performance. On large workspaces, defaults will capture a representative subset rather than the full workspace.

| Setting | Default | Max | Configurable in | What it controls |
|---------|---------|-----|-----------------|------------------|
| Tables / schema | 50 | 1,000 | Settings → Catalog Scope | Tables ingested per schema during primary UC scan |
| Schemas / catalog | 20 | 500 | Settings → Catalog Scope | Schemas ingested per catalog |
| Jobs | 200 | 200 | Not yet configurable | Jobs ingested from `jobs.list()` API |
| Lineage query limit | 10,000 | 100,000 | Settings → Advanced | Rows fetched from `system.access.table_lineage` |
| Job backfill limit | 500 | 5,000 | Settings → Advanced | Missing jobs fetched individually to complete lineage edges |
| Table backfill limit | 2,000 | 20,000 | Settings → Advanced | Missing tables fetched individually to complete lineage edges |

**How backfill works:** After fetching lineage from `system.access.table_lineage`, Lattice identifies jobs and tables that appear in lineage but weren't captured by the primary ingestion. It then fetches those missing nodes individually via `jobs.get()` and `tables.get()` so lineage edges can connect. This is subject to the backfill limits above.

**Example -20K table workspace:** With defaults (50 tables/schema, 10K lineage rows, 2K table backfill), Lattice would ingest ~1,000 tables from the primary scan + up to 2,000 more from backfill = ~3,000 of 20K tables. To increase coverage, raise the table limit and backfill limits in **Settings → Advanced**. Be aware this increases ingestion time (potentially 5–10 minutes) and may push past the ReactFlow rendering comfort zone.

### System Table Blind Spots

Several features depend on Databricks system tables that have inherent limitations:

| Limitation | Affected features | Cause |
|-----------|-------------------|-------|
| **Spark-only tables appear "cold"** | Heat dots, orphan detection, freshness filter | `system.query.history` only captures SQL warehouse queries. Tables read exclusively via Spark clusters or notebooks have no query history |
| **30-day lineage window** | Table lineage, Job→Table edges | `system.access.table_lineage` retains 30 days of data. Monthly or quarterly pipelines may not have edges at time of ingestion |
| **Cost attribution is directional** | Cost overlay, DBU attribution | Cost is attributed via BFS graph traversal, not per-query accounting. A warehouse serving 10 dashboards attributes its full DBU to all reachable tables, not proportionally |
| **Job reliability is noisy** | Job success rates | `system.lakeflow.job_run_timeline` counts all runs including expected failures (retries, conditional jobs, canceled runs, dev/test) |
| **UC tags require grants** | UC tag display and search | `system.information_schema.table_tags` requires SELECT access; silently returns empty if unavailable |
| **Column lineage requires grants** | Column-level lineage | `system.access.column_lineage` requires SELECT access; silently returns empty if unavailable |

### Other Limitations

- Column-level cost attribution not yet supported (table-level only)
- Stub table nodes created for cross-catalog dashboard references have no visual legend
- Annotations require a running SQL warehouse + CREATE TABLE permission on the annotations catalog
- File-based JSON caching (not distributed - each app instance has its own cache)
- The `owner` field on UC assets often reflects the creator or a service principal, not a business owner

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

With just these, Lattice discovers and visualizes all UC assets, compute resources, jobs, dashboards, apps, serving endpoints, vector search indexes, and Genie spaces - full topology, search, filtering, layout modes, focus view, and export.

### Full features (mapped to requirements)

| Feature | Requires | System table |
|---|---|---|
| **Canvas + topology** | Workspace + Apps | -|
| **Search, filter, focus** | Workspace + Apps | -|
| **View → Table edges** | Workspace + Apps | - (uses UC `view_dependencies` API) |
| **Workspace switching** | Multiple CLI profiles or Apps | -|
| **Catalog switching** | `USE CATALOG` on target catalogs | -|
| **Cost overlay & DBU badges** | SQL warehouse | `system.billing.usage` |
| **Heat dots (hot/warm/cold)** | SQL warehouse | `system.query.history` |
| **Orphan detection** | SQL warehouse | `system.query.history` |
| **Table & Job lineage edges** | SQL warehouse | `system.access.table_lineage` |
| **Column-level lineage** | SQL warehouse | `system.access.column_lineage` |
| **Job success rates** | SQL warehouse | `system.lakeflow.job_run_timeline` |
| **Row counts & table sizes** | SQL warehouse | `system.information_schema.table_storage_utilization` |
| **UC tags** | SQL warehouse | `system.information_schema.table_tags` |
| **Annotations (tags & notes)** | SQL warehouse + CREATE TABLE on `lattice.metadata` | -|
| **App sharing** | Set **Can Use** permission on the app for workspace users | -|

> **Graceful degradation:** Every system table feature is optional. If a warehouse isn't configured or a grant is missing, that feature is disabled and the rest of the app works normally. Check **Settings → System Access** inside Lattice for per-feature status.

---

## Quick Start - Deploy as a Databricks App

### Prerequisites

| Requirement | Details |
|---|---|
| **Databricks workspace** | Unity Catalog enabled, Databricks Apps enabled |
| **Permissions** | Can create Databricks Apps on the workspace |
| **GitHub account** | For forking the repo (Git-based deploy) |
| **Python** | 3.10+ (for local development only) |
| **Node.js** | 18+ (for local development / rebuilding frontend only) |

### Option A: Git-Based Deploy (recommended)

#### 1. Fork the repo

Fork Lattice so Databricks Apps can pull from a repo you control:

1. Go to [github.com/mkahn5/lattice](https://github.com/mkahn5/lattice)
2. Click **Fork** (top right) → create the fork under your account
3. Create a [fine-grained personal access token](https://github.com/settings/tokens?type=beta) with **Contents → Read-only** on your fork

> **Note:** The frontend is pre-built and committed to `frontend/dist/` - no Node.js build step is needed for Git-based deploys.

#### 2. Create the app

In your Databricks workspace sidebar, navigate to **Apps → Create App**.

1. Select **Create a custom app** - "Bring your code and resources to build an app from scratch"
2. Set the app name to `lattice` and click **Create**
3. Under **Source**, select **Connect to a Git repository**
4. Enter your fork URL and branch:

| Setting | Value |
|---|---|
| **Repo URL** | `https://github.com/<your-username>/lattice.git` |
| **Branch** | `main` |

5. When prompted for Git credentials, enter your **GitHub username** and the **PAT** from step 1
6. On the **App configuration** screen, select a **SQL warehouse**. This enables cost overlay, lineage, heat dots, UC tags, and orphan detection. If you skip this, the canvas and topology features still work but enrichment features will be unavailable. You can add a warehouse later in the app's resource settings.

#### 3. Deploy from Git (if needed)

In some cases, the app may be created but not yet deployed. If the app status shows **No active deployment**:

1. Go to **Apps → lattice** and click **Deploy**
2. Select **Create a deployment from Git**
3. The Git repository URL should already be configured from step 2. If not, set it to your fork URL
4. Set **Git reference (branch/tag/commit)** to `main`
5. Set **Reference type** to `branch`
6. Click **Deploy**

The app will build and start. This step is only needed if the initial creation did not automatically trigger a deployment.

#### 4. Open Lattice

Once the app status shows **Running**, click the app URL to launch Lattice. The first-run wizard guides you through:
1. **Welcome** - what Lattice maps
2. **Catalog scope** - select which catalogs to include (or use all)
3. **Workspaces** - add additional workspace profiles (optional)
4. **System access** - pre-flight checks show which features are active

> **First load:** The initial ingestion discovers all workspace assets and queries system tables. This typically takes **30–90 seconds** depending on workspace size. Subsequent loads use caching - the cached graph loads instantly while a background refresh runs.

#### 5. Check system table access (optional)

On many workspaces, the app service principal inherits system table access automatically - no explicit grants needed. Check **Settings → System Access** inside Lattice to see which features are active.

If features show as unavailable, an **account admin** can grant access. To find the app's service principal: go to **Apps → lattice → Settings → Resources** and note the service principal name. Then see [INSTALL.md](INSTALL.md) for the full grant SQL.

This step can be skipped entirely - the canvas and all core features work without system table access.

#### 6. Set app permissions

By default, only the app creator can access Lattice. To share it:

Go to **Apps → lattice → Permissions**. Add **All workspace users** with the **Can Use** role.

### Option B: CLI-Based Deploy

Use this if you want to deploy without forking, or if you're making local changes.

```bash
# 1. Authenticate to your workspace
databricks auth login --host https://<your-workspace>.cloud.databricks.com --profile my-workspace

# 2. Clone the repo
git clone https://github.com/mkahn5/lattice.git && cd lattice

# 3. Sync to workspace (frontend/dist/ is pre-built in the repo)
databricks sync . /Workspace/Users/<your-email>/lattice --profile my-workspace

# 4. Deploy the app
databricks apps deploy lattice \
  --source-code-path /Workspace/Users/<your-email>/lattice \
  --profile my-workspace
```

If you've made frontend changes, rebuild before syncing:
```bash
cd frontend && npm install && npm run build && cd ..
```

### Add additional workspaces (optional)

Connect Lattice to other Databricks workspaces (dev, staging, production) to switch between them without redeploying.

1. In the target workspace: go to **Settings → Developer → Access tokens**
2. Click **Generate new token**, set a description (e.g. `lattice`) and expiration
3. Copy the token value
4. In Lattice: open **Settings** (gear icon) → **Workspace Profiles** → click **Add**
5. Enter a profile name (e.g. `production`), the workspace host URL, and paste the token
6. Click **Test connection** to verify, then **Save**

The workspace switcher appears in the sidebar once you have 2+ profiles. Click any profile to switch - Lattice re-ingests the new workspace automatically.

> You can also add workspaces during the first-run setup wizard (step 3).

---

## Run Locally

Lattice can run entirely on your machine - no Databricks App deployment needed.

### Quick start (production build, no Node.js required)

The repo includes a pre-built frontend in `frontend/dist/`. You only need Python:

```bash
# Clone and set up Python environment
git clone https://github.com/mkahn5/lattice.git && cd lattice
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Authenticate with your workspace (if not already done)
databricks auth login --host https://<your-workspace>.cloud.databricks.com --profile my-workspace

# Start Lattice
export DATABRICKS_PROFILE=my-workspace
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
# Open http://localhost:8000
```

### Development mode (hot-reload frontend)

If you're modifying the frontend, use the Vite dev server for hot reloading:

```bash
# Backend (terminal 1)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABRICKS_PROFILE=my-workspace
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000

# Frontend (terminal 2) - requires Node.js 18+
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

The Vite dev server proxies API requests to the backend on port 8000.

### Optional: SQL warehouse for enrichment

To enable cost, lineage, heat, and UC tag features locally, set the warehouse ID:

```bash
export DATABRICKS_WAREHOUSE_ID=<your-warehouse-id>
```

Without this, the canvas and topology features work normally - enrichment features are simply disabled.

See [INSTALL.md](INSTALL.md) for full setup details including all required grants and environment variables.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABRICKS_PROFILE` | -| CLI profile name (local dev) |
| `DATABRICKS_HOST` | -| Workspace host URL (local dev) |
| `DATABRICKS_TOKEN` | -| PAT (local dev) |
| `DATABRICKS_WAREHOUSE_ID` | -| SQL warehouse for system table queries |
| `LATTICE_CATALOGS` | (all) | Comma-separated catalog filter |
| `LATTICE_CATALOG_LIMIT` | 20 | Max catalogs when no filter set |
| `LATTICE_SCHEMA_LIMIT` | 20 | Schemas per catalog |
| `LATTICE_TABLE_LIMIT` | 50 | Tables per schema |
| `LATTICE_MODEL_LIMIT` | 200 | Max ML models |
| `LATTICE_PIPELINE_LIMIT` | 200 | Max pipelines |
| `LATTICE_LINEAGE_QUERY_LIMIT` | 10,000 | Max rows from `system.access.table_lineage` |
| `LATTICE_LINEAGE_BACKFILL_JOBS` | 500 | Max jobs backfilled from lineage |
| `LATTICE_LINEAGE_BACKFILL_TABLES` | 2,000 | Max tables backfilled from lineage |
| `LATTICE_ANNOTATIONS_CATALOG` | lattice | Annotations table catalog |
| `LATTICE_ANNOTATIONS_SCHEMA` | metadata | Annotations table schema |

### In-App Settings

After first launch, configure catalog scope, limits, and warehouse in **Settings** (gear icon) - no redeploy needed.

**Catalog Scope** - select which catalogs to include and choose a scale preset (S/M/L) or set custom schema and table limits per catalog.

**Advanced** (collapsed by default) - configure lineage query limits and backfill caps. These control how much lineage data Lattice fetches and how many missing jobs/tables it backfills to complete lineage edges. Higher values improve lineage coverage on large workspaces but increase ingestion time, API calls, and memory usage. See [Known Limitations](#known-limitations) for default values and their impact.

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
4. Fetch system table enrichment (usage, heat, tags, lineage, cost)
5. Backfill missing jobs/tables referenced in lineage
6. Build full NetworkX graph + compute cost attribution
7. Merge annotations + cache to disk

### Security
- Input validation: catalog/profile names validated against strict regex
- Rate limiting: 10s cooldown on `/api/refresh` and `/api/switch`
- Path traversal protection on all user inputs
- Generation counter prevents stale ingestion data from overwriting newer state

---

## Release Notes

### v0.6.0 - Workspace Scorecard (Mar 30, 2026)
- **Workspace Scorecard:** Full-screen overlay with composite governance score (0-100), letter grade (A-F), and delta vs. previous ingestion. Triggered by the clipboard icon in the sidebar or `G` keyboard shortcut.
- **5 scored dimensions:** Freshness (35%), Cost Efficiency (25%), Orphan Rate (20%), UC Tag Coverage (10%), Compute Utilization (10%). Each with progress bars and color coding (green/amber/red).
- **Dimension opt-out:** Uncheck any dimension to exclude it from the score. Weight redistributes proportionally. Disabled dimensions also hide their related offender groups.
- **7 offender categories:** Cold + Costly Tables, Idle Compute, Orphaned Tables, Untagged Tables, Failing Jobs, Stale Jobs, Undocumented Tables. Ranked by impact score. Full list returned for exports, UI shows 10 with "Show all" toggle.
- **Expandable offender cards:** Click any offender to see rich detail - owner, created by, created date, last queried, heat, table type, row count, size, schedule, comment.
- **Workspace Structure observations:** Oversized schemas, tables in default schema, empty schemas, single-table schemas, catalog concentration. Informational, not scored.
- **Per-catalog breakdown:** Composite score per catalog, sorted worst-first. Hidden when all catalogs score 0 or single-catalog workspace.
- **Notes:** Free-text textarea persisted per workspace. Auto-saves on blur. Included in all exports.
- **Delta signal:** Compares current score to previous cached ingestion. Shows +/- N with directional arrow.
- **Export:** JSON (full payload), CSV (offenders with owner/created/queried columns), Markdown (copy to clipboard for Slack/Confluence). All respect dimension opt-out and include notes.
- **Scorecard resets on workspace switch** and graph refresh.
- **Quick Start docs updated:** Correct Databricks Apps workflow (Create custom app, App configuration for warehouse, Deploy from Git with branch reference).
- **Em dashes removed** from all documentation files.

### v0.5.4 - Job→Table Lineage, UC Tags & Configurable Limits (Mar 20, 2026)
- **Lineage-driven backfill:** After fetching lineage from `system.access.table_lineage`, Lattice automatically backfills missing jobs and tables so Job→Table edges connect. Previously, ingestion limits meant most lineage endpoints were missing from the graph - now the full Job → Table → View chain is visible.
- **UC tag ingestion:** Tags set via `ALTER TABLE SET TAGS` are now ingested from `system.information_schema.table_tags` and displayed as pills in the detail panel. Tags are searchable in the canvas search box - search by tag key or value (e.g., "finance", "critical") to find tagged assets.
- **Configurable limits (Settings → Advanced):** Lineage query limit (default 10K), job backfill limit (default 500), and table backfill limit (default 2K) are configurable in the UI with an "increase at your own risk" warning. Also settable via environment variables.
- **Lineage query limits raised:** Default from 1K to 10K rows for both table-to-table and job-to-table lineage queries.
- **Known Limitations section updated:** New ingestion limits table in README documenting all defaults, maximums, and their impact on large workspaces.

### v0.5.3 - View Dependency Edges (Mar 20, 2026)
- **View → Table edges:** New `derivedFrom` edge type shows which source tables a view is built from. Includes chained view→view→table relationships.
- **Automatic dependency resolution:** View dependencies resolved via `tables.get()` API in parallel after the main catalog fetch. Only creates edges when both the view and its source table are in the graph.
- **Edge styling:** `derivedFrom` edges render in cyan (#06b6d4) with solid lines, distinct from lineage edges.
- **Edge legend updated:** New `derivedFrom` entry in the Edge Types panel.

### v0.5.2 - AI/ML Stack Connectors (Mar 19, 2026)
- **Model Serving Endpoints:** Discovers all Model Serving and AI Gateway endpoints. Links each endpoint to the UC registered models it serves via `serves` edges. Shows endpoint state and creator.
- **Vector Search Indexes:** Discovers all Vector Search indexes across endpoints. Links each index to its source Delta table (`indexesFrom`) and embedding model endpoint (`embeddedBy`). Surfaces index type and sync status.
- **Genie Spaces:** Discovers all Genie AI/BI rooms. Links each space to its SQL warehouse (`runsOn`) and configured tables (`queries`). Shows space description and creator.
- **23 node types** (up from 20): ServingEndpoint, VectorSearchIndex, GenieSpace join the graph alongside all existing UC, compute, and federation types.
- **15+ edge types** (up from 10+): New relationships -`serves`, `indexesFrom`, `embeddedBy` - complete the AI stack path: Table → VectorSearchIndex → ServingEndpoint → Model, plus Genie → Warehouse/Table.
- **Full AI pipeline visibility:** See the complete path from source tables through vector indexes and embedding endpoints to serving endpoints and Genie spaces - all in a single graph.
- **Graceful fallback:** All three connectors run in the parallel fetch pool with 45s timeouts. If an API isn't available on a workspace (e.g., no Vector Search provisioned), that connector returns empty and the rest of the graph loads normally.
- **Console URL links:** ServingEndpoint nodes link to `/ml/endpoints/{name}`, GenieSpace nodes link to `/genie/rooms/{id}`.
- **Swimlane & type filters updated:** New types appear in the correct lanes - VectorSearchIndex in the UC group, ServingEndpoint and GenieSpace in the Compute group.
- **Edge legend updated:** Three new edge types (serves, indexesFrom, embeddedBy) appear in the Edge Types panel with matching colors.

### v0.5.1 - Multi-Workspace & Screenshots (Mar 18, 2026)
- **Workspace profiles in Settings:** Add, edit, test, and delete workspace profiles (name + host + PAT) directly in the Settings UI. Profiles stored in `lattice_config.json` alongside CLI profiles from `~/.databrickscfg`.
- **Setup wizard - Workspaces step:** New step 3 in the first-run wizard lets users add additional workspaces during initial setup.
- **Workspace switcher improvements:** Primary workspace always visible, spinner during switch, click-outside to close dropdown, PAT/APP/CLI source badges.
- **Seamless workspace switching:** Canvas clears immediately on switch, progress section shows real-time ingestion steps (Connect → Compute → UC → Lineage → Build), cached workspaces load instantly on repeat visits.
- **Per-workspace caching:** Each workspace's graph is cached separately by profile name. Switching to a previously visited workspace serves the cached graph in ~500ms while a background refresh runs.
- **Auth isolation:** Stored PAT profiles override Databricks App auto-injected credentials. Env vars (CLIENT_ID/SECRET) temporarily cleared during PAT auth to prevent SDK conflicts.
- **Autocomplete suppressed:** Profile forms no longer trigger browser password manager prompts.
- **Progress polling:** Sidebar ingestion status and App-level poller now run continuously, detecting workspace switches and updating in real-time.
- **Screenshot refresh:** Retook 6 screenshots - main canvas (bird's eye), swimlane (wider zoom), focus view (schema with 15+ connections), health/orphans (30d active vs dimmed), cost overlay (warehouse DBU heatmap with attribution), activity timeline (30d filter), settings (redacted hostname).
- **Documentation:** Added 30–90 second first-load timing note, step-by-step PAT instructions (Settings → Developer → Access tokens), workspace profiles setup guide in both README and INSTALL.md.

### v0.5.0 - Deployment & Canvas UX (Mar 17–18, 2026)
- **Databricks Apps deployment:** Git-based deployment with GitHub PAT, SQL warehouse resource injection, and `.venv/bin/python3` fix for uvicorn module resolution.
- **Frontend included in repo:** `frontend/dist/` committed so Git-based deployments work without Node.js in the app runtime.
- **Auto-reflow on search:** Typing in the search box now resets layout and zooms to filtered results automatically - no need to click a layout button.
- **Auto-reflow on type filter:** Clicking asset types in the sidebar re-layouts and zooms to the filtered nodes instantly.
- **Smart layout preservation:** When nodes have been manually arranged (drag or Focus), filter/search changes preserve positions instead of hard-resetting. A "Reset layout of filtered view" button appears to re-layout on demand.
- **Volume console links:** Volume nodes now show the "Open in Databricks" link (Catalog Explorer URL).
- **Database owner field:** Database nodes now capture owner (from SDK or app creator fallback) and display it in the detail panel.
- **Ontology positioning:** README, INSTALL, and demo script updated to position Lattice as an ontology platform. Phase 6 roadmap updated to "Ontology writeback."
- **Requirements section:** Feature-to-requirement mapping showing minimum vs full requirements.
- **Installation guide rewrite:** Step-by-step Databricks Apps deployment with GitHub PAT, warehouse config, system table grants (account admin clarification), and app permissions.
- **Troubleshooting guide rewrite:** Covers uvicorn module error, frontend 404, system catalog PERMISSION_DENIED, partial system table access, and non-fatal log warnings.

### v0.4.0 - Intelligence Layer (Mar 13, 2026)
- **Health panel:** Detects orphaned tables (cold + 0 queries in 30d) and unowned assets. Collapsible sidebar section with clickable node list.
- **Impact analysis:** "Analyze" button on any node triggers BFS - shows "Depends on this" (consumers) and "Contained within" (descendants).
- **Column lineage:** Fetched from `system.access.column_lineage`, shown in detail panel as `target_col ← source_table.source_col`.
- **JSON-LD export:** `GET /api/export/jsonld` - full graph as JSON-LD with `@context`, `@id`, `@type` for AI agent consumption.
- **Terminated clusters filtered** from graph (TERMINATED, TERMINATING, ERROR states).
- **Ingestion hang fix:** Replaced blocking `ThreadPoolExecutor` context manager with explicit `shutdown(wait=False)`.
- **FitView on deselect:** Closing detail panel or clicking background animates canvas back to fit-all view.

### v0.3.0 - Security Hardening (Mar 12, 2026)
- **Input validation:** Catalog names, profile names, and host URLs validated against strict regex before use.
- **Rate limiting:** 10s cooldown on `/api/refresh` and `/api/switch` (returns 429 with retry hint).
- **Path traversal protection** on catalog/profile inputs.
- **Generation counter:** Superseded ingestion threads detect replacement and abort, preventing stale data overwrites.

### v0.2.1 - Canvas UX Improvements (Mar 12, 2026)
- **Position persistence:** Filter/type toggle changes no longer reset manual node positions.
- **Save View:** Freeze canvas to side-by-side comparison pane at exact viewport/zoom.
- **PNG export** (4x resolution) + **JSON export** from frozen comparison pane.
- **Focus Neighbors:** Radial ring layout around selected node with direct connections.
- **Profile switcher** + **Catalog selector** (live search, 200 limit, click-outside close).
- **Freshness filter:** Slider to show only nodes active within N days.
- **Multi-workspace switch** with progress polling + non-blocking IngestBanner.

### v0.2.0 - Enrichment & Lineage (Mar 11–12, 2026)
- **System table enrichment:** `system.billing.usage` (DBU 30d), `system.lakeflow.job_run_timeline` (run count + success rate), `system.query.history` (query count + last queried), `system.information_schema.table_storage_utilization` (row count + size MB).
- **Heat dots:** Green (hot ≤7d), amber (warm ≤30d), gray (cold).
- **DBU + query count** shown inline on node tiles.
- **Table lineage edges** from `system.access.table_lineage` - feedsInto, writesTo, readsFrom. Blue dashed edges, toggleable.
- **Dashboard → Table lineage:** SQL parsed from Lakeview dataset specs. External tables create stub nodes (dashed border).
- **Federation nodes:** ForeignCatalog, Connection, Share, Recipient + relationship edges.
- **Partial graph** published ~15s after startup while UC ingestion finishes.

### v0.1.0 - MVP (Mar 11, 2026)
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
- **Disk cache** keyed by profile+catalog filter - loaded on startup for instant canvas, then refreshed live.

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
| 5.3 | View dependency edges, Job→Table lineage backfill, UC tag ingestion | Done |
| 10 | Annotation & Bookmarking: tags, notes, canvas dots, tag filter, multi-select | Done |
| 6.0 | Workspace Scorecard: composite score, offenders, structure, notes, export | Done |
| 7 | MCP server: expose graph as agent-callable tools (search, lineage, impact, orphans) | Planned |
| 8 | Automated architecture diagram export (Mermaid, draw.io, Lucidchart) | Planned |
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
│   │   ├── lineage_backfill.py  # Backfill missing jobs/tables from lineage
│   │   └── system_tables.py     # System table queries (enrichment, lineage, tags)
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
