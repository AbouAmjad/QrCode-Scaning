# Workflow — Damage Report

## Status
**AS-BUILT**

## Actors
Supervisor / storekeeper.

## Entry point
`damage.html` (nav: **Damage**).

## Submit flow
1. Open Damage page (auth required).
2. Enter tool code (`I/E/C/B…`), person code (`P…`), quantity, optional remark.
3. Optionally take a live photo or upload an image (client compresses).
4. Submit → `apiSubmitDamage` → API `submitDamage`.
5. API inserts a damage row, adjusts warehouse stock, and clears custody for non-consumable tools by appending synthetic scans: `person → IN → tool × qty`.
6. UI shows success/error; list can reload for the date. The tool leaves **Not returned** for that person while remaining visible under Damage.

## Review flow
1. Choose date or All dates.
2. `getDamage` / `getDamageDates` populate cards and KPIs.

## Validation
| Rule | Enforced by |
|------|-------------|
| Tool prefix I/E/C/B | Client + API |
| Person prefix P | Client + API |
| Qty ≥ 1 | Client + API |

## Notes
Damage **clears custody holders** for the damaged qty (so the item does not stay under Not returned). Consumables are skipped (no custody lots). Repair lifecycle remains a separate action (`setLifecycle`).

## Related documents
- [API_REFERENCE.md](../API_REFERENCE.md) (`submitDamage`)
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [TEST_CASES/DAMAGE.md](../TEST_CASES/DAMAGE.md)
- [WORKFLOWS/REPAIR.md](./REPAIR.md)
- [SECURITY_POLICY.md](../SECURITY_POLICY.md) (photo sharing)

