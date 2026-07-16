# Feature 001 — Strict Scan Session

## Status
**AS-BUILT**

## Business goal
Enforces the live scan state machine Person → Direction (IN|OUT) → Tool(s) on the Terminal.

## Primary files
- scan.js (ScanEngine)
- index.html (UI wiring, conflict modal, queue)

## Behavior / notes
- normalize/classify codes (person, direction, tool, unknown)
- reject direction without person
- reject tool without person/direction
- reject duplicate same direction
- block direction change after tools until new person
- IN/OUT conflict before tools → modal chooses final direction
- 600ms burst debounce for duplicate rapid scans
- rebuild session from unsent offline queue

## Gaps / risks
- Duplicate tool codes in one batch are currently allowed (KI-06)

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [WORKFLOWS/TOOL_CHECKOUT.md](../WORKFLOWS/TOOL_CHECKOUT.md)
- [WORKFLOWS/TOOL_RETURN.md](../WORKFLOWS/TOOL_RETURN.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)
- [TEST_CASES/SCANNER.md](../TEST_CASES/SCANNER.md)

