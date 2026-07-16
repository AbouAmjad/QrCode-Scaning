# Workflow — Tool Checkout (OUT)

## Status
**AS-BUILT**

## Actors
Scanner / storekeeper on Terminal (`index.html`).

## Protocol
```
Person (P…) → OUT → Tool(s) (I… / E… / B… / C…)
```

## Happy path
1. Scan or enter person code `P…`.
2. Scan/press `OUT`.
3. Scan one or more asset codes.
4. Scan a new person code to start another batch.

## System behavior
- `ScanEngine` validates order and queues codes locally.
- Sync appends each code to the main ledger column B.
- Parser: durable `OUT` pushes the person onto `holdersList`.
- Consumable `C…` on `OUT` = issuance log only (no holders).

## Rejected / blocked paths
| Input | Result |
|-------|--------|
| OUT without person | Blocked |
| Tool without direction | Blocked + warning UI |
| OUT while already OUT | Rejected (duplicate direction) |
| IN after tools in OUT batch | Blocked until new person |
| IN then OUT before tools | Conflict modal → choose final direction |

## Related documents
- [FEATURES/001_SESSION_SYSTEM.md](../FEATURES/001_SESSION_SYSTEM.md)
- [FEATURES/029_CONSUMABLES_MODULE.md](../FEATURES/029_CONSUMABLES_MODULE.md)
- [WORKFLOWS/TOOL_RETURN.md](./TOOL_RETURN.md)
- [TEST_CASES/SCANNER.md](../TEST_CASES/SCANNER.md)
- [DECISIONS/ADR-001-PARSER.md](../DECISIONS/ADR-001-PARSER.md)

