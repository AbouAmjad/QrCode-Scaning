# Workflow — Repair

## Status
**PLANNED** (not implemented in source)

## Intent
Temporarily remove a durable tool from normal custody circulation while it is repaired, then return it to service.

## Current as-built related behavior
- [Damage reports](./DAMAGE_REPORT.md) record breakage incidents (sheet + optional photo).
- Damage **does not** change parser holders or block Terminal scans.
- Tools remain scannable unless operators stop using the code operationally.

## Future workflow sketch
1. Supervisor marks tool `In Repair` (lifecycle state).
2. Terminal rejects OUT for that code (validation enhancement).
3. Repair notes / vendor / dates stored.
4. Mark `Active` again → eligible for custody.
5. Optional link from a Damage row to a Repair ticket.

## Related documents
- [FEATURES/006_REPAIR_WORKFLOW.md](../FEATURES/006_REPAIR_WORKFLOW.md)
- [FEATURES/008_TOOL_LIFECYCLE.md](../FEATURES/008_TOOL_LIFECYCLE.md)
- [WORKFLOWS/DAMAGE_REPORT.md](./DAMAGE_REPORT.md)

## Compatibility note
Any repair state must remain additive to the Person → Direction → Tools ledger model ([ADR-001](../DECISIONS/ADR-001-PARSER.md)).

