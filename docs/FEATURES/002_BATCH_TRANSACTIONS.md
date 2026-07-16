# Feature 002 — Batch Tool Scans per Direction

## Status
**AS-BUILT**

## Business goal
After a valid direction is set, multiple tool codes can be scanned for the same person without re-selecting IN/OUT.

## Primary files
- scan.js
- index.html

## Behavior / notes
- toolCount / toolsInBatch track the current batch
- new person scan resets direction and batch
- consumables (C…) accepted as tools but labeled as issued/IN-log in Terminal

## Gaps / risks
- No per-batch duplicate-tool guard yet

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [FEATURES/001_SESSION_SYSTEM.md](../FEATURES/001_SESSION_SYSTEM.md)
- [FEATURES/029_CONSUMABLES_MODULE.md](../FEATURES/029_CONSUMABLES_MODULE.md)

