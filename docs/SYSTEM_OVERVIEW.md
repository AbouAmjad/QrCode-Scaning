# System Overview

## 1. Product summary

**ToolCustody** is a QR scanning system that tracks which worker holds which tools at Abu Amjad’s store/workshop.

Workers and storekeepers scan:

1. A **person** code (`P…`)
2. A **direction** code (`OUT` or `IN`)
3. One or more **tool / bag / consumable** codes (`I…`, `E…`, `B…`, `C…`)

The system appends each scan to a Google Sheet ledger. The browser rebuilds live custody by replaying that ledger through `CustodyParser`.

## 2. Business goals

- Know which tools are **checked out** and to whom  
- Record **returns** accurately  
- Surface **warnings** (no direction, recovery of lost tools, overdue)  
- Log **consumable issuance** without return custody  
- Capture **damage reports** with optional photos  
- Work in the field with **offline queue** + later sync  

## 3. Users

| Role (logical) | Primary screens | Notes |
|----------------|-----------------|-------|
| Scanner / storekeeper | Terminal (`index.html`) | Field scanning |
| Supervisor | Dashboard, Overview | KPIs, alerts |
| Analyst | Consumables, CSV exports | Issuance reports |
| Admin | Login + GAS deploy | Credentials & sheets |

> Current auth is a **single shared token** — roles are logical only (not enforced in software yet).

## 4. Runtime components

```
Browser (GitHub Pages PWA)
  ├── login.html
  ├── index.html          Scan terminal + offline queue
  ├── dashboard.html      KPIs / alerts / lookup
  ├── results.html        Inventory overview
  ├── worker.html         Worker profile
  ├── tool.html           Tool / consumable profile
  ├── consumables.html    Multi-date consumable export
  └── damage.html         Damage submit + list
           │
           ▼
Google Apps Script Web App
           │
           ▼
Google Sheets (ledger + catalogs + damage)
(+ Drive folder for damage photos)
```

## 5. Shared frontend modules

| File | Responsibility |
|------|----------------|
| `config.js` | AppConfig, theme, settings, token helpers, API client |
| `scan.js` | Strict scan session engine |
| `parser.js` | Custody projections for UI |
| `ui.js` | Top bar, page chrome, auth gate, PWA register |
| `app.css` | Design system |
| `manifest.json` / `sw.js` | PWA |

## 6. Backend actions (summary)

| Action | Purpose |
|--------|---------|
| `login` | Validate user/pass → session token |
| `scanData` | Append QR code to main ledger |
| `getDesc` | Resolve code → description |
| `getDates` | Distinct ledger dates |
| `getData` | Full history for a selected date context |
| `getDamageDates` / `getDamage` / `submitDamage` | Damage module |

See [API_REFERENCE.md](./API_REFERENCE.md).

## 7. Code classification

| Prefix | Type | Custody behavior |
|--------|------|------------------|
| `P…` | Person | Sets active worker; clears direction |
| `OUT` | Direction | Checkout / issue mode |
| `IN` | Direction | Return mode |
| `I…` `E…` `B…` | Durable tools/bags | Holders list updated |
| `C…` | Consumables | OUT logged as issuance; no holders |

## 8. Key invariants

1. Valid operational sequence is **Person → Direction → Tool(s)**.  
2. Custody is derived from history; do not invent a parallel inventory DB without an ADR.  
3. `scan.js` owns session validation; `parser.js` owns historical interpretation.  
4. Offline queue may delay writes; synced state must eventually match ledger.  
5. Secrets must not be committed (`Code.gs.txt` is gitignored).

## 9. Environments

| Environment | Location |
|-------------|----------|
| Production UI | GitHub Pages (`main`) |
| Production API | Deployed Apps Script `/exec` URL in `config.js` |
| Local secrets copy | `Code.gs.txt` (developer machine only) |
| Safe template | `Code.gs.example` |

## 10. Related docs

- Architecture → [SOFTWARE_ARCHITECTURE_DOCUMENT.md](./SOFTWARE_ARCHITECTURE_DOCUMENT.md)  
- Workflows → [WORKFLOWS/](./WORKFLOWS/)  
- Known issues → [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)  
