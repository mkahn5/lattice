# Lattice - Troubleshooting Guide

This document covers the most common issues when deploying Lattice to a new workspace.
For installation steps, see [INSTALL.md](INSTALL.md).

---

## Deployment Issues

### `No module named uvicorn` on Databricks Apps

**Symptom:** App logs show `Requirements installed successfully` but then `/usr/bin/python3: No module named uvicorn`.

**Cause:** Databricks Apps installs packages into `.venv/` but the system `python3` at `/usr/bin/python3` can't see that virtual environment.

**Fix:** The `app.yaml` command must use the venv Python. The correct configuration is:

```yaml
command:
  - /bin/bash
  -c
  - ".venv/bin/python3 -m uvicorn app:app --host 0.0.0.0 --port 8000"
```

Do **not** use `python3 -m uvicorn` directly - that resolves to `/usr/bin/python3` which doesn't have the installed packages.

---

### UI shows `{"detail": "Not Found"}` but backend is running

**Symptom:** App logs show successful ingestion (`Graph built: N nodes`) but the browser shows a JSON 404 error. API endpoints like `/api/progress` work fine.

**Cause:** The `frontend/dist/` directory is missing from the deployed source. This happens when deploying from a Git repository where `frontend/dist/` was in `.gitignore`.

**Fix:** The built frontend files must be committed to the repo. Verify that `frontend/dist/index.html` exists in your repo. If not:

```bash
cd frontend && npm install && npm run build && cd ..
git add -f frontend/dist/
git commit -m "Add built frontend for Databricks Apps deployment"
git push
```

Then redeploy the app.

---

### App crashes immediately on deploy

**Symptom:** Status shows "Crashed" within seconds of deployment.

**Check the logs** under **Compute → Apps → lattice → Logs** for the specific error. Common causes:

| Log message | Fix |
|---|---|
| `No module named uvicorn` | See uvicorn fix above |
| `No module named fastapi` | Same cause - use `.venv/bin/python3` |
| `ModuleNotFoundError` for any package | Verify `requirements.txt` is at the repo root |
| `SyntaxError` | Python version mismatch - Lattice requires Python 3.11+ |

---

## System Table Access

### PERMISSION_DENIED when granting on system catalog

**Symptom:** Running `GRANT USE CATALOG ON CATALOG system TO ...` returns `PERMISSION_DENIED: User does not have MANAGE on Catalog 'system'` or `User is not an account admin for Account`.

**Cause:** Granting access to the `system` catalog requires the **account admin** role - not just workspace admin. This is a Databricks platform restriction.

**What to do:**

1. **Check if grants are even needed.** On many workspaces, the app service principal inherits system table access through the `account users` group. Launch Lattice and check **Settings → System Access** - if features show as active, you're good. Skip the grants entirely.

2. **If features show as unavailable**, ask an **account admin** to run the grants. Account admins can be found in the [Databricks account console](https://accounts.cloud.databricks.com) under **Users → Admins**.

3. **If you can't find an account admin**, skip the grants. Lattice works without system table access - the canvas, topology, filtering, focus view, workspace switching, and search all work fine. Only cost overlay, heat dots, lineage edges, and orphan detection require system tables.

---

### System tables partially working

**Symptom:** Some system table features work (e.g., cost and lineage) but others don't (e.g., heat dots).

This is normal. Each system table has independent access. Common partial states:

| Working | Not working | Meaning |
|---|---|---|
| Cost overlay, lineage | Heat dots, orphan detection | `system.billing` and `system.access` are accessible but `system.query.history` is not |
| Everything except job stats | Job success rates | `system.lakeflow.job_run_timeline` is not accessible |

Check **Settings → System Access** for per-check status with specific fix instructions.

---

### Check: SQL Warehouse

**Symptom:** "No warehouse configured - system table checks cannot run"

Lattice needs a SQL warehouse to query system tables. The warehouse is configured during Databricks App setup - it injects `DATABRICKS_WAREHOUSE_ID` automatically.

**Fix for Databricks App:** Go to **Compute → Apps → lattice → Settings → Resources** and select a warehouse, then restart the app.

**Fix for local development:**

```bash
export DATABRICKS_WAREHOUSE_ID=<your-warehouse-id>
```

Find your warehouse ID in **SQL → SQL Warehouses → [warehouse name] → Connection details**.

---

### Check: system.billing.usage

**Symptom:** "PERMISSION_DENIED" or "Configure a SQL warehouse first, then grant access"

Required for: cost overlay, DBU badges on nodes.

**Fix (requires account admin):**

```sql
GRANT USE CATALOG ON CATALOG system TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;
```

---

### Check: system.access.table_lineage

**Symptom:** "PERMISSION_DENIED" or "Configure a SQL warehouse first, then grant access"

Required for: lineage edges on the canvas.

**Fix (requires account admin):**

```sql
GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
```

---

### Check: system.query.history

**Symptom:** "PERMISSION_DENIED" or "Configure a SQL warehouse first, then grant access"

Required for: heat dots (hot/warm/cold assets), orphaned table detection.

**Fix (requires account admin):**

```sql
GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
GRANT SELECT ON TABLE system.query.history TO `<principal>`;
```

---

### All system table grants at once

To grant all system table access in one shot (requires **account admin**):

```sql
GRANT USE CATALOG ON CATALOG system TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
GRANT SELECT ON TABLE system.access.column_lineage TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
GRANT SELECT ON TABLE system.query.history TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.lakeflow TO `<principal>`;
GRANT SELECT ON TABLE system.lakeflow.job_run_timeline TO `<principal>`;
```

After running grants, click **Re-check** in Settings → System Access to verify.

---

## Workspace Credentials

**Q: Where are workspace credentials configured?**

Lattice uses the Databricks SDK which auto-discovers credentials in this order:

| Environment | How credentials work |
|---|---|
| **Databricks App** | Auto-injected by the platform - no config needed. Warehouse selected during app setup. |
| **Local dev** | Set `DATABRICKS_PROFILE=<profile>` to select a CLI profile, or set `DATABRICKS_HOST` + `DATABRICKS_TOKEN` directly. |

There is no in-app credential UI - credentials are always set at the environment level.

**To set up a local profile:**
```bash
databricks auth login https://<your-workspace>.cloud.databricks.com --profile my-workspace
export DATABRICKS_PROFILE=my-workspace
```

---

## Common Problems

### Canvas is blank on first load

The graph ingests in the background. A loading indicator appears at the top of the sidebar. Ingestion typically takes 30–90 seconds depending on workspace size.

If it never loads, check the app logs for ingestion errors - look for `[lattice]` log lines.

### First-run wizard doesn't appear

The wizard shows only when `lattice_config.json` doesn't exist (true first run). If you've already completed setup and want to re-run it, delete the config and refresh the page.

### "No catalogs found" in catalog picker

The app identity doesn't have `USE CATALOG` permission on any catalog.

```sql
GRANT USE CATALOG ON CATALOG <catalog_name> TO `<service-principal>`;
```

### App starts but shows "Workspace connection failed"

The Databricks SDK can't authenticate. Check:

1. **Databricks App:** Verify the app is deployed and running - credentials are only injected when the app is active.
2. **Local dev:** Run `databricks auth profiles` to confirm your profile is valid. Re-authenticate if expired.

### Changes to catalog scope don't take effect

After saving new settings, Lattice triggers re-ingestion automatically. Watch for the loading indicator - the graph updates when ingestion completes (30–90s). If re-ingestion doesn't start, try **Refresh Graph** from the sidebar.

### `[pipelines] error: Invalid pageSize: 200 not in range [1, 100]`

This is a non-fatal warning in the logs - the pipelines connector requested too many results. Pipelines will still be ingested with a smaller page size. No action needed.

### `[shares] error: 'SharesAPI' object has no attribute 'list'`

This is a non-fatal warning - the workspace may not have Delta Sharing enabled, or the SDK version doesn't support the shares API. Share and Recipient nodes will be skipped. No action needed.

### `[annotations] WARNING: Could not initialize annotation store`

The annotations feature (tags and notes on assets) requires a SQL warehouse and CREATE TABLE permissions on the annotations catalog. This is optional - all other features work without it.

---

## Getting Help

- **In-app:** Settings → System Access shows the exact error for each failed check with fix instructions
- **Logs:** Check app logs for `[preflight]`, `[lattice]`, and `[annotations]` log lines
- **Issues:** Open a GitHub issue with the output of `GET /api/status` attached
