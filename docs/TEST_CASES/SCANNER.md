# Test Cases — Scanner / Terminal

## Related documents
- [FEATURES/001_SESSION_SYSTEM.md](../FEATURES/001_SESSION_SYSTEM.md)
- [WORKFLOWS/TOOL_CHECKOUT.md](../WORKFLOWS/TOOL_CHECKOUT.md)
- [WORKFLOWS/TOOL_RETURN.md](../WORKFLOWS/TOOL_RETURN.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

## Scope
Validate `ScanEngine` session rules on `index.html` (Person → Direction → Tools).

| ID | Steps | Expected |
|----|-------|----------|
| S1 | P101 → OUT → E1-A | Queued; direction OUT; tool accepted |
| S2 | OUT with no person | Blocked + danger feedback |
| S3 | Tool with no direction | Warning panel / blocked |
| S4 | OUT → OUT | Second OUT rejected |
| S5 | P → OUT → tool → IN | IN blocked until new P |
| S6 | P → IN → OUT (no tools) | Conflict modal; choose one |
| S7 | Unknown code XYZ | Ignored/blocked message |
| S8 | Same code twice <600ms | Burst ignored |
| S9 | P → OUT → C1-A | Issued-style log label |
| S10 | New P after tools | Direction cleared; await IN/OUT |
| S11 | Same tool twice in batch | Document actual behavior (KI-06 currently allows) |

