# Feature 026 — API Improvements

## Status
**PLANNED**

## Business goal
Evolve Apps Script API while preserving backward compatibility.

## Primary files
- Code.gs.example
- config.js

## Behavior / notes
- Planned: readable scan ACK, batched getDesc, date-window getData, health check

## Gaps / risks
- scan sync still no-cors on client

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [API_REFERENCE.md](../API_REFERENCE.md)
- [FEATURES/022_OFFLINE_SYNC.md](../FEATURES/022_OFFLINE_SYNC.md)
- [FEATURES/024_PERFORMANCE_OPTIMIZATION.md](../FEATURES/024_PERFORMANCE_OPTIMIZATION.md)

