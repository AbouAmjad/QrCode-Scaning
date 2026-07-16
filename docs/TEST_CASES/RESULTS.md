# Test Cases — Results / Overview

## Related documents
- [WORKFLOWS/INVENTORY.md](../WORKFLOWS/INVENTORY.md)
- [FEATURES/016_INVENTORY_MANAGEMENT.md](../FEATURES/016_INVENTORY_MANAGEMENT.md)
- [UI_UX_GUIDELINES.md](../UI_UX_GUIDELINES.md)

## Scope
Validate Overview page (`results.html`) custody projection and navigation.

| ID | Steps | Expected |
|----|-------|----------|
| R1 | After OUT durable | Qty > 0; holder visible |
| R2 | After matching IN | Qty 0 / In store |
| R3 | Filter Out only | Only out durables (per listing rules) |
| R4 | Filter In store | qty === 0 rows that are listed |
| R5 | Search code fragment | Table filters |
| R6 | Click tool | `tool.html?code=&date=` |
| R7 | Click worker | `worker.html?code=&date=` |
| R8 | Export CSV | File downloads with codes |

