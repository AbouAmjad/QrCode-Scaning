# Feature 003 — Immutable Audit Log

## Status
**PLANNED**

## Business goal
Append-only record of security and operationally sensitive actions.

## Primary files
- Not implemented

## Behavior / notes
- Planned events: login success/fail, logout, damage submit, settings changes, admin overrides

## Gaps / risks
- No audit sheet/API/UI today

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md)
- [FEATURES/025_SECURITY_ENHANCEMENTS.md](../FEATURES/025_SECURITY_ENHANCEMENTS.md)

