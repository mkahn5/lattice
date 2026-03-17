# Lattice Demo Script

**Target length:** 4–5 minutes
**Format:** Loom screen recording with voiceover
**Starting state:** Lattice loaded in browser, Lanes view, All assets, no filters active

---

## Opening (15 seconds)

> "This is Lattice — an ontology and visual intelligence platform for Databricks workspaces. It builds a live ontology of your environment — every Unity Catalog object, compute resource, job, dashboard, and app mapped as typed entities with semantic relationships. Think of it as a knowledge graph for your data platform. Let me walk you through what it can do."

**On screen:** Full canvas in Lanes view showing 3,630 assets. Let it breathe for a moment.

---

## 1. The Graph — Full Workspace Topology (30 seconds)

> "Right now we're looking at a single Databricks workspace — 3,630 assets across 19 different node types, all discovered automatically from the Unity Catalog API and system tables."

**Action:** Slowly scroll down through the lanes to show the scale — schemas, databases, tables, views, connections, warehouses, jobs, apps.

> "The swimlane layout groups assets by type. Blue nodes are UC data assets — catalogs, schemas, tables. Green are databases. Orange are warehouses. Purple are jobs. Each row is a type."

**Action:** Point out 2-3 lane labels as you scroll.

---

## 2. Layout Modes (20 seconds)

> "You can switch between layout modes depending on what you're analyzing."

**Action:** Click **Tree →** to show the hierarchy layout.

> "Tree view shows the catalog hierarchy — how catalogs contain schemas, schemas contain tables. Useful for understanding the structural organization."

**Action:** Click back to **Lanes**.

> "And Lanes groups everything by asset type — great for seeing the full picture at a glance."

---

## 3. Selecting an Asset — Detail Panel (30 seconds)

> "Click any node to inspect it."

**Action:** Click on a schema with many connections (e.g., `_ba-de-test-wk7`).

> "The detail panel shows the asset's properties — owner, creation date — and all 39 of its connections. You can see exactly what this schema contains: tables, views, volumes, and the catalog it belongs to."

**Action:** Scroll the connections list briefly.

> "Every node also has a direct link to open it in the Databricks console."

---

## 4. Focus View — Exploring Connections (30 seconds)

> "When you want to isolate an asset and its dependencies, click Focus."

**Action:** Click the **Focus** button with the schema selected.

> "Focus pulls the selected asset and all its direct connections out of the main layout — callers above, targets below. Here we can see all 39 assets that this schema touches, arranged for easy analysis. The rest of the graph stays intact in the lanes."

**Action:** Pause to let the viewer see the focused group.

---

## 5. Type Filtering — Targeted Analysis (25 seconds)

> "You can filter the graph to just the asset types you care about."

**Action:** Click **App** in the sidebar, then click **Database** to show both.

> "Now we're looking at just Apps and Databases — 321 nodes out of 3,630. You can immediately see the 'uses' relationships — which apps depend on which databases. This is incredibly useful for understanding your application layer."

**Action:** Let the filtered view display for a moment. Then reset the filter (click both types again to deselect).

---

## 6. Activity Timeline — Finding Stale Assets (30 seconds)

> "The activity timeline lets you filter by freshness."

**Action:** Click the **7d** button in the Activity Timeline section.

> "Now we're highlighting only assets that have been active in the last 7 days. Active nodes are fully visible. Inactive ones are dimmed with dashed borders. You can immediately spot which schemas, tables, and jobs are stale."

**Action:** Scroll to show a mix of active and dimmed nodes.

> "This is powerful for cleanup — if a table hasn't been queried in 30 days and has no owner, it's a candidate for deprecation."

**Action:** Click **All** to reset the timeline filter.

---

## 7. Health Panel — Orphan Detection (25 seconds)

> "The Health panel in the sidebar surfaces governance issues."

**Action:** Click the **Health** dropdown showing "119 orphaned".

> "119 orphaned assets — tables with zero queries in 30 days. You can also see unowned assets — active tables with no owner assigned. Click any item to navigate directly to it on the canvas."

**Action:** Click one orphaned asset to jump to it.

> "You can export this entire list as CSV for audit workflows or stakeholder reviews."

---

## 8. Cost Overlay (25 seconds)

> "Toggle the cost overlay to see compute spend across the workspace."

**Action:** Enable the **Cost** toggle in the sidebar.

> "Every warehouse and compute resource now shows its 30-day DBU spend. Darker orange means higher cost. Click a warehouse to see the breakdown — which tables and jobs are driving that spend."

**Action:** Click on a warehouse to show cost attribution in the detail panel.

> "This gives platform teams a direct line of sight from cost to the assets that generate it."

**Action:** Disable the Cost toggle.

---

## 9. Workspace & Catalog Switching (20 seconds)

> "Lattice supports multiple workspaces and catalogs."

**Action:** Click the workspace switcher (globe icon) to show the dropdown.

> "You can switch between workspace profiles — dev, staging, production — without restarting. Each workspace ingests independently."

**Action:** Close the dropdown. Click the catalog selector to show the catalog list.

> "And you can scope the graph to specific catalogs. This workspace has over 200 catalogs — including foreign catalogs and Delta Sharing sources. Just search and select."

**Action:** Close the dropdown.

---

## 10. Save View & Export (20 seconds)

> "When you've got a view you want to share, click Save View."

**Action:** Click **Save View** to show the capture pane.

> "This freezes the current canvas into a comparison pane. From here you can export as a high-resolution PNG for presentations, JSON for programmatic analysis, or CSV for a tabular export of every asset in the view."

**Action:** Show the export options briefly.

---

## Closing (15 seconds)

> "Lattice deploys as a native Databricks App — zero external infrastructure. It uses the Databricks SDK, Unity Catalog APIs, and system tables. Everything you've seen runs inside your workspace."

> "If you're a data architect, platform engineer, or governance lead trying to understand what's in your Databricks environment — who owns what, what's active, what's costing money, and what's safe to change — Lattice gives you a live ontology of your entire platform in a single view."

> "Reach out if you'd like to try it. Thanks for watching."

---

## Tips for Recording

- **Browser:** Full screen, 1920×1080, no bookmarks bar
- **Zoom:** Make sure the Lattice sidebar and canvas text are readable
- **Mouse movement:** Slow, deliberate — let the viewer's eye follow
- **Pauses:** After each major action, pause 2-3 seconds so the viewer can absorb
- **Mistakes:** If you misclick, just keep going — Loom lets you trim
- **Close other tabs:** Only Lattice should be visible
- **Silence notifications:** Turn on Do Not Disturb before recording
