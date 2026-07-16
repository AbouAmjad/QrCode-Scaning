# Feature 015 — Tool Profile

## Status
**AS-BUILT**

## Business goal
Single-asset profile page for durables and consumables.

## Primary files
- tool.html
- parser.js

## Behavior / notes
- Rejects non-tool codes
- Routes C… to consumable presentation
- Links holders to worker profiles when personCode known

## Gaps / risks
- None recorded for this feature beyond general platform risks.

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/013_TOOL_TIMELINE.md](../FEATURES/013_TOOL_TIMELINE.md)
- [FEATURES/029_CONSUMABLES_MODULE.md](../FEATURES/029_CONSUMABLES_MODULE.md)
- [TEST_CASES/TOOL.md](../TEST_CASES/TOOL.md)

