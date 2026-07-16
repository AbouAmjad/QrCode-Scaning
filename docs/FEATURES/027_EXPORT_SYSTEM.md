# Feature 027 — Export System

## Status
**PARTIAL**

## Business goal
Client-side exports for custody and consumables.

## Primary files
- parser.js
- results.html
- dashboard.html
- consumables.html

## Behavior / notes
- CSV custody export
- Consumables CSV with BOM
- XLSX when SheetJS present else CSV fallback

## Gaps / risks
- No unified export center
- No PDF

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/010_REPORTS_AND_ANALYTICS.md](../FEATURES/010_REPORTS_AND_ANALYTICS.md)
- [FEATURES/029_CONSUMABLES_MODULE.md](../FEATURES/029_CONSUMABLES_MODULE.md)

