# Feature 024 — Performance Optimization

## Status
**PLANNED**

## Business goal
Improve scalability of getData and description resolution as ledgers grow.

## Primary files
- Code.gs getData/getDesc
- dashboard.html refresh
- parser.js

## Behavior / notes
- Today: full history + per-unique-code catalog lookups

## Gaps / risks
- Primary scalability bottleneck (KI-11)

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [DECISIONS/ADR-003-GOOGLE_SHEETS.md](../DECISIONS/ADR-003-GOOGLE_SHEETS.md)
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

