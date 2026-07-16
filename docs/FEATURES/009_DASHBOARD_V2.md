# Feature 009 — Dashboard Enhancements

## Status
**PARTIAL**

## Business goal
dashboard.html already provides KPIs, alerts, overdue heuristic, top holders, lookup, CSV, 30s refresh via parseDashboard.

## Primary files
- dashboard.html
- parser.js (parseDashboard)
- config.js (DASHBOARD_REFRESH_MS)

## Behavior / notes
- Checked out / workers / warnings / overdue KPIs
- Alerts from warnings, NOT FOUND descriptions, overdue holders
- Quick lookup via CustodyParser.lookupTool
- Links to Overview and Damage

## Gaps / risks
- OVERDUE_DAYS unused; no alert-only filter UI; full-history getData cost

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [DECISIONS/ADR-005-DASHBOARD.md](../DECISIONS/ADR-005-DASHBOARD.md)
- [TEST_CASES/DASHBOARD.md](../TEST_CASES/DASHBOARD.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

