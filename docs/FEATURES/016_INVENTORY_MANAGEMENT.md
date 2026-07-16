# Feature 016 — Inventory / Custody Overview

## Status
**AS-BUILT**

## Business goal
Live custody inventory projected from the ledger — not a stock-count ERP.

## Primary files
- results.html
- parser.js (parseOverview, runInventory)

## Behavior / notes
- Qty = holdersList length for durables
- In store when qty=0
- Filters All/Out/In
- Workforce = persons scanned on target day

## Gaps / risks
- Holder matching by display name (KI-07)

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [WORKFLOWS/INVENTORY.md](../WORKFLOWS/INVENTORY.md)
- [DECISIONS/ADR-001-PARSER.md](../DECISIONS/ADR-001-PARSER.md)
- [TEST_CASES/RESULTS.md](../TEST_CASES/RESULTS.md)

