"""
AnnotationStore — Delta table persistence for Lattice node annotations.

Annotations are stored in lattice.metadata.annotations (configurable via env vars).
An in-memory cache keeps reads instant; writes hit Delta then update the cache.
All SQL runs through the Statement Execution API using the configured warehouse.

If the warehouse is unavailable or grants are missing on startup, the store marks
itself as unavailable (_initialized = False). The app degrades gracefully — canvas
and all other features remain functional.
"""

import re
import threading
import time
from typing import Optional

import networkx as nx

# Regex for tag validation: lowercase alphanumeric + hyphens, 1-50 chars
_TAG_RE = re.compile(r'^[a-z0-9][a-z0-9\-]{0,49}$')
# FQN validation: alphanumeric, dots, underscores, hyphens, 1-500 chars
_FQN_RE = re.compile(r'^[a-zA-Z0-9_.\-]{1,500}$')

# Built-in tag config: color name + display priority (lowest = shown first on canvas)
BUILTIN_TAG_CONFIG: dict[str, dict] = {
    "critical":        {"color": "red",    "priority": 1},
    "pii":             {"color": "coral",  "priority": 2},
    "needs-migration": {"color": "amber",  "priority": 3},
    "under-review":    {"color": "purple", "priority": 4},
    "deprecated":      {"color": "gray",   "priority": 5},
    "verified":        {"color": "green",  "priority": 6},
}
CUSTOM_TAG_DEFAULT = {"color": "teal", "priority": 99}


def _validate_tag(tag: str) -> str:
    """Normalize and validate a single tag. Returns normalized tag or raises ValueError."""
    tag = tag.strip().lower().replace(" ", "-")
    if not tag:
        raise ValueError("Tag cannot be empty after normalization")
    if not _TAG_RE.match(tag):
        raise ValueError(f"Invalid tag {tag!r}: use lowercase letters, digits, and hyphens only")
    if len(tag) > 50:
        raise ValueError(f"Tag too long: {tag!r} (max 50 chars)")
    return tag


def _validate_fqn(fqn: str) -> str:
    """Validate a fully-qualified name."""
    fqn = fqn.strip()
    if not fqn or not _FQN_RE.match(fqn):
        raise ValueError(f"Invalid FQN: {fqn!r}")
    return fqn


def _escape_sql_string(s: str) -> str:
    """Escape a string for safe interpolation into SQL (single-quote escaping)."""
    return s.replace("'", "''")


class AnnotationStore:
    """
    Persistent annotation store backed by a Delta table.

    Usage:
        store = AnnotationStore(workspace_client, warehouse_id)
        threading.Thread(target=store.initialize, daemon=True).start()

    After initialize() completes, reads are instant (in-memory cache).
    Writes execute SQL then update the cache.
    """

    def __init__(self, workspace_client, warehouse_id: str,
                 catalog: str = "lattice", schema: str = "metadata"):
        self.w = workspace_client
        self.warehouse_id = warehouse_id
        self.catalog = catalog
        self.schema = schema
        self.table_fqn = f"{catalog}.{schema}.annotations"
        self._cache: dict[str, dict] = {}   # keyed by fqn
        self._initialized = False
        self._init_error: Optional[str] = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ #
    #  Startup                                                             #
    # ------------------------------------------------------------------ #

    def initialize(self):
        """
        Bootstrap: create catalog/schema/table if needed, then load all rows.
        Called once on app startup in a background thread.
        Sets _initialized = True on success, logs warning on failure.
        """
        try:
            self._ensure_table_exists()
            self._load_all()
            self._initialized = True
            print(f"[annotations] Initialized: {len(self._cache)} annotations loaded "
                  f"from {self.table_fqn}")
        except Exception as e:
            self._init_error = str(e)
            print(f"[annotations] WARNING: Could not initialize annotation store: {e}")
            print(f"[annotations] Annotations will be unavailable until grants are added.")

    def _ensure_table_exists(self):
        """Create catalog, schema, and table if they don't already exist."""
        stmts = [
            f"CREATE CATALOG IF NOT EXISTS `{_escape_sql_string(self.catalog)}`",
            f"CREATE SCHEMA IF NOT EXISTS `{_escape_sql_string(self.catalog)}`.`{_escape_sql_string(self.schema)}`",
            f"""CREATE TABLE IF NOT EXISTS {self.table_fqn} (
                fqn        STRING    NOT NULL COMMENT 'Fully-qualified asset name',
                tags       ARRAY<STRING> NOT NULL COMMENT 'Tag labels',
                note       STRING    NOT NULL DEFAULT '' COMMENT 'Free-text user note',
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            ) USING DELTA
            COMMENT 'Lattice user annotations and tags on workspace assets'
            TBLPROPERTIES ('delta.enableChangeDataFeed' = 'false')""",
        ]
        for sql in stmts:
            self._exec_sql(sql)

    def _exec_sql(self, sql: str) -> list[dict]:
        """
        Execute SQL via Statement Execution API. Returns rows as list of dicts.
        Raises on error or timeout.
        """
        from databricks.sdk.service.sql import StatementState
        result = self.w.statement_execution.execute_statement(
            statement=sql,
            warehouse_id=self.warehouse_id,
            wait_timeout="30s",
            on_wait_timeout="CANCEL",
        )
        state = result.status.state if result.status else None
        if state not in (StatementState.SUCCEEDED,):
            err = result.status.error if result.status else None
            msg = err.message if err else f"state={state}"
            raise RuntimeError(f"SQL failed: {msg}\nSQL: {sql[:200]}")

        rows = []
        if result.result and result.result.data_array:
            cols = [c.name for c in (result.manifest.schema.columns or [])]
            for row in result.result.data_array:
                rows.append(dict(zip(cols, row)))
        return rows

    def _load_all(self):
        """Load all rows from the Delta table into the in-memory cache."""
        rows = self._exec_sql(f"SELECT fqn, tags, note, created_at, updated_at FROM {self.table_fqn}")
        with self._lock:
            self._cache.clear()
            for row in rows:
                fqn = row.get("fqn", "")
                if not fqn:
                    continue
                # Tags come back as a string like '["critical","pii"]' or as a list
                tags_raw = row.get("tags", [])
                if isinstance(tags_raw, str):
                    import json
                    try:
                        tags_raw = json.loads(tags_raw)
                    except Exception:
                        tags_raw = []
                self._cache[fqn] = {
                    "tags": [t for t in (tags_raw or []) if t],
                    "note": row.get("note", "") or "",
                    "created": row.get("created_at", ""),
                    "updated": row.get("updated_at", ""),
                }

    # ------------------------------------------------------------------ #
    #  Reads (from cache — instant)                                        #
    # ------------------------------------------------------------------ #

    @property
    def available(self) -> bool:
        return self._initialized

    def get_all(self) -> dict:
        """Return the full annotations dict from cache."""
        with self._lock:
            return dict(self._cache)

    def get(self, fqn: str) -> Optional[dict]:
        """Return annotation for a single FQN, or None."""
        with self._lock:
            return self._cache.get(fqn)

    def get_all_tags(self) -> list[str]:
        """Return sorted unique tags across all annotations."""
        with self._lock:
            tags: set[str] = set()
            for ann in self._cache.values():
                tags.update(ann.get("tags", []))
        return sorted(tags)

    def get_tag_config(self) -> dict:
        """Return merged tag config: built-ins + any custom tags in use."""
        config = dict(BUILTIN_TAG_CONFIG)
        with self._lock:
            for ann in self._cache.values():
                for tag in ann.get("tags", []):
                    if tag not in config:
                        config[tag] = dict(CUSTOM_TAG_DEFAULT)
        return config

    # ------------------------------------------------------------------ #
    #  Writes (Delta + cache update)                                       #
    # ------------------------------------------------------------------ #

    def upsert(self, fqn: str, tags: list[str], note: str) -> Optional[dict]:
        """
        Create or update annotation. Returns saved annotation dict.
        If tags is empty AND note is empty, deletes the annotation and returns None.
        Tags are validated and normalized before saving.
        """
        if not self._initialized:
            raise RuntimeError("Annotation store is not initialized")

        fqn = _validate_fqn(fqn)
        note = (note or "").strip()
        if len(note) > 2000:
            raise ValueError("Note exceeds maximum length of 2000 characters")

        normalized_tags = []
        if tags:
            if len(tags) > 20:
                raise ValueError("Cannot assign more than 20 tags per node")
            for t in tags:
                normalized_tags.append(_validate_tag(t))
            normalized_tags = list(dict.fromkeys(normalized_tags))  # dedupe, preserve order

        # Empty tags + empty note = delete
        if not normalized_tags and not note:
            self.delete(fqn)
            return None

        safe_fqn = _escape_sql_string(fqn)
        safe_note = _escape_sql_string(note)
        tags_literal = ", ".join(f"'{_escape_sql_string(t)}'" for t in normalized_tags)
        array_expr = f"ARRAY({tags_literal})" if tags_literal else "ARRAY()"

        sql = f"""
            MERGE INTO {self.table_fqn} AS t
            USING (SELECT '{safe_fqn}' AS fqn) AS s ON t.fqn = s.fqn
            WHEN MATCHED THEN UPDATE SET
                tags = {array_expr},
                note = '{safe_note}',
                updated_at = current_timestamp()
            WHEN NOT MATCHED THEN INSERT (fqn, tags, note, created_at, updated_at)
                VALUES ('{safe_fqn}', {array_expr}, '{safe_note}',
                        current_timestamp(), current_timestamp())
        """
        with self._lock:
            self._exec_sql(sql)
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            existing = self._cache.get(fqn, {})
            entry = {
                "tags": normalized_tags,
                "note": note,
                "created": existing.get("created", now),
                "updated": now,
            }
            self._cache[fqn] = entry
            return dict(entry)

    def delete(self, fqn: str) -> bool:
        """Delete annotation. Returns True if row existed."""
        if not self._initialized:
            raise RuntimeError("Annotation store is not initialized")
        fqn = _validate_fqn(fqn)
        safe_fqn = _escape_sql_string(fqn)
        with self._lock:
            existed = fqn in self._cache
            if existed:
                self._exec_sql(f"DELETE FROM {self.table_fqn} WHERE fqn = '{safe_fqn}'")
                del self._cache[fqn]
        return existed

    def bulk_upsert(self, fqns: list[str], tags: list[str], note: str) -> int:
        """
        Merge the same tags+note into multiple FQNs.
        Tags are unioned with existing tags (not replaced).
        Note is appended with newline separator if a note already exists.
        Uses a single MERGE statement for efficiency.
        Returns count of affected rows.
        """
        if not self._initialized:
            raise RuntimeError("Annotation store is not initialized")
        if not fqns:
            return 0

        note = (note or "").strip()
        if len(note) > 2000:
            raise ValueError("Note exceeds maximum length of 2000 characters")

        normalized_tags: list[str] = []
        if tags:
            if len(tags) > 20:
                raise ValueError("Cannot assign more than 20 tags at once")
            for t in tags:
                normalized_tags.append(_validate_tag(t))
            normalized_tags = list(dict.fromkeys(normalized_tags))

        validated_fqns = [_validate_fqn(f) for f in fqns]
        tags_literal = ", ".join(f"'{_escape_sql_string(t)}'" for t in normalized_tags)
        array_expr = f"ARRAY({tags_literal})" if tags_literal else "ARRAY()"
        safe_note = _escape_sql_string(note)

        # Build VALUES list
        values_list = ", ".join(f"('{_escape_sql_string(f)}')" for f in validated_fqns)

        sql = f"""
            MERGE INTO {self.table_fqn} AS t
            USING (VALUES {values_list}) AS s(fqn) ON t.fqn = s.fqn
            WHEN MATCHED THEN UPDATE SET
                tags = array_distinct(array_union(t.tags, {array_expr})),
                note = CASE
                    WHEN '{safe_note}' = '' THEN t.note
                    WHEN t.note = '' THEN '{safe_note}'
                    ELSE concat(t.note, '\\n', '{safe_note}')
                END,
                updated_at = current_timestamp()
            WHEN NOT MATCHED THEN INSERT (fqn, tags, note, created_at, updated_at)
                VALUES (s.fqn, {array_expr}, '{safe_note}',
                        current_timestamp(), current_timestamp())
        """
        with self._lock:
            self._exec_sql(sql)
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            for fqn in validated_fqns:
                existing = self._cache.get(fqn, {})
                existing_tags = existing.get("tags", [])
                merged_tags = list(dict.fromkeys(existing_tags + normalized_tags))
                existing_note = existing.get("note", "")
                if note and existing_note:
                    merged_note = existing_note + "\n" + note
                elif note:
                    merged_note = note
                else:
                    merged_note = existing_note
                self._cache[fqn] = {
                    "tags": merged_tags,
                    "note": merged_note,
                    "created": existing.get("created", now),
                    "updated": now,
                }
        return len(validated_fqns)

    # ------------------------------------------------------------------ #
    #  Graph integration                                                   #
    # ------------------------------------------------------------------ #

    def merge_into_graph(self, graph: nx.DiGraph):
        """
        Attach _annotations attribute to graph nodes that have annotations.
        Nodes without annotations get _annotations = None.
        Called after graph construction and after each annotation write.
        """
        with self._lock:
            cache_snapshot = dict(self._cache)
        for node_id in graph.nodes:
            attrs = graph.nodes[node_id]
            fqn = attrs.get("fqn", "")
            ann = cache_snapshot.get(fqn)
            if ann:
                attrs["_annotations"] = {
                    "tags": ann["tags"],
                    "note": ann["note"],
                    "created": ann.get("created", ""),
                    "updated": ann.get("updated", ""),
                }
            else:
                attrs["_annotations"] = None

    def get_descendants_fqns(self, node_id: str, graph: nx.DiGraph) -> list[str]:
        """
        BFS over 'contains' edges to get all descendant FQNs.
        Used for the "apply to all children" prompt on Schema/Catalog nodes.
        """
        import networkx as nx_mod
        fqns = []
        for desc_id in nx_mod.descendants(graph, node_id):
            fqn = graph.nodes[desc_id].get("fqn", "")
            if fqn:
                fqns.append(fqn)
        return fqns
