# Known Issues

Status labels: **Open**, **Accepted risk**, **Planned fix**.

## Critical

### KI-01 Worker profile consumable TDZ bug
**Open** · `parser.js` `parseForWorker` references `active` before initialization inside the consumable branch. Worker pages can throw when history contains `C...` codes.
**Impact:** Worker profile failure.
**Plan:** Phase 1 fix.

### KI-02 Login no-cors success fallback
**Open** · `loginRequest` may return static `SESSION_TOKEN` without proving credentials when CORS/readable fetch fails.
**Impact:** Auth bypass risk.
**Plan:** Remove fallback; require readable login response.

### KI-03 Client API token fallback
**Open** · `getApiToken()` uses hardcoded `SESSION_TOKEN` if localStorage token empty.
**Impact:** API usable without UI login.
**Plan:** Remove or hard-gate.

## High

### KI-04 Optimistic sync (no-cors)
**Accepted risk (historical)** · `syncScan` cannot read server JSON; marks queue items sent if fetch does not throw.
**Impact:** Possible ledger gaps while UI shows Synced.
**Plan:** Confirmable sync.

### KI-05 Queue overflow drops unsent scans
**Open** · When offline queue exceeds limit, oldest unsent items may be removed.
**Impact:** Silent scan loss.
**Plan:** Block/warn instead of drop.

### KI-06 Duplicate tools allowed in one batch
**Open** · `ScanEngine` does not reject repeating the same tool code in the current batch.
**Impact:** Inflated OUT quantities.
**Plan:** Reject duplicates per batch.

### KI-07 Holder identity by display name
**Accepted risk** · Parser matches holders by person description string, not `P` code.
**Impact:** Mis-attribution if names collide.
**Plan:** Key by person code.

## Medium

### KI-08 Dead settings
`autoDirectionMode`, `validationMode`, `alertLevel`, `OVERDUE_DAYS`, `soundVolume` are stored/shown but not fully enforced by engines.

### KI-09 PWA stale cache
Clients may keep old HTML/JS until cache name bump / hard refresh.

### KI-10 Damage photos public links
Drive files shared as anyone-with-link view.

### KI-11 Full-history getData cost
Performance degrades as ledger grows.

### KI-12 Unrelated ABU-HASAN.html in repo
Not part of ToolCustody product surface.

## Process

### KI-13 Documentation stubs
Resolved by documentation generation pass; keep docs updated going forward.

### KI-14 TODO.md PWA checkbox outdated
PWA files exist; TODO still listed PWA as future in places.
