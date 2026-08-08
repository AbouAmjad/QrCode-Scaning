# DECISIONS.md

> Architectural Decision Log. Append-only. Newest first.  
> Never delete entries — mark superseded if replaced.

---

## DEC-2026-08-05-07 — Permanent AI project memory at repo root

**Status:** Accepted  
**Context:** Chat history is unreliable for cloud agents; production incidents showed agents repeating destructive mistakes.  
**Decision:** Root files `AI_PROJECT_MEMORY.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `TASKS.md`, `CHANGELOG.md`, `DECISIONS.md` are mandatory reading before any change.  
**Consequences:** Agents must update these files with every important change. Older `docs/` may lag; root memory wins on conflicts for *live* truth.

---

## DEC-2026-08-05-06 — Auto-heal project_stock from dispatch ledger

**Status:** Accepted  
**Context:** `project_stock` was empty while 6 historical dispatches still listed tools on site (user-visible data loss in UI).  
**Decision:** Rebuild `project_stock` as net `qty_sent` of `out` minus `return`. Run `ensureProjectStock` on API boot when sums diverge.  
**Consequences:** Dispatch history is source of truth for on-site qty. Manual `project_stock` edits would be overwritten on heal if totals diverge.

---

## DEC-2026-08-05-05 — Production project dispatch column names

**Status:** Accepted  
**Context:** `getProject` failed with `column "qty" does not exist`.  
**Decision:** Use live columns: `project_dispatch_lines.qty_sent` / `qty_returned`; `project_dispatches.issued_by`. Map to API fields `qty` / `qtySent` / `byUser` for the frontend.  
**Consequences:** `schema.js` and handlers must match production; never invent `qty`+`condition` on lines for this DB.

---

## DEC-2026-08-05-04 — Inventory count uses inventory_counts table

**Status:** Accepted  
**Context:** Handler wrote `inventory_count_sheets` / `sheet_id` / `expected_qty`; production has `inventory_counts` / `count_id` / `system_qty`. Frontend expects `{ count, lines }`.  
**Decision:** Align handler + schema bootstrap with production; return both `sheet` and `count`/`lines` for compatibility.  
**Consequences:** Local smoke tests must drop/recreate count tables when schema shape changes.

---

## DEC-2026-08-05-03 — Product available = received − damaged − locked

**Status:** Accepted  
**Context:** Rebuilt API used `warehouseQty − out − issued`, producing dozens of negative availabilities because `warehouse_stock` was corrupt/out of sync. Client `parser.js` used receiving-based formula.  
**Decision:** Canonical available qty is `received − damaged − (out|issued)`. Keep `warehouseQty` / `projectOut` as separate fields.  
**Consequences:** Editing stock via product form adjusts `receiving` (and warehouse delta) through `applyStockLevel`.

---

## DEC-2026-08-05-02 — Do not reintroduce Timesheet until approved

**Status:** Accepted  
**Context:** Timesheet deploy overwrote production API/UI with a minimal GitHub tree and broke the live store.  
**Decision:** Timesheet stays off production. Any return requires IMPLEMENTATION_PLAN.md + explicit approval + isolated deploy that cannot overwrite core API/UI.  
**Consequences:** Branch `cursor/timesheet-phase1-4f63` must not be merged/deployed casually.

---

## DEC-2026-08-05-01 — Live stack is Node + PostgreSQL (not Apps Script)

**Status:** Accepted  
**Context:** Historical docs describe Google Apps Script + Sheets. Production runs nginx + Node + Postgres on VPS.  
**Decision:** Agents treat Node/`server/src` + Postgres as the live backend. GAS docs under `docs/` are historical unless explicitly revived.  
**Consequences:** API contract is action-dispatcher JSON over `/api`, not Sheets cells.

---

## DEC-2026-08-05-00 — Permission seed does not wipe Roles UI

**Status:** Accepted  
**Context:** Empty default matrices locked non-admins on fresh installs; wiping on every boot would destroy operator edits.  
**Decision:** Seed default role permissions **only** when `role_permissions` is empty. Explicit `resetRoles: true` required to reset.  
**Consequences:** Production sparse matrices stay as operators set them until they edit Roles UI.
