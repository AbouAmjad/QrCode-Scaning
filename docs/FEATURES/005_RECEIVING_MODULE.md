# Feature 005 — Receiving Module

## Status
**PLANNED**

## Business goal
Structured intake of new catalog items (tools/consumables/persons) into Sheets.

## Primary files
- Not implemented

## Behavior / notes
- Current workaround: edit catalog spreadsheets (A=code, E=description) manually

## Gaps / risks
- No receiving page or GAS action

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [WORKFLOWS/RECEIVING.md](../WORKFLOWS/RECEIVING.md)
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [FEATURES/019_QR_GENERATOR.md](../FEATURES/019_QR_GENERATOR.md)

