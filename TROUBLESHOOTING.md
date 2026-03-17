# Lattice — Troubleshooting Guide

This document covers the most common issues when deploying Lattice to a new workspace.
For installation steps, see [INSTALL.md](INSTALL.md).

---

## System Access Checks

Lattice runs pre-flight checks on startup and shows results in the **Settings → System Access** section and in the **first-run wizard**. Each failed check shows inline fix instructions with copy-able SQL or config snippets.

### Check: SQL Warehouse

**Symptom:** "No warehouse configured — system table checks cannot run"

Lattice needs a SQL warehouse to query system tables for usage stats, cost data, lineage, and annotations. Without one, those features are disabled.

**Fix for Databricks App deployment:**

Add a `sql_warehouse` resource to `app.yaml`:

```yaml
resources:
  - name: sql-warehouse
    sql_warehouse:
      id: auto   # or a specific warehouse ID

env:
  - name: DATABRICKS_WAREHOUSE_ID
    valueFrom: sql-warehouse
```

Then redeploy:
```bash
databricks apps deploy lattice --source-code-path /Workspace/Users/<email>/lattice
```

**Fix for local development:**

```bash
export DATABRICKS_WAREHOUSE_ID=<your-warehouse-id>
```

Find your warehouse ID in the Databricks UI under **SQL → SQL Warehouses → [warehouse name] → Connection details**.

---

### Check: system.billing.usage

**Symptom:** "PERMISSION_DENIED" or "Configure a SQL warehouse first, then grant access"

Required for: cost overlay, DBU badges on nodes.

**Fix — run as workspace admin in SQL Editor:**

```sql
GRANT USE CATALOG ON CATALOG system TO `<user-or-group>`;
GRANT USE SCHEMA ON SCHEMA system.billing TO `<user-or-group>`;
GRANT SELECT ON TABLE system.billing.usage TO `<user-or-group>`;
```

- [Databricks docs — billing system table](https://docs.databricks.com/en/administration-guide/system-tables/billing.html)

---

### Check: system.access.table_lineage

**Symptom:** "PERMISSION_DENIED" or "Configure a SQL warehouse first, then grant access"

Required for: lineage edges on the canvas.

**Fix — run as workspace admin in SQL Editor:**

```sql
GRANT USE SCHEMA ON SCHEMA system.access TO `<user-or-group>`;
GRANT SELECT ON TABLE system.access.table_lineage TO `<user-or-group>`;
```

- [Databricks docs — access system table](https://docs.databricks.com/en/administration-guide/system-tables/access.html)

---

### Check: system.query.history

**Symptom:** "PERMISSION_DENIED" or "Configure a SQL warehouse first, then grant access"

Required for: heat dots (hot/warm/cold assets), orphaned table detection.

**Fix — run as workspace admin in SQL Editor:**

```sql
GRANT USE SCHEMA ON SCHEMA system.query TO `<user-or-group>`;
GRANT SELECT ON TABLE system.query.history TO `<user-or-group>`;
```

- [Databricks docs — query history system table](https://docs.databricks.com/en/administration-guide/system-tables/query-history.html)

---

### All system table grants at once

To grant all system table access in one shot, replace `<principal>` with a user email or group name:

```sql
GRANT USE CATALOG ON CATALOG system TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.billing TO `<principal>`;
GRANT SELECT ON TABLE system.billing.usage TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.access TO `<principal>`;
GRANT SELECT ON TABLE system.access.table_lineage TO `<principal>`;
GRANT USE SCHEMA ON SCHEMA system.query TO `<principal>`;
GRANT SELECT ON TABLE system.query.history TO `<principal>`;
```

After running grants, click **Re-check** in Settings → System Access to verify.

---

## Workspace Credentials

**Q: Where are workspace credentials configured?**

Lattice uses the Databricks SDK which auto-discovers credentials in this order:

| Environment | How credentials work |
|---|---|
| **Databricks App** | Auto-injected by the platform — no config needed. `app.yaml` resources declare the warehouse. |
| **Local dev** | Set `DATABRICKS_PROFILE=<profile>` to select a CLI profile, or set `DATABRICKS_HOST` + `DATABRICKS_TOKEN` directly. |

There is no in-app credential UI — credentials are always set at the environment level.

**To set up a local profile:**
```bash
databricks auth login https://<your-workspace>.cloud.databricks.com --profile my-workspace
export DATABRICKS_PROFILE=my-workspace
```

---

## Common Problems

### Canvas is blank on first load

The graph ingests in the background. A loading indicator appears at the top of the sidebar. Ingestion typically takes 30–90 seconds depending on workspace size.

If it never loads, check the server logs for ingestion errors:
```bash
# Look for [lattice] errors in server output
```

### First-run wizard doesn't appear

The wizard shows only when `lattice_config.json` doesn't exist (true first run). If you've already completed setup and want to re-run it, delete the config:

```bash
rm lattice_config.json
```

Then refresh the page.

### "No catalogs found" in catalog picker

The app identity (or your local profile) doesn't have `USE CATALOG` permission on any catalog.

```sql
GRANT USE CATALOG ON CATALOG <catalog_name> TO `<user>`;
```

Or grant on `main` to start:
```sql
GRANT USE CATALOG ON CATALOG main TO `<user>`;
```

### App starts but shows "Workspace connection failed"

The Databricks SDK can't authenticate. Check:

1. **Databricks App:** Verify the app is deployed and running — credentials are only injected when the app is active.
2. **Local dev:** Run `databricks auth profiles` to confirm your profile is valid. Re-authenticate if expired: `databricks auth login <host> --profile <profile>`.

### Changes to catalog scope don't take effect

After saving new catalog/limit settings in Settings, Lattice triggers a re-ingestion automatically. Watch for the loading indicator in the sidebar — the graph will update when ingestion completes (30–90s).

If re-ingestion doesn't start, try **Refresh Graph** from the sidebar.

### `python: command not found` when deploying

`app.yaml` must use `python3`, not `python`. Verify your `app.yaml` command starts with:

```yaml
command:
  - python3
  - -m
  - uvicorn
  - app:app
```

### System table checks show "Requires a SQL warehouse" even after warehouse is configured

The pre-flight checks run once at startup and cache results. After configuring the warehouse:

1. Restart the app (or re-deploy for Databricks Apps)
2. Click **Re-check** in Settings → System Access

---

## Getting Help

- **In-app:** Settings → System Access shows the exact error for each failed check with fix instructions
- **Logs:** Check the server output for `[preflight]` and `[lattice]` log lines
- **Issues:** Open a GitHub issue with the output of `GET /api/status` attached
