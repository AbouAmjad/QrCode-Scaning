# Workflow — Inventory Overview

## Status
**AS-BUILT**

## Actors
Supervisor / storekeeper.

## Entry point
Overview page: `results.html` (nav label: **Overview**).

## Steps
1. Authenticate and open Overview.
2. Select a ledger date → Load.
3. Client calls `getData`, then `CustodyParser.parseOverview`.
4. Review KPIs (checked out, workforce, unique out, tool types).
5. Filter: All / Out only / In store; optional search.
6. Click a tool row → `tool.html?code=&date=`.
7. Click a worker → `worker.html?code=&date=`.
8. Optionally export CSV.

## Meaning of columns
| Field | Durable tools (I/E/B) | Consumables (C) |
|-------|------------------------|-----------------|
| Qty | Count of holders | Issued count for target-day activity when listed |
| Holders | People holding units / In store | Issuance note (no custody holders) |

## Terminology
- **Overview** = product name for `results.html`
- **Inventory** = custody projection, not ERP stock-count

## Related documents
- [FEATURES/016_INVENTORY_MANAGEMENT.md](../FEATURES/016_INVENTORY_MANAGEMENT.md)
- [DECISIONS/ADR-001-PARSER.md](../DECISIONS/ADR-001-PARSER.md)
- [TEST_CASES/RESULTS.md](../TEST_CASES/RESULTS.md)
- [FEATURES/014_WORKER_PROFILE.md](../FEATURES/014_WORKER_PROFILE.md)
- [FEATURES/015_TOOL_PROFILE.md](../FEATURES/015_TOOL_PROFILE.md)

