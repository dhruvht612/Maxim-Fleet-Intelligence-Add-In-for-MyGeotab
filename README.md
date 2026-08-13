# Maxim Fleet Intelligence Hub — MyGeotab Add-In

An executive intelligence dashboard for **Maxim Truck & Trailer**, built on the MyGeotab
Add-In framework. It transforms Geotab telematics into leasing intelligence: utilization,
maintenance, lifecycle, and financial insight across a national leased portfolio — plus an
integration discovery workflow and per-industry add-in concepts for Maxim's customers.

This version is a **fully interactive showcase** running on a realistic generated sample
portfolio (500 units, 8 asset classes, 9 branch regions, 16 leasing customers). The
architecture is production-pattern: every data access flows through a single Geotab
service layer, so pointing it at a live MyGeotab database is a drop-in change.

## Run it

No build step, no dependencies.

- **Standalone:** open `index.html` in a browser (or serve the folder:
  `npx serve .`). The app detects there is no MyGeotab host and boots in mock mode.
- **Inside MyGeotab:** host this folder (HTTPS), then register the add-in under
  *Administration → System → System Settings → Add-Ins* using `config.json`
  (point the item `url` at the hosted `index.html`). The framework injects the
  authenticated `api` object and the same code runs against live data.

## What's inside

| Section | What it shows |
|---|---|
| Executive command deck | Data-generated narrative + portfolio pulse (assets, billing, utilization, flags) |
| Fleet KPIs | 9 KPI cards with trends, sparklines and click-through drill-downs |
| Utilization intelligence | Segmentation bands, class×week heatmap, top/under-utilized, idle-spend savings math |
| Maintenance intelligence | Fault alert feed, PM pipeline, 12-month spend trend, downtime by class, repeat failures |
| Lifecycle intelligence | Composite lifecycle score (age · duty · maintenance · downtime · condition), replacement runway forecast by quarter |
| Financial intelligence | TCO composition, cost/km & cost/hour, lease utilization efficiency, replacement ROI |
| Geotab data showcase | 12 telematics data categories → business use → triggered action |
| AI recommendations | Prioritized, data-driven recommendation cards (priority / impact / value / next step) |
| Action Center | Quick actions + session action queue (integration hand-off points) |
| Integration Discovery | Structured intake of Maxim's fleet / financial / operational systems, exportable profile |
| Industry templates | Add-in concepts for Construction, Utilities, Oil & Gas, Municipal, Delivery, Transportation, Field Service |

## Architecture

```
index.html            Shell + section scaffolding
config.json           MyGeotab add-in manifest
css/styles.css        Design system (light + dark themes)
js/
  data-generator.js   Seeded 500-unit sample portfolio
  geotab-service.js   ONLY Geotab access point (Authenticate/Get/Call + domain methods)
  insights.js         Insight engine — pure functions: raw data → intelligence model
  recommendations.js  Recommendation engine + action registry
  ui.js               Component & chart kit (dependency-free inline SVG)
  dashboard.js        Section renderers, vehicle modal, drill-down drawers
  integrations.js     Data showcase, discovery center, industry templates
  app.js              Bootstrap, filters/search/theme, MyGeotab lifecycle
assets/icon.svg
```

**Going live:** replace `loadPortfolio()`'s generator call with the real `Get`
(Device/Trip/FaultData/StatusData) queries already documented on each service method.
The insight engine, recommendation engine and UI are data-source agnostic.

## UX features

Search (unit / customer / class), portfolio filters (branch, class, status), sortable
tables, CSV exports (fleet report, per-section, integration profile), vehicle detail
modal, KPI drill-down drawers, refresh (simulated re-query), dark mode, responsive
down to mobile, keyboard-accessible controls.

---
*All vehicles, customers and figures are generated sample data. No real customer data.*
