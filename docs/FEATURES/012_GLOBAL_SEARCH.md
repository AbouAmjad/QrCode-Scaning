# Feature 012 — Global Search

## Status
**PARTIAL**

## Business goal
Search exists on Overview and Dashboard lookup; no dedicated global search page.

## Primary files
- results.html (searchInput)
- dashboard.html (quickSearch)
- parser.js (lookupTool)

## Behavior / notes
- Filter tools by code/description
- Lookup tool or worker from loaded rows

## Gaps / risks
- Requires data already loaded for selected date
- No cross-date search API

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [TEST_CASES/RESULTS.md](../TEST_CASES/RESULTS.md)
- [TEST_CASES/DASHBOARD.md](../TEST_CASES/DASHBOARD.md)

