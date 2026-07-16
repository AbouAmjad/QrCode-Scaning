# Feature 022 — Offline Synchronization

## Status
**AS-BUILT**

## Business goal
Terminal queues scans in localStorage and syncs when online.

## Primary files
- index.html (queue)
- config.js (syncScan)
- scan.js (rebuildFromQueue)

## Behavior / notes
- offlineScans + scanSeq
- processQueue every 5s
- undo last unsent
- queue limit setting

## Gaps / risks
- no-cors optimistic ACK (KI-04)
- overflow may drop unsent (KI-05)

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [WORKFLOWS/OFFLINE_SYNC.md](../WORKFLOWS/OFFLINE_SYNC.md)
- [DECISIONS/ADR-002-OFFLINE.md](../DECISIONS/ADR-002-OFFLINE.md)
- [TEST_CASES/OFFLINE.md](../TEST_CASES/OFFLINE.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

