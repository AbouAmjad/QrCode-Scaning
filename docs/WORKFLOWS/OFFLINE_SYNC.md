# Workflow — Offline Sync

## Status
**AS-BUILT** (integrity **PARTIAL** — see known issues)

## Actors
Terminal operator in low-connectivity environments.

## Storage
- `localStorage.offlineScans` — queue items `{ code, seq, sent, logId, timestamp }`
- `localStorage.scanSeq` — monotonic sequence

## Steps
1. Valid scans are accepted while offline and appended to the queue.
2. UI shows pending count and offline/online status.
3. When online, `processQueue` sends unsent items in sequence order via `syncScan`.
4. Items are marked `sent: true` when the fetch does not throw (**optimistic** today).
5. Undo removes only the last **unsent** item.
6. On reload, `ScanEngine.rebuildFromQueue` restores session from unsent codes.

## Operator guidance
- Prefer stable network during high-volume sessions.
- Watch the pending counter before leaving the site/device.
- Do not clear site data while pending > 0.

## Risks
| Risk | ID |
|------|----|
| False “Synced” without server ACK | KI-04 |
| Queue overflow dropping unsent | KI-05 |
| Multi-tab duplicate sends | operational |

## Related documents
- [FEATURES/022_OFFLINE_SYNC.md](../FEATURES/022_OFFLINE_SYNC.md)
- [DECISIONS/ADR-002-OFFLINE.md](../DECISIONS/ADR-002-OFFLINE.md)
- [TEST_CASES/OFFLINE.md](../TEST_CASES/OFFLINE.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

