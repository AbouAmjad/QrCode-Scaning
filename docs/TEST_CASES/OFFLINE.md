# Test Cases — Offline Queue

## Related documents
- [FEATURES/022_OFFLINE_SYNC.md](../FEATURES/022_OFFLINE_SYNC.md)
- [WORKFLOWS/OFFLINE_SYNC.md](../WORKFLOWS/OFFLINE_SYNC.md)
- [DECISIONS/ADR-002-OFFLINE.md](../DECISIONS/ADR-002-OFFLINE.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

## Scope
Validate localStorage queue, undo, rebuild, and sync behavior on Terminal.

| ID | Steps | Expected |
|----|-------|----------|
| O1 | Offline; valid P/OUT/tool | Pending count increases |
| O2 | Back online | Queue attempts sync; may mark Synced (optimistic today — KI-04) |
| O3 | Undo last unsent | Removes only last pending |
| O4 | Reload with pending | Session rebuilt from unsent |
| O5 | Fill beyond queue limit | Observe drop/block behavior (KI-05) |
| O6 | Multi-tab Terminal | Note duplicate risk; document observed behavior |

