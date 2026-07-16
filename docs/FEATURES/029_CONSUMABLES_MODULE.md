# Feature 029 — Consumables Module

## Status
**AS-BUILT**

## Business goal
C-prefix codes are issued on OUT without holders; dedicated multi-date export page exists.

## Primary files
- config.js (isConsumable)
- scan.js
- parser.js
- consumables.html
- tool.html

## Behavior / notes
- OUT increments issuedToday / issuance log
- IN notes return without custody
- consumables.html preview + CSV/XLSX
- Excluded from totalOut durable KPI

## Gaps / risks
- Worker log consumable path affected by KI-01

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [WORKFLOWS/TOOL_CHECKOUT.md](../WORKFLOWS/TOOL_CHECKOUT.md)
- [TEST_CASES/TOOL.md](../TEST_CASES/TOOL.md)
- [FEATURES/027_EXPORT_SYSTEM.md](../FEATURES/027_EXPORT_SYSTEM.md)

