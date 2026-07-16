# Test Cases — Worker Profile

## Related documents
- [FEATURES/014_WORKER_PROFILE.md](../FEATURES/014_WORKER_PROFILE.md)
- [WORKFLOWS/INVENTORY.md](../WORKFLOWS/INVENTORY.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) (KI-01)

## Scope
Verify `worker.html?code=P…&date=` projections from `CustodyParser.parseForWorker`.

| ID | Preconditions | Steps | Expected |
|----|---------------|-------|----------|
| W1 | Worker holding durables | Open worker profile | Tools listed with qty + taken date |
| W2 | Worker returned all | Open profile | Empty held state |
| W3 | Multi-day history | Scroll history | Daily log sections render |
| W4 | History includes `C…` | Open profile | Must not crash (watch KI-01) |
| W5 | Held tool visible | Click tool | Opens tool profile |
| W6 | Missing `code` | Open `worker.html` | Error / empty guidance state |
| W7 | Auth logged out | Open worker URL | Redirect login |

