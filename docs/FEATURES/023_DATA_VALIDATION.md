# Feature 023 — Data Validation

## Status
**PARTIAL**

## Business goal
Validation spans ScanEngine regex/sequence rules and GAS damage field checks.

## Primary files
- scan.js
- index.html
- damage.html
- Code.gs.example (submitDamage)

## Behavior / notes
- Person ^P[A-Z0-9-_.]+
- Tool ^[IEBC][A-Z0-9-_.]+
- Damage requires P + I/E/C/B prefixes server-side

## Gaps / risks
- Catalog existence not hard-fail on scan
- Dead settings validationMode unused

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/001_SESSION_SYSTEM.md](../FEATURES/001_SESSION_SYSTEM.md)
- [API_REFERENCE.md](../API_REFERENCE.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

