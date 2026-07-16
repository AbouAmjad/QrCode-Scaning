# Feature 006 — Repair Workflow

## Status
**PLANNED**

## Business goal
Take tools out of custody eligibility while under repair and return them to service.

## Primary files
- Not implemented

## Behavior / notes
- Damage module records incidents but does not change custody eligibility

## Gaps / risks
- No repair state machine

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [WORKFLOWS/REPAIR.md](../WORKFLOWS/REPAIR.md)
- [WORKFLOWS/DAMAGE_REPORT.md](../WORKFLOWS/DAMAGE_REPORT.md)
- [FEATURES/008_TOOL_LIFECYCLE.md](../FEATURES/008_TOOL_LIFECYCLE.md)

