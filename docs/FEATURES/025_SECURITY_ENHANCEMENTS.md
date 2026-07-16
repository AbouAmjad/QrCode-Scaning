# Feature 025 — Security Enhancements

## Status
**PLANNED**

## Business goal
Hardening plan for auth, tokens, Drive sharing, and sync integrity.

## Primary files
- config.js
- login.html
- Code.gs.example
- SECURITY_POLICY.md

## Behavior / notes
- Current model documented in ADR-004 and SECURITY_POLICY

## Gaps / risks
- KI-02/KI-03 fallbacks
- GET password/token
- public damage links

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- [DECISIONS/ADR-004-AUTHENTICATION.md](../DECISIONS/ADR-004-AUTHENTICATION.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

