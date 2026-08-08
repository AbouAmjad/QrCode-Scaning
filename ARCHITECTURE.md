# ARCHITECTURE.md

> Current architecture of the live AbouAmjad Store System.  
> Last updated: 2026-08-05

---

## High-level

```
Browser (static HTML/JS)
    │  GET/POST /api?action=…&token=…
    ▼
nginx → Node Express API (/opt/toolcustody-api)
    │
    ▼
PostgreSQL (toolcustody)
```

Frontend is multi-page static files. There is **no SPA bundler**. Shared chrome: `ui.js` + `config.js` + `i18n.js` + `app.css`.

---

## Frontend

| Layer | Files | Responsibility |
|-------|--------|----------------|
| Config / auth / API helpers | `config.js` | Token, roles, `PAGE_PERMISSIONS`, `apiGet` / `apiPostForm` |
| Navigation chrome | `ui.js` | Sidebar, page gate, permission refresh |
| Scan FSM | `scan.js` | Person → Direction → Tools |
| Client custody math | `parser.js` | Legacy tape replay for some views |
| i18n | `i18n.js` | `TCI18N` |
| PWA | `sw.js` | Kill-switch / **no API cache** |
| Labels | `qr-labels.html`, `export-utils.js`, libs | Printable QR labels |

Page access is gated by `AppConfig.PAGE_PERMISSIONS` + `canAccessPage(pageId)`. Denied users land on `profile.html`.

---

## Backend (`server/src/`)

| Module | Role |
|--------|------|
| `server.js` | Express app, CORS, action dispatcher (~89 actions), boot |
| `schema.js` | Idempotent DDL (`CREATE IF NOT EXISTS` + additive `ALTER`) |
| `db.js` | pg Pool |
| `custody.js` | Replay `scans` → holdings / issued / PPE history (TTL cache) |
| `permissions.js` | Permission catalog + role matrices |
| `handlers/auth.js` | Login, users, roles |
| `handlers/people.js` | People + suppliers |
| `handlers/catalog.js` | Products, categories, stock views |
| `handlers/inventory.js` | Outstanding, receiving, damage, dashboard |
| `handlers/warehouses.js` | Warehouses, transfers, inventory count |
| `handlers/projects.js` | Projects, dispatch/return, project_stock heal |
| `handlers/terminal.js` | Terminal session lease + scan intake |
| `handlers/qc.js` | Calibration |
| `handlers/requests.js` | Store requests |
| `handlers/logs.js` | Scan tape, search, audit |
| `lib/stock.js` | Stock snapshot + warehouse/project qty helpers |
| `lib/util.js` | Codes, dates, uploads |
| `lib/ctx.js` | Request context / `ApiError` |

### Request flow

1. Merge query + body params.
2. Public: `login`, `registerUser`, `options`.
3. Else resolve user by `token` → attach permissions.
4. Bare `scanData` (no action) → terminal append scan.
5. Else `ACTIONS[action](ctx)` → JSON (often HTTP 200 with `{ error }` body).

---

## Custody model

Append-only **`scans`** table, replayed in time order:

* `P*` → select person
* `IN` / `OUT` → direction
* `I` / `E` / `B*` → tool custody lots
* `C*` → consumable issue/return

Server helpers: `holdingsForPerson`, `outQtyByCode`, `issuedQtyByCode`, `holdersOfTool`.

---

## Stock math (canonical)

### Product catalog (`getCatalogStock` / `stock.snapshot`)

```
available = received − damaged − locked
locked    = out (tools) | issued (consumables)
```

`warehouseQty` and `projectOut` are reported separately; **do not** redefine `available` as `warehouseQty − out` (that caused mass negative quantities when `warehouse_stock` drifted).

### Project on-site (`project_stock`)

Updated on dispatch/return. If empty while dispatches exist, rebuild:

```
qty = Σ qty_sent(type=out) − Σ qty_sent(type=return)   per (project_id, code)
```

`ensureProjectStock()` runs on API boot.

---

## Important production schema notes

These names are **live Postgres** (not inventable):

| Table | Notes |
|-------|--------|
| `project_dispatch_lines` | `qty_sent`, `qty_returned` — **not** `qty` / `condition` |
| `project_dispatches` | `issued_by` — **not** `by_user` |
| `inventory_counts` + `inventory_count_lines` | `count_id`, `system_qty` — not `inventory_count_sheets` / `sheet_id` / `expected_qty` |

Always verify with `\d table_name` on VPS before changing SQL.

---

## Testing

```bash
cd server
DATABASE_URL=postgresql://… UPLOAD_DIR=/tmp/tc-uploads node test/smoke.js
```

Expect all registered actions exercised and checks passed.

---

## Deploy paths

| Surface | Path on VPS | How to update |
|---------|-------------|----------------|
| Frontend | `/var/www/toolcustody` | Copy HTML/JS/CSS (never wipe `uploads/`) |
| API | `/opt/toolcustody-api` | Copy `src/`, `systemctl restart toolcustody-api` |

Rollback: keep previous tarball / git commit; restore files + restart service. **Never** restore by wiping DB.
