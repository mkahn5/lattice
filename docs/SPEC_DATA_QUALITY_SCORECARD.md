# Lattice Workspace Governance Scorecard - Feature Spec

**Author:** Mike Kahn
**Status:** Final - ready for implementation
**Date:** 2026-03-25
**Version target:** v0.6.0

---

## 1. Overview

The Scorecard gives any team an instant health check on their Databricks workspace.
One install, one ingestion cycle, and they get a composite governance score with a
prioritized list of what to fix. The score is computed entirely from the in-memory
NetworkX graph - no new SQL queries, no additional system table access beyond what
enrichment already provides.

**Design principles:**
- Full-screen overlay - canvas stays untouched underneath, state preserved between open/close
- Graceful degradation - dimensions that lack data show "N/A" and weight is redistributed
- The offenders list is the product, the composite score is the headline
- Workspace Structure insights are observational, not scored
- Notes section turns the scorecard from a read-only report into a working document

---

## 2. Dimensions & Weights

Five scored dimensions, all high-confidence signals. Three dropped dimensions
(Lineage Coverage, Job Reliability, Documentation) remain as offender categories
but don't move the composite score.

| # | Dimension | Weight | Signal Source | What It Measures |
|---|-----------|--------|---------------|------------------|
| 1 | **Freshness** | 35% | `heat`, `last_queried`, `days_since_query` on Table/View nodes | % of tables queried or modified within staleness window (default 30d). Cold + costly tables are highest-priority offenders. |
| 2 | **Cost Efficiency** | 25% | Cost attribution data (`/api/cost`) + node `heat` | Inverse of waste: penalizes tables with high attributed DBU and no recent query activity. `score = 1 - (wasteful_dbu / total_dbu)` |
| 3 | **Orphan Rate** | 20% | Graph edge presence (all non-structural edges) | % of tables with at least one non-structural edge - any `queries`, `derivedFrom`, `feedsInto`, `writesTo`, `readsFrom`, `indexesFrom` relationship. True orphans have no connection to any job, dashboard, view, or other table. |
| 4 | **UC Tag Coverage** | 10% | `uc_tags` field on Table/View nodes (from `system.information_schema.table_tags`) | % of tables with at least one UC tag. Binary and intentional - someone had to explicitly tag it. |
| 5 | **Compute Utilization** | 10% | `dbu_30d` on Warehouse/Cluster/Serverless nodes | % of compute resources (warehouses + clusters) with meaningful DBU activity in last 30 days. Idle compute is pure waste. |

**Total:** 100%

**Weight rationale:**
- Tier 1 (Freshness + Cost + Orphans = 80%) - operational health: real waste, real abandonment
- Tier 2 (Tags + Compute = 20%) - governance hygiene: intentional management of shared resources

### Dropped Dimensions (offenders list only)

These are valuable as actionable items but too noisy or low-confidence to score:

| Former Dimension | Why Dropped | Offender Categories Kept |
|-----------------|-------------|--------------------------|
| **Job Reliability** | Noisy (retries, cancels, dev/test), overlaps with native Databricks monitoring | Failing Jobs, Stale Jobs, Degrading Jobs |
| **Lineage Coverage** | 30-day window blind spots, Spark notebooks invisible, can't distinguish bad governance from different tooling | Orphaned Tables (subsumed into Orphan Rate with broader edge check) |
| **Documentation** | Presence ≠ quality, low motivational value for most teams | Undocumented Tables (in offenders list, prioritized by query frequency) |

---

## 3. Scoring Thresholds

Each dimension scores 0–100 based on its metric percentage:

| Score | Freshness (% fresh) | Cost Efficiency (% efficient) | Orphan Rate (% connected) | Tag Coverage (% tagged) | Compute Util (% active) |
|-------|---------------------|-------------------------------|---------------------------|-------------------------|-------------------------|
| 100 | ≥90% | ≥95% efficient | ≥90% connected | ≥80% tagged | ≥90% active |
| 75 | ≥70% | ≥85% | ≥75% | ≥60% | ≥70% |
| 50 | ≥50% | ≥75% | ≥60% | ≥40% | ≥50% |
| 25 | ≥30% | ≥60% | ≥40% | ≥20% | ≥30% |
| 0 | <30% | <60% | <40% | <20% | <30% |

> **Note:** Thresholds should be validated against 3–5 real workspaces before launch.
> If the distribution clusters too tightly, adjust so grades feel meaningful.

---

## 4. Composite Score & Grading

### 4.1 Calculation

```
composite = (freshness × 0.35) + (cost_efficiency × 0.25) + (orphan_rate × 0.20)
           + (tag_coverage × 0.10) + (compute_utilization × 0.10)
```

### 4.2 Grade Brackets

| Grade | Range | Label |
|-------|-------|-------|
| A | 80–100 | Well-governed |
| B | 65–79 | Healthy with gaps |
| C | 50–64 | Needs attention |
| D | 35–49 | At risk |
| F | 0–34 | Critical |

### 4.3 Delta Signal

Compare current composite to the score from the previous cached graph (last ingestion):
- `+N` / `-N` with directional arrow (▲ / ▼ / —)
- If no previous graph exists (first ingestion): show "Baseline"
- Single-comparison delta, not a full trend line (trend deferred to v2)

### 4.4 Graceful Degradation (N/A Reweighting)

If a dimension has no data (e.g., no cost data → Cost Efficiency is N/A):
- Show "N/A" for that dimension
- Redistribute its weight proportionally across available dimensions
- Example: Cost Efficiency (25%) is N/A → remaining 4 dimensions get proportional boost:
  Freshness 35→46.7%, Orphan Rate 20→26.7%, Tags 10→13.3%, Compute 10→13.3%

---

## 5. Offenders List

The offenders list is **the product** - the score is just the headline. Each item
answers: "fix this to improve your workspace."

### 5.1 Offender Categories

| Category | Trigger | Detail Fields |
|----------|---------|---------------|
| **Cold + Costly Tables** | No queries in 30d AND attributed DBU > P75 | FQN, days since last query, monthly DBU |
| **Idle Compute** | Warehouse/Cluster with 0 DBU in 30d but state not TERMINATED | Name, type, state, last activity |
| **Orphaned Tables** | No non-structural edges (no job, dashboard, view, or table references it) | FQN, creation date, DBU cost |
| **Untagged Tables** | Zero UC tags | FQN, catalog, schema |
| **Failing Jobs** | Success rate < 80% in last 30d | Job name, success rate, last failure, downstream table count |
| **Stale Jobs** | Job exists but no runs in 30d | Job name, last run date, downstream table count |
| **Undocumented Tables** | No table-level comment | FQN, query frequency (prioritize high-traffic undocumented) |

### 5.2 Impact Ranking

Each offender gets an estimated impact score:

```
impact = dimension_weight × (points_recovered / max_possible_in_dimension)
```

Offenders sorted by impact descending. Top 10 shown by default, "Show all" to expand.

### 5.3 Grouping

Grouped by category in the UI, sorted globally by impact. Category headers show
count (e.g., "Cold + Costly Tables (7)").

---

## 6. Workspace Structure (Companion Insight - Not Scored)

Observations about workspace organization surfaced alongside the scorecard.
These are informational - they don't contribute to the composite score because
"good structure" is subjective and varies by team convention.

### 6.1 Observations Detected

| Observation | Trigger | Severity |
|-------------|---------|----------|
| **Oversized schemas** | Schema has 200+ tables | Warning |
| **Tables in default schema** | Tables exist in `default` schema | Warning |
| **Empty schemas** | Schema has 0 tables | Info |
| **Single-table schemas** | Schema has exactly 1 table | Info |
| **Catalog concentration** | >80% of tables in a single catalog | Info |
| **Well-sized schemas** | Schemas with 5–100 tables | Positive |

### 6.2 UI

Displayed in the scorecard panel below the offenders list as "Workspace Structure":

```
Workspace Structure
  ⚠ 3 schemas have 200+ tables (silver: 412, bronze: 389, staging: 234)
  ⚠ 47 tables in 'default' schema
  ⚠ 12 empty schemas (no tables)
  ✓ 18 schemas with 5–100 tables (well-sized)
```

Observations are sorted: warnings first, then info, then positive.

### 6.3 API

Included in the `/api/scorecard` response as a `workspace_structure` array:

```json
"workspace_structure": [
  {
    "observation": "oversized_schemas",
    "severity": "warning",
    "message": "3 schemas have 200+ tables",
    "details": [
      {"schema": "prod.silver", "table_count": 412},
      {"schema": "prod.bronze", "table_count": 389},
      {"schema": "prod.staging", "table_count": 234}
    ]
  },
  {
    "observation": "default_schema_tables",
    "severity": "warning",
    "message": "47 tables in 'default' schema",
    "details": [{"catalog": "prod", "table_count": 47}]
  },
  {
    "observation": "well_sized_schemas",
    "severity": "positive",
    "message": "18 schemas with 5–100 tables",
    "details": []
  }
]
```

---

## 7. Per-Catalog Breakdown

Every scored node carries `catalog_name`. Per-catalog breakdown groups scores
by catalog and computes the same 5 dimensions independently.

### 7.1 UI

- Panel headline shows **workspace-level composite**
- Below: collapsible **"By Catalog"** section with mini-bar per catalog, sorted worst-first
- Clicking a catalog filters the offenders list to that catalog

### 7.2 Edge Cases

- Single-catalog workspace: "By Catalog" section hidden
- Foreign catalogs: excluded from scoring (no cost/freshness data on provider side)
- System catalogs (`system`, `__databricks_internal`): excluded

---

## 8. UI Design

Full-screen overlay on top of the canvas. Canvas stays mounted and untouched
underneath - no resize, no reflow, no ReactFlow changes. The overlay preserves
its state (scroll position, catalog filter, notes) when dismissed and reopened.

Reference mockup: `docs/scorecard-mockup.html`

### 8.1 Trigger & Dismiss

- **Open:** "Scorecard" button in the sidebar (below Health section) or keyboard
  shortcut (`G` for governance). Hidden until first enriched ingestion completes.
- **Dismiss:** Click backdrop, press `Escape`, or click X button in overlay header.
- **State preserved:** Scroll position, catalog filter selection, and notes persist
  in Zustand store. Reopening returns to exactly where the user left off.

### 8.2 Layout

Full-screen overlay with semi-transparent backdrop. Two-panel grid inside:

```
┌─────────────────────────┬──────────────────────────────────────────┐
│   GOVERNANCE SCORECARD  │  RECOMMENDATIONS              [X close] │
│                         │                                          │
│   68        [B] ▲+3    │  Fix top 5 to move from B(68) → B(74)   │
│             vs. prev    │                                          │
│                         │  COLD + COSTLY TABLES (7)                │
│   Freshness        72   │  ┌──────────────────────────────────┐    │
│   ████████████░░░░░░░   │  │ prod.bronze.raw_events    +4.2  │    │
│                         │  │ 94 days stale · 124 DBU/mo      │    │
│   Cost Efficiency  58   │  └──────────────────────────────────┘    │
│   ██████████░░░░░░░░░   │  ┌──────────────────────────────────┐    │
│                         │  │ prod.bronze.legacy_impr   +3.8  │    │
│   Orphan Rate      65   │  │ 182 days stale · 89 DBU/mo      │    │
│   ███████████░░░░░░░░   │  └──────────────────────────────────┘    │
│                         │                                          │
│   Tag Coverage     38   │  IDLE COMPUTE (2)                        │
│   ██████░░░░░░░░░░░░░   │  ┌──────────────────────────────────┐    │
│                         │  │ legacy-warehouse          +2.1  │    │
│   Compute Util     90   │  │ STOPPED · 0 DBU/30d              │    │
│   ████████████████░░░   │  └──────────────────────────────────┘    │
│                         │                                          │
│   ── By catalog ──      │  ORPHANED TABLES (14)                    │
│   prod    ████████ 72   │  ┌──────────────────────────────────┐    │
│   staging ██████░ 61    │  │ staging.analytics.tmp_cohort +1.4│    │
│   dev     █████░░ 51    │  │ No upstream · created 2025-08-14 │    │
│                         │  └──────────────────────────────────┘    │
│   ── Notes ──           │                                          │
│   Ask James about his   │  WORKSPACE STRUCTURE                     │
│   tables that are not   │  ⚠ 3 schemas have 200+ tables           │
│   being used in bronze. │  ⚠ 47 tables in 'default' schema        │
│   ___________________   │  ✓ 18 schemas well-sized (5–100)        │
│                         │                                          │
│   [Export]              │                                          │
└─────────────────────────┴──────────────────────────────────────────┘
```

### 8.3 Left Panel: Scorecard

- **Headline:** Large composite score (42px) + grade badge (colored pill) + delta arrow
- **Delta note:** "vs. previous ingestion" in muted text below
- **Dimension bars:** 5 bars, one per dimension. Color coding:
  - Green fill: score ≥ 65
  - Amber fill: score 35–64
  - Red fill: score < 35
- **By Catalog:** Collapsible section. Mini progress bars sorted worst-first.
  Clicking a catalog filters the recommendations panel to that catalog.
- **Notes:** Free-text textarea for user annotations. Auto-saves on blur.
  Persisted in `lattice_config.json` keyed by workspace profile. Included in
  all exports. Timestamp of last edit shown in muted text. Examples:
  - "Ask James about his tables that are not being used in bronze."
  - "Follow up on etl_daily_refresh failures with data eng team."
  - "Reviewed with platform team 3/26 - tagging sprint planned for April."
- **Export button:** Opens export options (JSON, CSV, Markdown).

### 8.4 Right Panel: Recommendations

- **Fix-to-target banner:** Blue highlight box: "Fix the top 5 items to move
  from B (68) → B (74)". Estimate computed from offender impact scores.
- **Catalog filter:** Dropdown at top right, defaults to "All catalogs".
  Populated from `by_catalog` response.
- **Offender groups:** Grouped by category with count in header (e.g.,
  "COLD + COSTLY TABLES (7)"). Groups sorted by total impact.
- **Each offender card:** FQN (monospace), detail line (days stale, DBU, success
  rate, etc.), impact badge on right (colored: red for high, amber for medium).
- **Top 10 by default**, "Show all" expansion per group.
- **Workspace Structure:** Below offender groups. Observations with severity
  icons (⚠ warning, ✓ positive). Not scored, informational.

### 8.5 Visual Style

Follows the reference mockup aesthetic:
- Clean, minimal, system font stack
- Subtle borders (0.5px, `rgba(0,0,0,0.12)`)
- Muted label text, monospace FQNs
- Impact badges as small colored pills (+4.2 pts)
- Supports dark mode via `prefers-color-scheme`
- Overlay backdrop: semi-transparent (`rgba(0,0,0,0.4)`)

### 8.6 Export Options

Three export formats, accessible from the "Export" button. All include notes.

| Format | Content | Use Case |
|--------|---------|----------|
| **JSON** | Full scorecard API response + notes | Agent workflows, programmatic consumption |
| **CSV** | Offenders list as flat table + notes as header row | Spreadsheet analysis, assign owners, track fixes |
| **Markdown** | Summary report: score, dimensions, top offenders, notes | Slack, Confluence, team communication |

### 8.7 Workflow

The intended user flow:

1. User clicks "Scorecard" in sidebar → overlay opens with score + recommendations
2. User reads recommendations, adds notes ("Ask James about bronze tables")
3. User dismisses overlay (Escape or backdrop click) → canvas is right where they left it
4. User searches/browses canvas to investigate specific assets
5. User reopens scorecard → same scroll position, same notes, same catalog filter
6. User clicks "Export" → copies Markdown to clipboard, pastes in Slack

### 8.8 Canvas Integration

- v1: No canvas changes. Overlay is self-contained. Canvas untouched underneath.
- v2 (future): clicking an offender card dismisses the overlay and auto-focuses
  that node on the canvas with its detail panel open.

---

## 9. API Design

### 9.1 Endpoint

```
GET /api/scorecard
```

### 9.2 Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `catalog` | string | (all) | Filter to a specific catalog |
| `staleness_days` | int | 30 | Configurable staleness window |
| `top_offenders` | int | 10 | Number of offenders per category |

### 9.3 Response Schema

```json
{
  "available": true,
  "score": {
    "composite": 68,
    "grade": "B",
    "label": "Healthy with gaps",
    "delta": 3,
    "delta_direction": "up",
    "previous_composite": 65,
    "computed_at": "2026-03-25T14:30:00Z"
  },
  "dimensions": [
    {
      "name": "Freshness",
      "key": "freshness",
      "score": 78,
      "weight": 0.35,
      "weighted_contribution": 27.3,
      "available": true,
      "detail": {
        "total_tables": 340,
        "fresh_tables": 265,
        "cold_tables": 75,
        "staleness_window_days": 30
      }
    },
    {
      "name": "Cost Efficiency",
      "key": "cost_efficiency",
      "score": 72,
      "weight": 0.25,
      "weighted_contribution": 18.0,
      "available": true,
      "detail": {
        "total_monthly_dbu": 12400,
        "wasteful_monthly_dbu": 3472,
        "wasteful_table_count": 38
      }
    },
    {
      "name": "Orphan Rate",
      "key": "orphan_rate",
      "score": 65,
      "weight": 0.20,
      "weighted_contribution": 13.0,
      "available": true,
      "detail": {
        "total_tables": 340,
        "connected_tables": 221,
        "orphaned_tables": 119,
        "edge_types_checked": ["queries", "derivedFrom", "feedsInto", "writesTo", "readsFrom", "indexesFrom"]
      }
    },
    {
      "name": "UC Tag Coverage",
      "key": "tag_coverage",
      "score": 43,
      "weight": 0.10,
      "weighted_contribution": 4.3,
      "available": true,
      "detail": {
        "total_tables": 340,
        "tagged_tables": 146,
        "untagged_tables": 194
      }
    },
    {
      "name": "Compute Utilization",
      "key": "compute_utilization",
      "score": 90,
      "weight": 0.10,
      "weighted_contribution": 9.0,
      "available": true,
      "detail": {
        "total_compute": 10,
        "active_compute": 9,
        "idle_compute": 1,
        "idle_names": ["legacy-warehouse"]
      }
    }
  ],
  "offenders": [
    {
      "category": "cold_costly_tables",
      "label": "Cold + Costly Tables",
      "count": 7,
      "items": [
        {
          "id": "table:prod.bronze.raw_events",
          "fqn": "prod.bronze.raw_events",
          "name": "raw_events",
          "days_since_last_query": 94,
          "monthly_dbu": 124.5,
          "impact_score": 4.2
        }
      ]
    },
    {
      "category": "idle_compute",
      "label": "Idle Compute",
      "count": 1,
      "items": [
        {
          "id": "warehouse:abc123",
          "name": "legacy-warehouse",
          "type": "Warehouse",
          "state": "STOPPED",
          "dbu_30d": 0
        }
      ]
    },
    {
      "category": "orphaned_tables",
      "label": "Orphaned Tables",
      "count": 119,
      "items": []
    },
    {
      "category": "untagged_tables",
      "label": "Untagged Tables",
      "count": 194,
      "items": []
    },
    {
      "category": "failing_jobs",
      "label": "Failing Jobs",
      "count": 3,
      "items": [
        {
          "id": "job:123",
          "name": "etl_daily_refresh",
          "success_rate_pct": 65.0,
          "last_failure": "2026-03-23T08:12:00Z",
          "downstream_table_count": 12,
          "impact_score": 3.1
        }
      ]
    },
    {
      "category": "undocumented_tables",
      "label": "Undocumented Tables",
      "count": 160,
      "items": []
    }
  ],
  "workspace_structure": [
    {
      "observation": "oversized_schemas",
      "severity": "warning",
      "message": "3 schemas have 200+ tables",
      "details": [
        {"schema": "prod.silver", "table_count": 412},
        {"schema": "prod.bronze", "table_count": 389}
      ]
    },
    {
      "observation": "default_schema_tables",
      "severity": "warning",
      "message": "47 tables in 'default' schema",
      "details": [{"catalog": "prod", "table_count": 47}]
    },
    {
      "observation": "well_sized_schemas",
      "severity": "positive",
      "message": "18 schemas with 5–100 tables",
      "details": []
    }
  ],
  "by_catalog": [
    {
      "catalog_name": "prod",
      "composite": 72,
      "grade": "B",
      "table_count": 210,
      "dimensions": {}
    },
    {
      "catalog_name": "dev",
      "composite": 51,
      "grade": "C",
      "table_count": 130,
      "dimensions": {}
    }
  ],
  "notes": "Ask James about his tables that are not being used in bronze.\nFollow up on etl_daily_refresh failures with data eng team.",
  "notes_updated_at": "2026-03-26T10:15:00Z",
  "table_count": 340,
  "compute_count": 10,
  "enrichment_available": true
}
```

When enrichment is unavailable:
```json
{
  "available": false,
  "reason": "Workspace Governance Score requires system table access. Configure a SQL warehouse and grant access in Settings.",
  "enrichment_available": false
}
```

---

## 10. Backend Implementation

### 10.1 Compute Path

All scoring computed from in-memory NetworkX DiGraph. No new SQL queries.

```
GET /api/scorecard
  → read graph nodes + edges from memory
  → compute each dimension score
  → compute composite + grade (with N/A reweighting)
  → compare to previous cached score
  → detect offenders + rank by impact
  → detect workspace structure observations
  → group by catalog
  → return JSON
```

### 10.2 New Files

| File | Contents | Estimated Lines |
|------|----------|-----------------|
| `server/graph/scorecard.py` | Dimension scoring functions, composite calc, reweighting, offender detection, impact ranking, structure observations, per-catalog grouping | ~250 |

### 10.3 Modified Files

| File | Changes |
|------|---------|
| `server/api/routes.py` | New `GET /api/scorecard` endpoint (~30 lines) |
| `app.py` | Persist `scorecard_snapshot` in graph cache metadata for delta (~10 lines) |
| `frontend/src/stores/graphStore.ts` | Add scorecard types + fetch action (~30 lines) |

### 10.4 New Frontend Components

| Component | Description | Estimated Lines |
|-----------|-------------|-----------------|
| `ScorecardOverlay.tsx` | Full-screen overlay with backdrop, dismiss handlers, two-panel grid | ~80 |
| `ScorecardPanel.tsx` | Left panel: composite score, dimension bars, per-catalog, notes, export | ~220 |
| `RecommendationsPanel.tsx` | Right panel: fix-to-target banner, grouped offenders, workspace structure | ~250 |

### 10.5 Caching & Delta

- Score computed on-demand per request (graph is in memory, computation is cheap)
- After each ingestion, persist `scorecard_snapshot: {composite, dimensions, computed_at}` alongside the cached graph
- Delta = current composite - `scorecard_snapshot.composite`

### 10.6 Graceful Degradation

| Condition | Behavior |
|-----------|----------|
| No enrichment (no warehouse) | Scorecard hidden entirely. Badge not shown. |
| Partial enrichment (e.g., no cost data) | Affected dimensions show "N/A". Weight redistributed pro-rata. |
| No previous cached graph | Delta shows "Baseline" instead of +/- N |
| Single catalog | "By Catalog" section hidden |
| No UC tags on workspace | Tag Coverage shows 0%, still scored (it's a real signal) |

---

## 11. Edge Cases & Decisions

| Decision | Resolution |
|----------|------------|
| Spark-only tables appear cold | Include in counts. Flag in UI tooltip: "Freshness is based on SQL warehouse queries. Tables accessed only via Spark may appear cold." |
| System schemas (`information_schema`, `__databricks_internal`) | Exclude from all scoring and offenders |
| Views vs. tables | Include in Orphan Rate and Tag Coverage. Exclude from Freshness and Cost (no direct DBU). |
| Foreign catalog tables | Exclude from Cost and Freshness. Include in Tag Coverage and Orphan Rate. |
| Warehouse with state STOPPED but had DBU recently | Count as active (dbu_30d > 0). Only flag as idle if truly 0 DBU. |
| N/A reweighting | Redistribute weight proportionally across available dimensions |
| Ingestion limits may miss tables | Score is based on ingested subset. Note in UI: "Based on N ingested tables." |

---

## 12. Deferred (Future Phases)

| Feature | Phase | Notes |
|---------|-------|-------|
| Trend sparkline (score history) | v2 | Requires persisting scores across ingestion cycles |
| Canvas integration (click offender → focus node) | v2 | Event bridge between panel and canvas |
| Custom dimension weights | v2 | Let teams adjust weights |
| Alerts (score drops below X) | v3 | Notification infrastructure |
| Agent API actions | v2 | GET is agent-readable already; action layer is the work |

**Included in v1 (moved from deferred):**
- Fix-to-target estimate - "Fix top 5 to move from B(68) → B(74)" banner
- Markdown export - summary report for Slack/Confluence

---

## 13. Implementation Checklist

**Backend (~280 lines across files):**
- [ ] `server/graph/scorecard.py` -5 dimension scoring functions
- [ ] `server/graph/scorecard.py` - composite calculation with N/A reweighting
- [ ] `server/graph/scorecard.py` - offender detection (7 categories) + impact ranking
- [ ] `server/graph/scorecard.py` - workspace structure observations (6 types)
- [ ] `server/graph/scorecard.py` - per-catalog grouping
- [ ] `server/api/routes.py` -`GET /api/scorecard` endpoint with query params
- [ ] `app.py` - persist `scorecard_snapshot` in graph cache

**Frontend (~580 lines across files):**
- [ ] `ScorecardOverlay.tsx` - full-screen overlay with backdrop, Escape/click dismiss, state preservation
- [ ] `ScorecardPanel.tsx` - left panel (score, dimensions, per-catalog, notes textarea, export button)
- [ ] `RecommendationsPanel.tsx` - right panel (fix-to-target, grouped offenders, workspace structure)
- [ ] `graphStore.ts` - scorecard types, fetch action, overlay open/close state, notes persistence
- [ ] Wire "Scorecard" button into sidebar + `G` keyboard shortcut
- [ ] Notes auto-save on blur → `lattice_config.json` via `/api/config`
- [ ] Dark mode support via CSS variables (follows mockup pattern)
- [ ] Export: JSON download, CSV download, Markdown copy-to-clipboard (all include notes)

**Validation:**
- [ ] Test against 3–5 real workspaces to validate grade bracket distribution
- [ ] Verify graceful degradation (no enrichment, partial enrichment, single catalog)
- [ ] Verify N/A reweighting produces sensible results

---

## 14. Estimated Effort

| Component | Lines | Effort |
|-----------|-------|--------|
| `scorecard.py` (scoring, offenders, structure) | ~250 | Medium |
| `routes.py` changes | ~30 | Small |
| `app.py` cache changes | ~10 | Small |
| `ScorecardOverlay.tsx` (overlay + backdrop) | ~80 | Small |
| `ScorecardPanel.tsx` (left panel + notes) | ~220 | Medium |
| `RecommendationsPanel.tsx` (right panel) | ~250 | Medium |
| `graphStore.ts` changes | ~30 | Small |
| **Total** | **~870** | **3–4 focused sessions** |

Reference mockup: `docs/scorecard-mockup.html` - open locally in a browser
to see the exact visual style, colors, spacing, and dark mode behavior.
