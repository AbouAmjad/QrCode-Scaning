# ADR-001 — Client-side Custody Parser

## Status
**Accepted** (as-built)

## Context
ToolCustody records scans as an ordered event log in Google Sheets. Supervisors need live views of who holds which tools without maintaining a second mutable inventory database.

## Decision
Compute custody in the browser with `CustodyParser` (`parser.js`) by replaying ledger rows returned from `getData`. The ledger remains the system of record; UI state is a projection.

## Alternatives considered
1. Write running inventory columns on each scan — rejected (dual-write drift risk).
2. Server-side projection in Apps Script — deferred (useful later for scale; not required for current volumes).

## Consequences
- **Positive:** Single ledger; static hosting stays simple; one math module for Overview/Dashboard/Worker/Tool.
- **Negative:** Full-history downloads; duplicated replay helpers can drift; client bugs affect reporting views.

## Rules
- Never fork parser logic into page scripts.
- Change parser semantics only with explicit approval and fixtures.
- Consumables (`C…`) must not participate in durable `holdersList` custody.

## Related documents
- [SOFTWARE_ARCHITECTURE_DOCUMENT.md](../SOFTWARE_ARCHITECTURE_DOCUMENT.md)
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [FEATURES/016_INVENTORY_MANAGEMENT.md](../FEATURES/016_INVENTORY_MANAGEMENT.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

