"""
Pre-flight checks: verify workspace connectivity and feature availability.
Runs in a background thread on startup and on /api/refresh.
Results are cached and served via GET /api/status.
"""
import threading
import time
from typing import Optional


class PreflightChecker:
    def __init__(self, workspace_client, warehouse_id: str = "", user_email: str = ""):
        self.w = workspace_client
        self.warehouse_id = warehouse_id
        self.user_email = user_email  # filled in after workspace check, used in fix_sql
        self._results: dict | None = None
        self._running = False
        self._lock = threading.Lock()

    def run(self):
        """Run all checks synchronously. Call in a background thread."""
        with self._lock:
            self._running = True

        checks = []
        user_identity = self.user_email

        # ── 1. Workspace connectivity ──────────────────────────────────────────
        try:
            me = self.w.current_user.me()
            user_identity = me.user_name or me.display_name or ""
            self.user_email = user_identity
            checks.append({
                "key": "workspace",
                "name": "Workspace connection",
                "description": "Lattice can connect to your Databricks workspace",
                "enabled_feature": "Everything",
                "ok": True,
                "error": None,
                "fix_sql": None,
                "docs_url": None,
            })
        except Exception as e:
            checks.append({
                "key": "workspace",
                "name": "Workspace connection",
                "description": "Lattice can connect to your Databricks workspace",
                "enabled_feature": "Everything",
                "ok": False,
                "error": str(e),
                "fix_sql": None,
                "docs_url": "https://docs.databricks.com/en/dev-tools/auth/index.html",
            })
            # If workspace is unreachable, remaining checks will all fail — still run them
            # to provide a complete picture

        # ── 2. Catalogs accessible ─────────────────────────────────────────────
        catalog_count = 0
        try:
            for c in self.w.catalogs.list():
                if c.name and not c.name.startswith("__"):
                    catalog_count += 1
                if catalog_count >= 3:
                    break
            checks.append({
                "key": "catalogs",
                "name": "Unity Catalog access",
                "description": f"Can read workspace catalogs ({catalog_count}+ found)",
                "enabled_feature": "UC Tree, all catalog assets",
                "ok": catalog_count > 0,
                "error": None if catalog_count > 0 else "No accessible catalogs found",
                "fix_sql": (
                    f"GRANT USE CATALOG ON CATALOG <catalog_name> TO `{user_identity}`;"
                    if catalog_count == 0 else None
                ),
                "docs_url": "https://docs.databricks.com/en/data-governance/unity-catalog/manage-privileges/index.html",
            })
        except Exception as e:
            checks.append({
                "key": "catalogs",
                "name": "Unity Catalog access",
                "description": "Can read workspace catalogs",
                "enabled_feature": "UC Tree, all catalog assets",
                "ok": False,
                "error": str(e),
                "fix_sql": f"GRANT USE CATALOG ON CATALOG <catalog_name> TO `{user_identity}`;",
                "docs_url": "https://docs.databricks.com/en/data-governance/unity-catalog/manage-privileges/index.html",
            })

        # ── 3. SQL warehouse ───────────────────────────────────────────────────
        wh_ok = bool(self.warehouse_id)
        wh_desc = (
            f"Warehouse configured: {self.warehouse_id}" if wh_ok
            else "No SQL warehouse configured"
        )
        # For Databricks Apps: app.yaml declares the warehouse resource.
        # For local dev: set DATABRICKS_WAREHOUSE_ID env var.
        warehouse_fix = (
            "# In app.yaml, add a sql_warehouse resource:\n"
            "resources:\n"
            "  - name: sql-warehouse\n"
            "    sql_warehouse:\n"
            "      id: auto   # or a specific warehouse ID\n\n"
            "# Then reference it:\n"
            "env:\n"
            "  - name: DATABRICKS_WAREHOUSE_ID\n"
            "    valueFrom: sql-warehouse\n\n"
            "# For local dev, set the env var directly:\n"
            "# export DATABRICKS_WAREHOUSE_ID=<warehouse-id>"
        )
        checks.append({
            "key": "warehouse",
            "name": "SQL warehouse",
            "description": wh_desc,
            "enabled_feature": "Usage stats, cost data, lineage, annotations",
            "ok": wh_ok,
            "error": None if wh_ok else "No warehouse configured — system table checks cannot run",
            "fix_sql": None if wh_ok else warehouse_fix,
            "docs_url": "https://docs.databricks.com/en/compute/sql-warehouse/create.html",
        })

        # ── 4–6. System tables (only if warehouse available) ───────────────────
        system_checks = [
            {
                "key": "billing_usage",
                "name": "system.billing.usage",
                "description": "DBU cost data per compute resource (30 days)",
                "enabled_feature": "Cost overlay, DBU badges on nodes",
                "sql": "SELECT 1 FROM system.billing.usage LIMIT 1",
                "grant": (
                    f"GRANT USE CATALOG ON CATALOG system TO `{user_identity}`;\n"
                    f"GRANT USE SCHEMA ON SCHEMA system.billing TO `{user_identity}`;\n"
                    f"GRANT SELECT ON TABLE system.billing.usage TO `{user_identity}`;"
                ),
                "docs_url": "https://docs.databricks.com/en/administration-guide/system-tables/billing.html",
            },
            {
                "key": "table_lineage",
                "name": "system.access.table_lineage",
                "description": "Data lineage edges between tables",
                "enabled_feature": "Lineage edges on canvas",
                "sql": "SELECT 1 FROM system.access.table_lineage LIMIT 1",
                "grant": (
                    f"GRANT USE SCHEMA ON SCHEMA system.access TO `{user_identity}`;\n"
                    f"GRANT SELECT ON TABLE system.access.table_lineage TO `{user_identity}`;"
                ),
                "docs_url": "https://docs.databricks.com/en/administration-guide/system-tables/access.html",
            },
            {
                "key": "query_history",
                "name": "system.query.history",
                "description": "Per-table query counts and last-queried timestamps",
                "enabled_feature": "Heat dots (hot/warm/cold), orphaned table detection",
                "sql": "SELECT 1 FROM system.query.history LIMIT 1",
                "grant": (
                    f"GRANT USE SCHEMA ON SCHEMA system.query TO `{user_identity}`;\n"
                    f"GRANT SELECT ON TABLE system.query.history TO `{user_identity}`;"
                ),
                "docs_url": "https://docs.databricks.com/en/administration-guide/system-tables/query-history.html",
            },
        ]

        for sc in system_checks:
            if not wh_ok:
                # Can't test without a warehouse, but show the grant SQL so the
                # user can prepare permissions while configuring the warehouse.
                checks.append({
                    "key": sc["key"],
                    "name": sc["name"],
                    "description": sc["description"],
                    "enabled_feature": sc["enabled_feature"],
                    "ok": False,
                    "error": "Configure a SQL warehouse first, then grant access",
                    "fix_sql": sc["grant"],
                    "docs_url": sc["docs_url"],
                })
                continue

            ok, error = self._check_sql(sc["sql"])
            checks.append({
                "key": sc["key"],
                "name": sc["name"],
                "description": sc["description"],
                "enabled_feature": sc["enabled_feature"],
                "ok": ok,
                "error": error,
                "fix_sql": None if ok else sc["grant"],
                "docs_url": sc["docs_url"],
            })

        with self._lock:
            self._results = {
                "ready": True,
                "running": False,
                "user": user_identity,
                "warehouse_id": self.warehouse_id,
                "checked_at": time.time(),
                "checks": checks,
            }
            self._running = False

    def _check_sql(self, sql: str) -> tuple[bool, Optional[str]]:
        """Execute a quick SQL probe via Statement Execution API."""
        try:
            from databricks.sdk.service.sql import StatementState, Disposition, Format
            stmt = self.w.statement_execution.execute_statement(
                warehouse_id=self.warehouse_id,
                statement=sql,
                wait_timeout="15s",
                on_wait_timeout="CANCEL",
                disposition=Disposition.INLINE,
                format=Format.JSON_ARRAY,
            )
            if stmt.status and stmt.status.state == StatementState.SUCCEEDED:
                return True, None
            err = ""
            if stmt.status and stmt.status.error:
                err = stmt.status.error.message or "Query failed"
            return False, err or "Query failed"
        except Exception as e:
            return False, str(e)

    def get_status(self) -> dict:
        with self._lock:
            if self._results is None:
                return {"ready": False, "running": self._running, "checks": [], "user": None, "warehouse_id": self.warehouse_id}
            return dict(self._results)
