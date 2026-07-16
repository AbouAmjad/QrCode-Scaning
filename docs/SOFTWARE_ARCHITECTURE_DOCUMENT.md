# Software Architecture Document (SAD)

## 1. Introduction

This document describes the as-built architecture of ToolCustody.

### 1.1 Goals

- Preserve event-sourced custody correctness  
- Keep frontend static and deployable on GitHub Pages  
- Use Google Sheets as durable operational store  
- Support offline scanning with eventual sync  

### 1.2 Non-goals (current)

- Multi-tenant SaaS  
- Native mobile apps  
- Full RBAC / SSO  
- Separate relational inventory database  

## 2. Architectural style

**Hybrid:**

1. **Static SPA-like multi-page app** (MPA) on CDN/GitHub Pages  
2. **BFF-less remote API** via Google Apps Script  
3. **Event log + client-side projection** for custody  

### Why this style

Warehouse operations need fast scan UX and simple ops. Google Sheets is already the business system of record for catalogs. Replaying the scan ledger avoids maintaining a second mutable inventory that can drift.

## 3. Logical view

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Presentation │   │ Domain       │   │ Integration  │
│ HTML pages   │──▶│ ScanEngine   │──▶│ config.js API│
│ ui.js/app.css│   │ CustodyParser│   │ GAS Web App  │
└──────────────┘   └──────────────┘   └──────┬───────┘
                                             │
                                      ┌──────▼───────┐
                                      │ Sheets/Drive │
                                      └──────────────┘
```

## 4. Module boundaries

### 4.1 `ScanEngine` (`scan.js`)

- Validates live scan sequence  
- Maintains ephemeral session state  
- Emits queueable events (person / direction / tool)  
- Does **not** compute historical custody  

### 4.2 `CustodyParser` (`parser.js`)

- Pure-ish projection over rows from `getData`  
- Produces overview, dashboard, worker, tool, consumable views  
- Must remain the **only** custody math implementation  

### 4.3 `config.js`

- Configuration constants  
- Auth token helpers  
- HTTP client (`apiGet`, `apiPostForm`, `apiPostPlain`, `syncScan`)  

### 4.4 `ui.js`

- Cross-page chrome  
- `requireAuth` gate via `bootPage`  
- PWA registration  

### 4.5 Apps Script

- Auth gate (`token`)  
- Append-only ledger writes  
- Catalog lookups  
- Damage write path  

## 5. Data flow — scan

```
User scans code
  → ScanEngine.process(code)
  → (if valid) localStorage offlineScans push
  → processQueue()
  → syncScan(code) → GAS scanData
  → sheet column B append
```

## 6. Data flow — reporting

```
UI selects date
  → apiGet(getData, date)
  → rows[{toolCode, toolDescription, rowDate, timestamp, isTargetDay}]
  → CustodyParser.parse*(rows)
  → render DOM
```

## 7. Deployment view

| Artifact | Host |
|----------|------|
| HTML/JS/CSS/PWA | GitHub Pages |
| Backend | Apps Script deployment (web app, Anyone + token) |
| Data | Google Sheets / Drive |

## 8. Cross-cutting concerns

| Concern | Approach today | Maturity |
|---------|----------------|----------|
| Auth | Shared static token | Low |
| Offline | localStorage queue | Medium |
| Caching | Service Worker static assets | Medium |
| Observability | Browser console only | Low |
| i18n | English UI | Low |
| Testing | Manual cases in `/docs/TEST_CASES` | Low |

## 9. Scalability constraints

Current `getData` returns **full ledger history** and resolves descriptions by opening catalog sheets per unique code. This is acceptable for modest volumes and becomes the primary bottleneck as history grows.

Mitigations (roadmap): date-window queries, server-side description cache, optional custody snapshot.

## 10. Security architecture (summary)

- Frontend gate: localStorage token presence  
- API gate: token equality check in GAS  
- Secrets: Script Properties preferred; `Code.gs.txt` local only  

See [SECURITY_POLICY.md](./SECURITY_POLICY.md) and [DECISIONS/ADR-004-AUTHENTICATION.md](./DECISIONS/ADR-004-AUTHENTICATION.md).

## 11. Related ADRs

- [ADR-001 Parser](./DECISIONS/ADR-001-PARSER.md)  
- [ADR-002 Offline](./DECISIONS/ADR-002-OFFLINE.md)  
- [ADR-003 Google Sheets](./DECISIONS/ADR-003-GOOGLE_SHEETS.md)  
- [ADR-004 Authentication](./DECISIONS/ADR-004-AUTHENTICATION.md)  
- [ADR-005 Dashboard](./DECISIONS/ADR-005-DASHBOARD.md)  
