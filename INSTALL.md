# Lattice — Installation Guide

Lattice is an ontology and visual intelligence platform for Databricks workspaces. It builds a live ontology of your environment — mapping all Unity Catalog assets, compute resources, jobs, dashboards, and apps as typed entities with semantic relationships into a navigable knowledge graph.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Unity Catalog enabled** | Required — Lattice uses UC as its data source |
| **Databricks Apps enabled** | Requires a serverless workspace |
| **SQL warehouse** | Required for usage stats, lineage, cost data, and annotations |
| **GitHub account** | For cloning the repo (personal access token recommended) |

---

## Deploy as a Databricks App

### Step 1: Create a GitHub Personal Access Token

Lattice source code is hosted on GitHub. You'll need a personal access token (PAT) to connect the repo during app setup.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set:
   - **Token name:** `lattice-databricks`
   - **Expiration:** 90 days (or custom)
   - **Repository access:** Select `databricks-field-eng/lattice` (or your fork)
   - **Permissions:** Contents → Read-only
4. Click **Generate token** and copy the value

### Step 2: Create the Databricks App

**Option A: From the Databricks UI**

1. Go to **Compute → Apps → Create App**
2. Set:
   - **Name:** `lattice`
   - **Description:** Ontology and visual intelligence for this workspace
3. Under **Source**, select **Git repository**
4. Enter the repo URL: `https://github.com/databricks-field-eng/lattice.git`
5. Set the branch to `main`
6. When prompted for Git credentials, enter your **GitHub username** and paste the **PAT** from Step 1
7. Click **Create**

**Option B: From the Databricks CLI (alternative)**

```bash
# Authenticate to your workspace
databricks auth login https://<your-workspace>.cloud.databricks.com --profile my-workspace

# Clone and build the frontend locally
git clone https://github.com/databricks-field-eng/lattice.git && cd lattice
cd frontend && npm install && npm run build && cd ..

# Sync source to workspace
databricks sync . /Workspace/Users/<your-email>/lattice --profile my-workspace

# Deploy the app
databricks apps deploy lattice \
  --source-code-path /Workspace/Users/<your-email>/lattice \
  --profile my-workspace
```

### Step 3: Configure the SQL Warehouse

The app needs a SQL warehouse to query system tables for cost, lineage, heat, and orphan detection.

**During Databricks App setup**, you'll be prompted to select a SQL warehouse. This injects the `DATABRICKS_WAREHOUSE_ID` environment variable into the app automatically — no manual configuration needed.

If you need to change the warehouse later:

1. Go to **Compute → Apps → lattice → Settings**
2. Under **Resources**, find the SQL warehouse resource
3. Select a different warehouse from the dropdown
4. Click **Save** and restart the app

The included `app.yaml` also declares a `sql-warehouse` resource with `id: auto` as a fallback, which picks the first available warehouse if none was selected during setup.

> **Important:** The warehouse must be running when the app starts. If it's stopped, system table features will be unavailable until the warehouse is started and the app is refreshed.

### Step 4: Grant System Table Access

On many workspaces, the app service principal inherits system table access through group membership — **no explicit grants needed**. Check **Settings → System Access** inside Lattice after launch to see which features are active.

If system table features show as unavailable, an **account admin** (not just workspace admin) can run these grants. Replace `<principal>` with the app service principal name or UUID.

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

> **Note:** Granting on the `system` catalog requires the **account admin** role, not just workspace admin. If you get `PERMISSION_DENIED: User is not an account admin`, ask your account admin to run the grants — or skip this step entirely if the features are already working.

### Step 5: Open Lattice

Go to **Compute → Apps → lattice**. Once the status shows **Running**, click the app URL link next to the status badge to launch Lattice.

On first launch, Lattice runs a setup wizard:
1. **Welcome** — explains what Lattice maps
2. **Catalog scope** — select which catalogs to include (or use all)
3. **System access** — pre-flight checks show which features are available

You can skip the wizard and configure everything later in **Settings** (gear icon).

---

## What Gets Deployed

| Component | Description |
|---|---|
| `app.yaml` | Databricks App manifest — command, env vars, warehouse resource |
| `requirements.txt` | Python dependencies (FastAPI, uvicorn, databricks-sdk, NetworkX) |
| `app.py` | FastAPI entry point + ingestion orchestrator |
| `server/` | Backend: connectors, graph builder, API routes, preflight checks |
| `frontend/dist/` | Pre-built React app (served as static files) |

**No external infrastructure.** Lattice runs entirely inside your Databricks workspace using the Apps serverless runtime + your SQL warehouse.

---

## Configuration Reference

### app.yaml

```yaml
command:
  - /bin/bash
  - -c
  - "pip install -r requirements.txt && python3 -m uvicorn app:app --host 0.0.0.0 --port 8000"
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

All of these can be configured in the **Settings panel** inside the app after launch — no redeploy needed.

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

```bash
# Install dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Set your workspace profile
export DATABRICKS_PROFILE=my-profile

# Start the backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000

# In another terminal, start the frontend dev server
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and fixes.

**Quick checks:**
- **App won't start:** Check App logs for import errors. Verify `requirements.txt` is at the repo root.
- **Blank canvas:** Verify the SQL warehouse is running. Check `/api/progress` in browser console.
- **No heat dots / cost data:** Missing system table grants. Check Settings → System Access.
- **"No catalogs found":** The app service principal needs `USE CATALOG` on at least one catalog.
