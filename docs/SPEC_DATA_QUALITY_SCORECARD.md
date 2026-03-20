# Lattice Workspace Governance Score — Feature Spec

**Author:** Mike Kahn
**Status:** Draft — awaiting review
**Date:** 2026-03-20
**Version target:** v0.6.0

---

## Problem Statement

Lattice visualizes workspace topology but doesn't summarize workspace health
into an actionable, at-a-glance assessment. SAs and platform teams want a quick
answer to: "How well-governed is this workspace?" — without manually
interpreting the canvas.

## Honest Assessment: Will This Be Accurate?

**What the scorecard can measure well (high confidence):**
- Table freshness — `system.query.history` gives us real access timestamps
- Job reliability — `system.lakeflow.job_run_timeline` gives actual success/fail rates
- Cost waste — cold tables with attributed DBU are objectively wasteful
- Lineage coverage — either a table has lineage edges or it doesn't

**What the scorecard measures poorly (low confidence):**
- **Ownership** — the UC `owner` field is usually the creator or a service principal,
  not a business owner. `created_by` is slightly better but still not "who is
  accountable for this table." The scorecard should present this as "identifiable
  contact" not "governed ownership." We flag service principals and empty owners,
  but a workspace where every table is "owned by terraform-sp" will score high
  on ownership despite having no real human accountability.
- **Documentation** — `comment` being non-empty doesn't mean it's useful.
  `"TODO"` and `"test table"` would count as documented. We can't assess quality,
  only presence.

**What the scorecard cannot measure (not available):**
- Data quality (completeness, accuracy, validity of the data itself)
- Access control hygiene (who has grants on what)
- Schema evolution / breaking changes
- SLA compliance or data delivery timeliness
- True business ownership (would require annotations, not yet populated)

**Bottom line:** The scorecard is a **workspace hygiene score**, not a true data
quality score. It measures operational governance — are assets maintained, used,
documented, and traceable? It cannot measure whether the data itself is correct.
The name should reflect this: **"Workspace Governance Score"** rather than
"Data Quality Scorecard." The governance framing signals strategic value
to platform teams and leadership while remaining honest about what's measured.
Subtitle/tooltip: *"Measures operational governance — asset freshness, pipeline
reliability, lineage coverage, cost efficiency, and documentation."*

---

## Proposed Dimensions

All inputs already exist in Lattice's graph. No new system table queries required.

### 1. Freshness (30% weight)

**Metric:** % of tables/views that are hot or warm (queried within 30 days)
**Source:** `heat` field on Table/View nodes (from `system.query.history`)

| Score | Condition |
|-------|-----------|
| 100 | ≥90% of tables are hot/warm |
| 75 | ≥70% hot/warm |
| 50 | ≥50% hot/warm |
| 25 | ≥30% hot/warm |
| 0 | <30% hot/warm |

**Why 30%:** Most reliable signal. Based on actual query execution timestamps.
Cold tables are either abandoned or accessed outside the SQL warehouse path
(Spark direct reads won't appear in `system.query.history`).

**Known blind spot:** Tables read only via Spark clusters (not SQL warehouses)
may appear cold even if actively used. This is a `system.query.history`
limitation. The scorecard should note this.

### 2. Job Reliability (15% weight)

**Metric:** Weighted average `success_rate_pct` across all jobs with runs in the last 30 days
**Source:** `success_rate_pct`, `total_runs_30d` on Job nodes (from `system.lakeflow.job_run_timeline`)

| Score | Condition |
|-------|-----------|
| 100 | Average success rate ≥95% |
| 75 | ≥85% |
| 50 | ≥70% |
| 25 | ≥50% |
| 0 | <50% |

Weighted by run count — a job that runs 1000 times at 90% matters more than
one that ran twice at 50%.

**Why 15% (reduced from 25%):** The raw success rate is noisy — it conflates
expected failures (retry patterns, conditional/sensor jobs), canceled runs,
dev/test failures, and actual reliability issues. The ingestion cap (200 jobs)
also means we may score a subset. Reduced weight reflects this lower confidence.
Failing jobs still surface prominently in the worst offenders list.

### 3. Lineage Coverage (25% weight)

**Metric:** % of tables that have at least one incoming OR outgoing lineage edge
**Source:** Graph edge count per Table/View node (from `system.access.table_lineage`)

| Score | Condition |
|-------|-----------|
| 100 | ≥80% of tables have lineage |
| 75 | ≥60% |
| 50 | ≥40% |
| 25 | ≥20% |
| 0 | <20% |

**Why 25% (increased from 20%):** Lineage is the foundation of impact analysis
and governance. Tables without lineage are invisible to dependency tracking.
Binary signal (edges exist or they don't) — high confidence.

**Known blind spot:** Lineage only captures the last 30 days of
`system.access.table_lineage`. Infrequently-run pipelines (monthly jobs) may
not have edges at the time of scoring.

### 4. Cost Efficiency (15% weight)

**Metric:** % of total workspace DBU NOT attributed to cold/orphaned tables
**Source:** Cost attribution data (from `system.billing.usage` + graph BFS)

| Score | Condition |
|-------|-----------|
| 100 | <5% of DBU goes to cold assets |
| 75 | <15% |
| 50 | <25% |
| 25 | <40% |
| 0 | ≥40% |

**Why 15%:** Real money signal, but cost attribution is approximate (BFS-based,
not precise per-query accounting). Treated as directional, not exact.

### 5. Documentation (10% weight)

**Metric:** % of tables/views with a non-empty `comment` field
**Source:** `comment` field on Table/View nodes (from UC API)

| Score | Condition |
|-------|-----------|
| 100 | ≥80% have comments |
| 75 | ≥60% |
| 50 | ≥40% |
| 25 | ≥20% |
| 0 | <20% |

**Why only 10%:** Presence ≠ quality. A non-empty comment is better than nothing,
but this is the weakest signal. Low weight reflects low confidence.

### 6. Identifiable Contact (5% weight)

**Metric:** % of active (hot/warm) tables where `created_by` is a human user
(not a service principal or empty)
**Source:** `created_by` field on Table/View nodes (from UC API)

Service principal detection: `created_by` contains a UUID pattern or ends with
a known SP suffix (configurable). Empty/null also counts as "no contact."

| Score | Condition |
|-------|-----------|
| 100 | ≥90% of active tables have a human contact |
| 75 | ≥70% |
| 50 | ≥50% |
| 25 | ≥30% |
| 0 | <30% |

**Why only 5%:** This is the least reliable dimension. `created_by` is not
"business owner" — it's "who ran the DDL." Weighted low to avoid penalizing
workspaces that use IaC (where everything is created by a SP). Included because
"someone to call when this breaks" has value even if imperfect.

---

## Composite Score

```
score = (freshness × 0.30) + (job_reliability × 0.15) + (lineage × 0.25)
       + (cost_efficiency × 0.15) + (documentation × 0.10) + (contact × 0.05)
```

Total: 100 points max.

| Grade | Score | Color |
|-------|-------|-------|
| A | 80–100 | Green |
| B | 60–79 | Yellow-green |
| C | 40–59 | Yellow |
| D | 20–39 | Orange |
| F | 0–19 | Red |

---

## Dependency: Enrichment Required

The scorecard is **only meaningful when system table enrichment is available**.
Without it, Freshness (30%), Job Reliability (15%), Cost Efficiency (15%),
and Lineage Coverage (25%) — 85% of the score — have no data.

If enrichment is unavailable:
- Do NOT show a score
- Show a message: "Workspace Governance Score requires system table access.
  Configure a SQL warehouse and grant access to system tables in Settings."
- Link to the Settings panel preflight checks

Documentation (10%) and Contact (5%) can be computed without enrichment but
are not worth showing alone.

---

## API Design

### `GET /api/scorecard`

Returns the full scorecard. Computed from the in-memory graph (no new SQL queries).

```json
{
  "available": true,
  "score": 72,
  "grade": "B",
  "dimensions": {
    "freshness": {
      "score": 85,
      "weight": 0.25,
      "weighted_score": 21.25,
      "detail": "312 of 367 tables queried in last 30 days (85%)",
      "metric_pct": 85.0
    },
    "job_reliability": {
      "score": 75,
      "weight": 0.25,
      "weighted_score": 18.75,
      "detail": "Weighted avg success rate: 88.2% across 45 jobs",
      "metric_pct": 88.2
    },
    "lineage_coverage": {
      "score": 50,
      "weight": 0.20,
      "weighted_score": 10.0,
      "detail": "183 of 367 tables have lineage edges (49.9%)",
      "metric_pct": 49.9
    },
    "cost_efficiency": {
      "score": 75,
      "weight": 0.15,
      "weighted_score": 11.25,
      "detail": "12.3% of 4,521 DBU attributed to cold assets",
      "metric_pct": 12.3
    },
    "documentation": {
      "score": 25,
      "weight": 0.10,
      "weighted_score": 2.5,
      "detail": "87 of 367 tables have comments (23.7%)",
      "metric_pct": 23.7
    },
    "contact": {
      "score": 100,
      "weight": 0.05,
      "weighted_score": 5.0,
      "detail": "298 of 312 active tables have human creator (95.5%)",
      "metric_pct": 95.5
    }
  },
  "worst_offenders": {
    "cold_high_cost": [
      {"id": "table:cat.schema.tbl", "name": "tbl", "fqn": "cat.schema.tbl", "dbu": 124.5}
    ],
    "failing_jobs": [
      {"id": "job:123", "name": "nightly_etl", "success_rate_pct": 42.0, "total_runs_30d": 30}
    ],
    "no_lineage": [
      {"id": "table:cat.schema.tbl2", "name": "tbl2", "fqn": "cat.schema.tbl2"}
    ]
  },
  "table_count": 367,
  "job_count": 45,
  "enrichment_available": true
}
```

When enrichment is unavailable:
```json
{
  "available": false,
  "reason": "System table enrichment required. Configure in Settings.",
  "enrichment_available": false
}
```

---

## UI Design

### Sidebar: Scorecard Section

New collapsible section in the sidebar, between the existing Health section
and the Cost section:

```
▾ Governance Score          72 / 100  [B]
  ████████████████░░░░  (color bar)

  Freshness         85%  ████████░░
  Job Reliability   88%  ████████░░
  Lineage Coverage  50%  █████░░░░░
  Cost Efficiency   88%  ████████░░
  Documentation     24%  ██░░░░░░░░
  Contact           96%  █████████░

  ▸ 3 cold tables consuming 124 DBU
  ▸ 2 jobs below 50% success rate
  ▸ 184 tables with no lineage

  [Export PNG]  [Export CSV]
```

Clicking an offender row highlights those nodes on the canvas (reuse existing
highlight/focus behavior).

### No separate page or modal — this lives in the sidebar alongside the
existing Health and Cost sections. Keeps the tool simple.

---

## Export

- **PNG:** Screenshot of the scorecard section (for slides/QBRs)
- **CSV:** All scored assets with per-dimension values, for deeper analysis
- **JSON:** Already available via `/api/scorecard` endpoint

---

## Implementation Scope

| Component | Work | Effort |
|-----------|------|--------|
| `server/api/routes.py` | New `/api/scorecard` endpoint | Small — reads existing graph, no new SQL |
| `server/graph/scorecard.py` | Scoring logic (new file) | Medium — ~150 lines, pure computation |
| `frontend/src/components/Sidebar/Scorecard.tsx` | New sidebar section | Medium — new component, bar charts |
| `frontend/src/components/Sidebar/index.tsx` | Add scorecard section | Small — mount new component |
| UC connector | Add `created_by` to Table/View nodes | Small — field already in SDK response |
| Tests | Unit tests for scoring thresholds | Small |

**Not in scope:**
- Trend over time (requires persistent storage — future phase)
- Custom weights (hardcoded for v1, configurable later if needed)
- Annotations as ownership source (not yet populated)
- Data quality measurement (not possible with current signals)

---

## Open Questions

1. ~~**Naming:**~~ Decided: **Workspace Governance Score**
2. **Thresholds:** Are the score brackets right, or should they be more/less forgiving?
3. ~~**Weight distribution:**~~ Decided: Freshness 30%, Lineage 25%, Job Reliability 15%,
   Cost Efficiency 15%, Documentation 10%, Contact 5%.
4. **Cold table caveat:** Should we add a toggle to exclude tables that are known
   to be Spark-only (no SQL warehouse access)? Or just note the blind spot?
5. **Service principal detection:** What patterns should flag a `created_by` as
   non-human? UUID-based names? `@ServicePrincipal` suffix? Configurable list?
