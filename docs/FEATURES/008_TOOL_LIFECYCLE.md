# Feature 008 — Tool Lifecycle States

## Status
**PLANNED**

## Business goal
Explicit asset states (Active, Repair, Lost, Retired) affecting scan eligibility.

## Primary files
- Not implemented

## Behavior / notes
- Today: any I/E/B/C code shape can be scanned; catalog miss yields DESCRIPTION NOT FOUND

## Gaps / risks
- No state field in catalogs

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/006_REPAIR_WORKFLOW.md](../FEATURES/006_REPAIR_WORKFLOW.md)
- [FEATURES/023_DATA_VALIDATION.md](../FEATURES/023_DATA_VALIDATION.md)

