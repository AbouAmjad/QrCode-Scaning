# Workflow — Tool Return (IN)

## Status
**AS-BUILT**

## Actors
Scanner / storekeeper on Terminal (`index.html`).

## Protocol
```
Person (P…) → IN → Tool(s) being returned
```

## Happy path
1. Scan person `P…`.
2. Scan/press `IN`.
3. Scan durable tools being returned.
4. Scan a new person for the next return batch.

## Parser behavior (durables)
- Removes the last matching holder entry for that person name.
- If person not found but other holders exist: recovery warning (shifts another holder).
- If no holders: unregistered return note for the target day.

## Consumables
`C…` + `IN` is logged as a note only; consumables are not held in custody.

## Guardrails
Same session rules as checkout: cannot flip direction mid-batch after tools; duplicate IN rejected.

## Related documents
- [WORKFLOWS/TOOL_CHECKOUT.md](./TOOL_CHECKOUT.md)
- [FEATURES/001_SESSION_SYSTEM.md](../FEATURES/001_SESSION_SYSTEM.md)
- [FEATURES/016_INVENTORY_MANAGEMENT.md](../FEATURES/016_INVENTORY_MANAGEMENT.md)
- [TEST_CASES/SCANNER.md](../TEST_CASES/SCANNER.md)
- [TEST_CASES/RESULTS.md](../TEST_CASES/RESULTS.md)

