# CHANGELOG.md

All notable changes to the **live** AbouAmjad Store System / ToolCustody project.

Format: newest first. Detail also lives in git commits.

Related: [TASKS.md](./TASKS.md) · [DECISIONS.md](./DECISIONS.md) · [docs/CHANGELOG.md](./docs/CHANGELOG.md) (legacy)

---

## 2026-08-05 — Production recovery & system audit

### Fixed
- Product quantities: `available = received − damaged − locked` (was wrongly `warehouseQty − custody`)
- Project page error `column "qty" does not exist` — use `qty_sent` / `issued_by`
- Project on-site tools restored (**19** units on HAYSSAM EL SHAMI) from dispatch ledger
- Inventory count sheet creation against production `inventory_counts` schema + `{ count, lines }` response
- Service Worker / API headers: no stale cache for ledger/audit/scan data
- Audit log no longer accepts spoofed username from client params
- Read endpoints gated with server-side permissions where missing

### Added
- Modular enterprise API under `server/src/` (89 actions) on VPS
- `ensureProjectStock` on API boot (auto-heal on-site qty)
- Default role permission seed for **empty** `role_permissions` only
- Root AI memory docs: `AI_PROJECT_MEMORY.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `TASKS.md`, `DECISIONS.md`, this changelog

### Restored
- Full production frontend pages (people, warehouses, projects, forms, QC, settings, users, roles, i18n, terminal session flow, etc.)
- Pre-Timesheet operational UI on VPS

### Removed / held back
- Timesheet from production path (404) — must not return without approval
- Orphan stub pages that conflicted with production nav (`inventory.html`, `notifications.html`, `reports.html`, `results.html`, `search.html` as outdated workspace-only copies)

### Known remaining
- ~47 catalog items still show negative available due to missing historical receiving data (not formula bug)
- Non-admin role matrices on production remain intentionally sparse until Roles UI review

---

## 2026-07 — Custody platform hardening (historical)

- Strict ScanEngine session (Person → IN/OUT → Tools)
- Unified navigation / PWA / damage camera / consumables / auth gates
- Shared `app.css` design system
- Large `/docs` tree authored (partly against Apps Script era)

---

## Earlier

- Core Terminal + ledger
- Worker / tool profiles, offline queue, themes
