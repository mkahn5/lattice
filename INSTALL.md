# Lattice - Installation Guide

Lattice is an ontology and visual intelligence platform for Databricks workspaces. It builds a live ontology of your environment - mapping all Unity Catalog assets, compute resources, jobs, dashboards, apps, model serving endpoints, vector search indexes, and Genie spaces as typed entities with semantic relationships into a navigable knowledge graph.

---

## Requirements

### Minimum (canvas + topology)

| Requirement | Details |
|---|---|
| **Databricks workspace** | Unity Catalog enabled |
| **Databricks Apps** | Enabled on the workspace (serverless) |
| **Workspace access** | Permission to create Databricks Apps |
| **GitHub PAT** | Read-only access to the Lattice repo (entered during app setup) |

With just these, Lattice discovers and visualizes all UC assets, compute resources, jobs, dashboards, apps, serving endpoints, vector search indexes, and Genie spaces - full topology, search, filtering, layout modes, focus view, and export.

### Full features (mapped to requirements)

| Feature | Requires | System table |
|---|---|---|
| **Canvas + topology** | Workspace + Apps | -|
| **Search, filter, focus** | Workspace + Apps | -|
| **View → Table edges** | Workspace + Apps | - (uses UC `view_dependencies` API) |
| **Cost overlay & DBU badges** | SQL warehouse | `system.billing.usage` |
| **Heat dots (hot/warm/cold)** | SQL warehouse | `system.query.history` |
| **Orphan detection** | SQL warehouse | `system.query.history` |
| **Table & Job lineage edges** | SQL warehouse | `system.access.table_lineage` |
| **Column-level lineage** | SQL warehouse | `system.access.column_lineage` |
| **Job success rates** | SQL warehouse | `system.lakeflow.job_run_timeline` |
| **Row counts & table sizes** | SQL warehouse | `system.information_schema.table_storage_utilization` |
| **UC tags** | SQL warehouse | `system.information_schema.table_tags` |
| **Annotations (tags & notes)** | SQL warehouse + CREATE TABLE on `lattice.metadata` | -|
| **Workspace switching** | PAT from target workspace (Settings → Developer → Access tokens) | -|
| **App sharing** | Set **Can Use** permission on the app for workspace users | -|

> **Graceful degradation:** Every system table feature is optional. If a warehouse isn't configured or a grant is missing, that feature is disabled and the rest of the app works normally. Check **Settings → System Access** inside Lattice for per-feature status.

---

## Deploy as a Databricks App

### Step 1: Fork the Repo

Databricks Apps requires you to deploy from a repository you own. Fork Lattice to your GitHub account:

1. Go to [github.com/mkahn5/lattice](https://github.com/mkahn5/lattice)
2. Click **Fork** (top right) → create the fork under your account

### Step 2: Create a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Token name:** `lattice-databricks`
   - **Expiration:** 90 days (or custom)
   - **Repository access:** Select your forked `<your-username>/lattice` repo
   - **Permissions:** Contents → Read-only
4. Click **Generate token** and copy the value

### Step 3: Create the Databricks App

**Option A: From the Databricks UI**

1. Go to **Apps → Create App**
2. Select **Create a custom app** - "Bring your code and resources to build an app from scratch"
3. Set the app name to `lattice` and click **Create**
4. Under **Source**, select **Connect to a Git repository**
5. Enter your fork URL: `https://github.com/<your-username>/lattice.git`
6. Set the branch to `main`
7. When prompted for Git credentials, enter your **GitHub username** and paste the **PAT** from Step 2
8. On the **App configuration** screen, select a **SQL warehouse**. This enables cost overlay, lineage, heat dots, UC tags, and orphan detection

**Option B: From the Databricks CLI (alternative)**

```bash
# Authenticate to your workspace
databricks auth login https://<your-workspace>.cloud.databricks.com --profile my-workspace

# Clone and build the frontend locally
git clone https://github.com/mkahn5/lattice.git && cd lattice
cd frontend && npm install && npm run build && cd ..

# Sync source to workspace
databricks sync . /Workspace/Users/<your-email>/lattice --profile my-workspace

# Deploy the app
databricks apps deploy lattice \
  --source-code-path /Workspace/Users/<your-email>/lattice \
  --profile my-workspace
```

### Step 4: Configure the SQL Warehouse

The app needs a SQL warehouse to query system tables for cost, lineage, heat, and orphan detection.

**During Databricks App setup**, you'll be prompted to select a SQL warehouse. This injects the `DATABRICKS_WAREHOUSE_ID` environment variable into the app automatically - no manual configuration needed.

If you need to change the warehouse later:

1. Go to **Compute → Apps → lattice → Settings**
2. Under **Resources**, find the SQL warehouse resource
3. Select a different warehouse from the dropdown
4. Click **Save** and restart the app

The included `app.yaml` also declares a `sql-warehouse` resource with `id: auto` as a fallback, which picks the first available warehouse if none was selected during setup.

> **Important:** The warehouse must be running when the app starts. If it's stopped, system table features will be unavailable until the warehouse is started and the app is refreshed.

### Step 5: Grant System Table Access

On many workspaces, the app service principal inherits system table access through group membership -**no explicit grants needed**. Check **Settings → System Access** inside Lattice after launch to see which features are active.

If system table features show as unavailable, an **account admin** (not just workspace admin) can run these grants.

**Finding the service principal:** Go to **Apps → lattice → Settings → Resources** in the Databricks workspace. The service principal name is shown next to the app's resource assignments. Replace `<principal>` below with that name or UUID.

```sql
-- Cost overlay & DBU badges
GRANT USE CATALOG ON CATALOG system TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;

-- Heat dots & orphan detection
GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
GRANT SELECT ON TABLE system.query.history TO `<principal>`;

-- Lineage edges
GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
GRANT SELECT ON TABLE system.access.column_lineage TO `<principal>`;

-- Job success rates
GRANT USE SCHEMA ON SCHEMA system.lakeflow TO `<principal>`;
GRANT SELECT ON TABLE system.lakeflow.job_run_timeline TO `<principal>`;
```

> **Note:** Granting on the `system` catalog requires the **account admin** role, not just workspace admin. If you get `PERMISSION_DENIED: User is not an account admin`, ask your account admin to run the grants - or skip this step entirely if the features are already working.

### Step 6: Open Lattice

Go to **Compute → Apps → lattice**. Once the status shows **Running**, click the app URL link next to the status badge to launch Lattice.

> **First load:** The initial ingestion discovers all workspace assets and queries system tables for usage, lineage, and cost data. This typically takes **30–90 seconds** depending on workspace size. Subsequent loads are faster thanks to caching - the cached graph loads instantly while a background refresh runs.

### Step 7: Set App Permissions

By default, only the app creator can access Lattice. To share it across your organization:

1. Go to **Compute → Apps → lattice → Permissions**
2. Click **Add**
3. Select **All workspace users** and set the role to **Can Use**
4. Click **Save**

This allows anyone in the workspace to open and use Lattice.

On first launch, Lattice runs a setup wizard:
1. **Welcome** - explains what Lattice maps
2. **Catalog scope** - select which catalogs to include (or use all)
3. **Workspaces** - add additional workspace profiles (optional)
4. **System access** - pre-flight checks show which features are available

You can skip the wizard and configure everything later in **Settings** (gear icon).

### Step 8: Add Additional Workspaces (Optional)

Connect Lattice to other Databricks workspaces to switch between them (e.g. dev, staging, production).

1. In the **target workspace**: go to **Settings → Developer → Access tokens**
2. Click **Generate new token**, set a description (e.g. `lattice`) and expiration
3. Copy the token value
4. In **Lattice**: open **Settings** (gear icon) → **Workspace Profiles** → click **Add**
5. Enter a profile name (e.g. `production`), the workspace host URL, and paste the token
6. Click **Test connection** to verify, then **Save**

The workspace switcher appears in the sidebar once you have 2+ profiles. Click any profile to switch - Lattice re-ingests the new workspace automatically.

---

## What Gets Deployed

| Component | Description |
|---|---|
| `app.yaml` | Databricks App manifest - command, env vars, warehouse resource |
| `requirements.txt` | Python dependencies (FastAPI, uvicorn, databricks-sdk, NetworkX) |
| `app.py` | FastAPI entry point + ingestion orchestrator |
| `server/` | Backend: connectors, graph builder, API routes, preflight checks |
| `frontend/dist/` | Pre-built React app (served as static files) |

**No external infrastructure.** Lattice runs entirely inside your Databricks workspace using the Apps serverless runtime + your SQL warehouse.

> **Important:** `frontend/dist/` is pre-built and committed to the repo so Git-based deployments work without Node.js in the app runtime. If you modify frontend source files, rebuild with `cd frontend && npm run build` and commit the updated `frontend/dist/` before deploying.

---

## Configuration Reference

### app.yaml

Databricks Apps automatically creates a `.venv` and installs `requirements.txt` before running the command - no `pip install` needed in the command itself.

```yaml
command:
  - /bin/bash
  -c
  - ".venv/bin/python3 -m uvicorn app:app --host 0.0.0.0 --port 8000"
env:
  - name: DATABRICKS_WAREHOUSE_ID
    valueFrom: sql-warehouse
resources:
  - name: sql-warehouse
    sql_warehouse:
      id: auto   # or a specific warehouse ID
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABRICKS_WAREHOUSE_ID` | (from resource) | SQL warehouse for system table queries |
| `LATTICE_CATALOGS` | (all) | Comma-separated catalog filter |
| `LATTICE_CATALOG_LIMIT` | `20` | Max catalogs when no filter set |
| `LATTICE_SCHEMA_LIMIT` | `20` | Schemas per catalog |
| `LATTICE_TABLE_LIMIT` | `50` | Tables per schema |
| `LATTICE_LINEAGE_QUERY_LIMIT` | `10000` | Max rows from `system.access.table_lineage` |
| `LATTICE_LINEAGE_BACKFILL_JOBS` | `500` | Max jobs backfilled from lineage |
| `LATTICE_LINEAGE_BACKFILL_TABLES` | `2000` | Max tables backfilled from lineage |

All of these can be configured in the **Settings panel** inside the app after launch - no redeploy needed. Lineage settings are under **Settings → Advanced**.

---

## Required Grants Summary

| Grant | Feature Enabled |
|---|---|
| `USE CATALOG` on your catalogs | UC assets appear on canvas |
| `CAN USE` on the warehouse | System table queries work |
| `system.billing.usage` | Cost overlay, DBU badges |
| `system.query.history` | Heat dots, orphan detection |
| `system.access.table_lineage` | Lineage edges |
| `system.access.column_lineage` | Column-level lineage |
| `system.lakeflow.job_run_timeline` | Job success rates |

---

## Annotations (Optional)

If you want to use tags and notes on assets, Lattice stores them in a Delta table. Grant the app service principal:

```sql
GRANT USE CATALOG ON CATALOG lattice TO `<principal>`;
GRANT CREATE SCHEMA ON CATALOG lattice TO `<principal>`;
GRANT CREATE TABLE ON SCHEMA lattice.metadata TO `<principal>`;
```

Lattice creates the table automatically on first use.

---

## Updating

```bash
# Pull latest changes
git pull

# Rebuild frontend
cd frontend && npm run build && cd ..

# Re-sync and redeploy
databricks sync . /Workspace/Users/<your-email>/lattice --profile my-workspace
databricks apps deploy lattice \
  --source-code-path /Workspace/Users/<your-email>/lattice \
  --profile my-workspace
```

Your settings (`lattice_config.json`) are excluded from sync and will not be overwritten.

---

## Local Development

### Quick start (production build, no Node.js required)

The repo includes a pre-built frontend in `frontend/dist/`. You only need Python 3.10+:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Authenticate if not already done
databricks auth login --host https://<your-workspace>.cloud.databricks.com --profile my-profile

export DATABRICKS_PROFILE=my-profile
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
# Open http://localhost:8000
```

### Development mode (hot-reload frontend)

If you're modifying the frontend, use the Vite dev server (requires Node.js 18+):

```bash
# Backend (terminal 1)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABRICKS_PROFILE=my-profile
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

### Optional: SQL warehouse for enrichment

```bash
export DATABRICKS_WAREHOUSE_ID=<your-warehouse-id>
```

This enables cost overlay, lineage, heat dots, UC tags, and orphan detection. Without it, the canvas and topology features work normally.

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and fixes.

**Quick checks:**
- **App won't start:** Check App logs for import errors. Verify `requirements.txt` is at the repo root.
- **Blank canvas:** Verify the SQL warehouse is running. Check `/api/progress` in browser console.
- **No heat dots / cost data:** Missing system table grants. Check Settings → System Access.
- **"No catalogs found":** The app service principal needs `USE CATALOG` on at least one catalog.
