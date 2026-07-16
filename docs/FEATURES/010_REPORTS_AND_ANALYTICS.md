# Feature 010 — Reports & Analytics

## Status
**PARTIAL**

## Business goal
Operational exports exist; advanced analytics/PDF do not.

## Primary files
- parser.js exportCsv / exportConsumables*
- results.html
- dashboard.html
- consumables.html

## Behavior / notes
- Custody CSV
- Consumables CSV/XLSX
- Dashboard CSV export button

## Gaps / risks
- End-of-day PDF planned
- No historical analytics warehouse

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/027_EXPORT_SYSTEM.md](../FEATURES/027_EXPORT_SYSTEM.md)
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md)

