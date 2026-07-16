# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
Specify functional and non-functional requirements for ToolCustody as implemented and as planned.

### 1.2 Scope
QR custody scanning, custody reporting, consumables issuance logging, damage reporting, offline queue, and PWA installability.

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Ledger | Ordered scan history in the main Google Sheet |
| Projection | Custody state computed by replaying the ledger |
| Session | Live Person→Direction→Tools context on Terminal |
| Consumable | Code prefix `C` — issued, not held in custody |

## 2. Overall description

### 2.1 Product perspective
Standalone web application integrated with Google Workspace (Sheets/Drive/Apps Script).

### 2.2 User classes
Scanner, Supervisor, Admin (logical; shared credentials today).

### 2.3 Operating environment
Modern mobile/desktop browsers; HTTPS GitHub Pages; network optional for queued scans.

## 3. Functional requirements

### FR-01 Login
**Status: AS-BUILT**  
Users authenticate with username/password against Apps Script `login`. On success, a token is stored in `localStorage`.

### FR-02 Auth gate
**Status: AS-BUILT**  
Protected pages redirect to login when no token is present (`requireAuth` / `TCUI.bootPage`).

### FR-03 Strict scan session
**Status: AS-BUILT**  
Terminal enforces Person → IN/OUT → Tools via `ScanEngine`.

### FR-04 Direction conflict resolution
**Status: AS-BUILT**  
If IN then OUT (or reverse) before tools, UI prompts for final direction.

### FR-05 Duplicate direction rejection
**Status: AS-BUILT**  
Repeated same direction without new person is rejected.

### FR-06 Offline queue
**Status: AS-BUILT (PARTIAL integrity)**  
Scans store locally and sync when online. Confirmation is currently optimistic (`no-cors`).

### FR-07 Undo last unsynced scan
**Status: AS-BUILT**  
Settings allows undo of last unsent queue item.

### FR-08 Description lookup
**Status: AS-BUILT**  
`getDesc` resolves human-readable names from catalog sheets.

### FR-09 Overview inventory
**Status: AS-BUILT**  
`results.html` shows tools out/in and on-site workers for a date.

### FR-10 Dashboard
**Status: AS-BUILT**  
KPIs, alerts, overdue heuristics, top holders, quick lookup, CSV export, auto-refresh.

### FR-11 Worker profile
**Status: AS-BUILT (known risk with consumables in log replay)**  
`worker.html` shows held tools and daily log.

### FR-12 Tool profile
**Status: AS-BUILT**  
`tool.html` shows holders and timeline; consumables use issuance view.

### FR-13 Consumables module
**Status: AS-BUILT**  
`consumables.html` multi-date preview + CSV/XLSX export of OUT issuances.

### FR-14 Damage reports
**Status: AS-BUILT**  
Submit damage with optional photo; list/filter by date.

### FR-15 Theme
**Status: AS-BUILT**  
Black / Red themes persisted in localStorage.

### FR-16 PWA
**Status: AS-BUILT**  
Manifest + service worker cache of static assets.

### FR-17 Role permissions
**Status: PLANNED**

### FR-18 Audit log
**Status: PLANNED**

### FR-19 End-of-day PDF
**Status: PLANNED**

### FR-20 Arabic UI
**Status: PLANNED**

### FR-21 QR generator
**Status: PLANNED**

## 4. Non-functional requirements

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-01 | Scan feedback latency | < 100ms local validation | Met |
| NFR-02 | Sync durability | No silent loss | Partial |
| NFR-03 | Auth strength | Per-user sessions | Not met |
| NFR-04 | XSS safety | Escape dynamic HTML | Mostly met |
| NFR-05 | Offline scanning | Queue while offline | Met |
| NFR-06 | Scalability | 10k+ ledger rows usable | At risk |
| NFR-07 | Backward compatibility | Preserve scan workflow | Required always |
| NFR-08 | Secrets hygiene | No secrets in git | Met for `Code.gs.txt` |

## 5. Data requirements

See [DATABASE_DESIGN.md](./DATABASE_DESIGN.md).

## 6. Constraints

- Must remain compatible with Google Apps Script web app CORS behavior  
- Must not require a custom backend server  
- Must not change Person→Direction→Tools unless explicitly requested  
- Must not commit live credentials  

## 7. Assumptions

- Catalog sheets keep code in column A and description in column E  
- Main ledger writes codes to column B; timestamps appear in column H  
- Deployed GAS URL in `config.js` matches the live deployment  

## 8. Out of scope (current release)

Native apps, SSO, multi-company tenancy, automated purchasing, supplier ERP.
