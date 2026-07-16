# ADR-002 — Offline Scan Queue

## Status
**Accepted** (as-built; integrity hardening planned)

## Context
Field scanners may lose connectivity. Scanning must continue without blocking the operator.

## Decision
Persist pending scans in `localStorage` (`offlineScans`) with monotonic `scanSeq`, then sync via `syncScan` when online. Terminal session state can rebuild from unsent items through `ScanEngine.rebuildFromQueue`.

## Alternatives considered
1. Block scanning while offline — rejected (hurts field ops).
2. Background Sync API only — deferred (limited Safari support).

## Consequences
- **Positive:** Field resilience; undo last unsent; works on GitHub Pages.
- **Negative:** Current `no-cors` sync cannot confirm server ACK (KI-04); overflow may drop unsent items (KI-05).

## Follow-ups
Confirmable sync responses; refuse overflow instead of silent delete; multi-tab coordination.

## Related documents
- [FEATURES/022_OFFLINE_SYNC.md](../FEATURES/022_OFFLINE_SYNC.md)
- [WORKFLOWS/OFFLINE_SYNC.md](../WORKFLOWS/OFFLINE_SYNC.md)
- [TEST_CASES/OFFLINE.md](../TEST_CASES/OFFLINE.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

