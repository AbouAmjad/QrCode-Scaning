# Feature 013 — Tool Timeline

## Status
**AS-BUILT**

## Business goal
Chronological per-day event log for a tool or consumable code.

## Primary files
- tool.html
- parser.js (parseForTool, parseForConsumable)

## Behavior / notes
- OUT/IN/warn/info events
- current holders for durables
- issuedTotal for consumables

## Gaps / risks
- None recorded for this feature beyond general platform risks.

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/015_TOOL_PROFILE.md](../FEATURES/015_TOOL_PROFILE.md)
- [TEST_CASES/TOOL.md](../TEST_CASES/TOOL.md)
- [WORKFLOWS/TOOL_CHECKOUT.md](../WORKFLOWS/TOOL_CHECKOUT.md)

