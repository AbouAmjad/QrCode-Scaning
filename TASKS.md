# TASKS.md

> Project task board. Update when work starts, finishes, or is blocked.  
> Last updated: 2026-08-05

---

## Done (recent production recovery)

- [x] Restore enterprise API after Timesheet overwrite damaged production
- [x] Restore production frontend (sidebar, 5 roles, full pages) to VPS + git
- [x] Remove Timesheet from production path
- [x] Fix product `available` formula → `received − damaged − locked`
- [x] SW / API no-cache so audit & scan logs stay fresh
- [x] Full system audit: sync missing HTML from VPS, harden read permissions
- [x] Inventory count API shape + production `inventory_counts` schema
- [x] Fix project page `column "qty" does not exist` (`qty_sent` / `issued_by`)
- [x] Restore project on-site tools (19 units) from dispatch ledger
- [x] Auto-heal `project_stock` on API boot (`ensureProjectStock`)
- [x] Establish AI permanent memory docs (this file set)

---

## Open / backlog

### Data integrity (priority)

- [ ] Review **47 products** with negative `available` — add missing `receiving` rows or adjust stock via product form where historically issued without receive
- [ ] Audit `warehouse_stock` negatives vs receiving/dispatch/damage; optional clamp/rebuild (without changing `available` formula)
- [ ] Confirm scans after last known id continue to append (terminal session / `syncScan` path)

### API / security

- [ ] Enforce `user_warehouse_scope` / `user_project_scope` in list/transfer/dispatch handlers
- [ ] Prefer Authorization header over token-in-query for API calls (breaking change — needs plan)
- [ ] Rate-limit login / register
- [ ] Inventory count: submit counted qty + close sheet (create-only today)

### Product / UX

- [ ] Do **not** re-add Timesheet until explicit approval + IMPLEMENTATION_PLAN.md
- [ ] Non-admin role matrices on production are sparse — review with operator in Roles UI
- [ ] Custody replay performance for large `scans` table (materialized holdings — needs plan)

### Docs hygiene

- [ ] Mark GAS-era docs under `docs/` as historical where they conflict with Node/Postgres live stack
- [ ] Keep root memory files (this set) authoritative for agents

---

## Blocked / do not touch without approval

* Full frontend redesign
* Renaming public HTML files or API action names
* Database wipe / truncate of `scans`, `receiving`, `catalog`, `project_dispatches`
* Deploying minimal stub server over `/opt/toolcustody-api`
* Timesheet re-integration

---

## Active PR branches (context)

| Branch | Topic |
|--------|--------|
| `cursor/full-system-audit-4f63` | Audit, frontend sync, API hardening, project stock fixes |
| `cursor/restore-production-api-4f63` | Enterprise API restore |
| `cursor/qr-labels-wysiwyg-refactor-4f63` | Labels work (separate) |
| `cursor/timesheet-phase1-4f63` | Timesheet — **do not merge to production** without approval |
