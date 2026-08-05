# PROJECT_CONTEXT.md

> Living snapshot of the **production** ToolCustody / AbouAmjad Store System.  
> Update this file whenever the live stack or data model changes.

**Last updated:** 2026-08-05

---

## What this product is

Warehouse custody system for tools and consumables:

* QR terminal checkout / return (Person → IN/OUT → Tool)
* Catalog, people, receiving, damage, requests
* Multi-warehouse transfers + inventory count sheets
* Project dispatch / return (tools on job sites)
* QC / calibration, roles & permissions, audit + scan logs
* QR label printing

Brand / UI title: **ABOUAMJAD STORE SYSTEM** (AICS).

---

## Production deployment

| Item | Value |
|------|--------|
| Site | https://aics.iskndr.com |
| API health | `GET /health` → `{ ok, service: "toolcustody-api", actions: 89 }` |
| Frontend path | `/var/www/toolcustody` |
| API path | `/opt/toolcustody-api` |
| Service | `systemctl status toolcustody-api` |
| Database | PostgreSQL `toolcustody` on VPS |
| VPS IP | `169.58.37.233` |
| GitHub | https://github.com/AbouAmjad/QrCode-Scaning |

**Do not** treat older Google Apps Script docs as live backend. Live backend is **Node.js + PostgreSQL**.

---

## Live data snapshot (2026-08-05)

* Catalog products: **188**
* Products with negative `available`: **47** (missing historical receiving rows — calculation formula is correct)
* Projects: **2** active; **19** tools on site (HAYSSAM EL SHAMI)
* API actions registered: **89**
* Timesheet: **removed** from production (must stay off until approved)

---

## Repository layout (workspace)

| Path | Role |
|------|------|
| `*.html`, `config.js`, `ui.js`, `parser.js`, `scan.js`, `i18n.js`, `sw.js`, `app.css` | Static frontend (synced with production) |
| `server/src/` | Modular Node API (source of truth for API changes) |
| `server/test/smoke.js` | End-to-end action coverage |
| `docs/` | Historical / expanded documentation (some GAS-era; prefer this file for live truth) |
| `AI_PROJECT_MEMORY.md` | Session rules for AI agents |

---

## Auth & roles

Roles: `admin`, `employee` (store keeper), `logistics`, `engineer`, `qc`.

Permissions live in `permissions` + `role_permissions` tables. Admin always has full access in code. Non-admin matrices are edited in **Roles** UI and must not be wiped on deploy (`seedPermissions` only fills defaults when the table is empty, unless `resetRoles: true`).

---

## Known fragile areas

1. **Schema drift** — production tables sometimes differ from early `schema.js` drafts. Always `\d table` on VPS before writing SQL.
2. **project_stock** can empty while `project_dispatches` remain — API boot runs `ensureProjectStock` to rebuild from ledger.
3. **warehouse_stock** can go negative / out of sync; product `available` must **not** use it as primary formula.
4. Client `parser.js` vs server `custody.js` — both exist; prefer server actions (`getOutstanding`, `getInventoryDashboard`, `getPersonCustody`, `getCatalogStock`) for operational pages.

---

## Operator notes

* After frontend/API deploy: hard refresh (`Ctrl+Shift+R`).
* SW is live/no-cache by design (offline PWA cache intentionally disabled for ledger freshness).
* Never truncate `scans`, `receiving`, `project_dispatches`, or `catalog` to “fix” UI bugs.
