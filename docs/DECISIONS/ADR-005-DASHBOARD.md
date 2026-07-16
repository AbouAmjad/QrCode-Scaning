# ADR-005 — Dashboard as Parser Projection

## Status
**Accepted** (as-built)

## Context
Supervisors need KPIs and alerts without a separate analytics warehouse.

## Decision
`dashboard.html` loads `getData` for a selected date context, then calls `CustodyParser.parseDashboard` to derive KPIs, alerts, overdue heuristics, top holders, and lookup results. Auto-refresh uses `AppConfig.DASHBOARD_REFRESH_MS` (30s).

## Consequences
- **Positive:** Reuses custody truth from ADR-001; one mental model for Overview and Dashboard.
- **Negative:** Refresh cost grows with ledger size; `OVERDUE_DAYS` setting is not yet wired (KI-08).

## Follow-ups
Date-scoped API; alert filters; honor `OVERDUE_DAYS`.

## Related documents
- [FEATURES/009_DASHBOARD_V2.md](../FEATURES/009_DASHBOARD_V2.md)
- [TEST_CASES/DASHBOARD.md](../TEST_CASES/DASHBOARD.md)
- [DECISIONS/ADR-001-PARSER.md](./ADR-001-PARSER.md)

