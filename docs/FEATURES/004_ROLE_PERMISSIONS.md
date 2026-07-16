# Feature 004 — Role-Based Access Control

## Status
**PLANNED**

## Business goal
Separate Scanner, Supervisor, and Admin capabilities instead of one shared token.

## Primary files
- Not implemented — auth is shared static token (config.js + Code.gs)

## Behavior / notes
- Planned: role claim in session; nav visibility; GAS enforcement on sensitive actions

## Gaps / risks
- Any token holder can read/write all API actions

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- [DECISIONS/ADR-004-AUTHENTICATION.md](../DECISIONS/ADR-004-AUTHENTICATION.md)
- [FEATURES/025_SECURITY_ENHANCEMENTS.md](../FEATURES/025_SECURITY_ENHANCEMENTS.md)

