# Lattice — Installation Guide

Lattice is a visual intelligence tool for Databricks workspaces. It maps all your Unity Catalog assets, compute resources, jobs, dashboards, and apps into a navigable knowledge graph.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Unity Catalog enabled** | Required — Lattice uses UC as its data source |
| **Databricks Apps enabled** | Requires a serverless workspace |
| **SQL warehouse** | Required for usage stats, lineage, cost data, and annotations |
| **Python 3.11+** | Runtime requirement |

---

## Quick Deploy

```bash
# 1. Clone the repo
git clone <repo-url> lattice && cd lattice

# 2. Build the frontend
cd frontend && npm install && npm run build && cd ..

# 3. Sync source to workspace
databricks sync . /Workspace/Users/<your-email>/lattice --profile <your-profile>

# 4. Deploy the app
databricks apps deploy lattice \
  --source-code-path /Workspace/Users/<your-email>/lattice \
  --profile <your-profile>
```

The app will be available at `https://<workspace-host>/apps/lattice`.

---

## Configuration

Lattice is configured via environment variables in `app.yaml`. The defaults work out of the box — customize as needed.

### Required: SQL Warehouse

Lattice needs a SQL warehouse to fetch usage stats, lineage, and cost data. Configure it in `app.yaml` using the resource injection mechanism:

```yaml
# app.yaml
command:
  - python3
  - -m
  - uvicorn
  - app:app
  - --host
  - 0.0.0.0
  - --port
  - 8000
env:
  - name: DATABRICKS_WAREHOUSE_ID
    valueFrom: sql-warehouse
resources:
  - name: sql-warehouse
    sql_warehouse:
      id: auto   # picks the first available warehouse
```

To use a specific warehouse, replace `id: auto` with the warehouse ID (e.g. `id: abc1234567890def`).

### Optional: Catalog Scope

By default, Lattice ingests up to 20 catalogs. To restrict to specific catalogs:

```yaml
env:
  - name: LATTICE_CATALOGS
    value: "prod,staging"   # comma-separated list
```

Or configure this in the **Settings panel** inside the app after first launch — no redeploy needed.

### Optional: Scale Limits

```yaml
env:
  - name: LATTICE_SCHEMA_LIMIT    # schemas per catalog (default: 20)
    value: "30"
  - name: LATTICE_TABLE_LIMIT     # tables per schema (default: 50)
    value: "100"
  - name: LATTICE_CATALOG_LIMIT   # max catalogs when no filter set (default: 20)
    value: "20"
```

---

## Required Grants

### Unity Catalog Access (minimum)

```sql
-- Required for any UC assets to appear
GRANT USE CATALOG ON CATALOG <your_catalog> TO `<service-principal-or-user>`;
GRANT USE SCHEMA ON SCHEMA <your_catalog>.<your_schema> TO `<service-principal-or-user>`;
```

### System Tables (for usage stats, lineage, cost data)

Grant these to the service principal that runs the Databricks App:

```sql
-- Usage stats & cost data
GRANT USE CATALOG ON CATALOG system TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;

-- Table query history (heat dots, orphan detection)
GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
GRANT SELECT ON TABLE system.query.history TO `<principal>`;

-- Data lineage edges
GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
GRANT SELECT ON TABLE system.access.column_lineage TO `<principal>`;

-- Job run data
GRANT USE SCHEMA ON SCHEMA system.lakeflow TO `<principal>`;
GRANT SELECT ON TABLE system.lakeflow.job_run_timeline TO `<principal>`;
```

These grants are optional — the app works without them, but system-table-powered features (heat dots, cost overlay, lineage edges) will show "requires system table access" messages.

### Annotations (optional)

If you want to use tags and notes on assets, Lattice stores them in a Delta table:

```sql
-- Create the annotations catalog/schema (Lattice creates the table automatically)
GRANT CREATE CATALOG TO `<principal>`;
-- OR if the catalog already exists:
GRANT USE CATALOG ON CATALOG lattice TO `<principal>`;
GRANT CREATE SCHEMA ON CATALOG lattice TO `<principal>`;
GRANT CREATE TABLE ON SCHEMA lattice.metadata TO `<principal>`;
```

---

## First-Run Experience

On first launch, Lattice shows a setup wizard that:

1. **Welcome** — explains what Lattice maps
2. **Catalog scope** — lets you select which catalogs to include (or use all)
3. **System access** — runs pre-flight checks and shows which features are available

You can skip the wizard and configure everything later in **Settings** (gear icon in the sidebar).

---

## Troubleshooting

**Blank canvas on load**

- Check that your SQL warehouse is running
- Open the browser console and look for errors on `/api/progress` or `/api/graph`
- The app logs ingestion progress to stdout — check the App logs in the Databricks UI

**No usage stats or heat dots**

- `DATABRICKS_WAREHOUSE_ID` is not set or the warehouse is stopped
- Missing `system.query.history` grant — see System Tables section above
- Check `GET /api/status` for a full diagnostics report

**Empty UC tree**

- The app may be using a different profile/credentials than expected
- Ensure the service principal has `USE CATALOG` on the catalogs you want to see

**Warehouse not found**

- If using `id: auto` in `app.yaml`, the workspace must have at least one warehouse
- Check that the Databricks App service principal has `CAN USE` permission on the warehouse

**App won't start**

- Verify Python 3.11+ is available in the App runtime (`python3 --version`)
- Check that all packages in `requirements.txt` are installable
- Check App logs for import errors

---

## Updating

```bash
# Rebuild frontend after any frontend changes
cd frontend && npm run build && cd ..

# Re-sync and redeploy (lattice_config.json is excluded from sync — your settings are preserved)
databricks sync . /Workspace/Users/<your-email>/lattice --profile <your-profile>
databricks apps deploy lattice \
  --source-code-path /Workspace/Users/<your-email>/lattice \
  --profile <your-profile>
```

Your configuration (`lattice_config.json`) is excluded from sync via `.syncignore` and will not be overwritten on redeploy.

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
