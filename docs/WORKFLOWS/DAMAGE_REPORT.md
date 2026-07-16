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
4. Submit → `apiSubmitDamage` → GAS `submitDamage`.
5. Apps Script appends a row to the Damage sheet; photo may upload to Drive.
6. UI shows success/error; list can reload for the date.

## Review flow
1. Choose date or All dates.
2. `getDamage` / `getDamageDates` populate cards and KPIs.

## Validation
| Rule | Enforced by |
|------|-------------|
| Tool prefix I/E/C/B | Client + GAS |
| Person prefix P | Client + GAS |
| Qty ≥ 1 | Client + GAS |

## Notes
Damage does **not** change custody holders. Repair lifecycle is planned separately.

## Related documents
- [API_REFERENCE.md](../API_REFERENCE.md) (`submitDamage`)
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [TEST_CASES/DAMAGE.md](../TEST_CASES/DAMAGE.md)
- [WORKFLOWS/REPAIR.md](./REPAIR.md)
- [SECURITY_POLICY.md](../SECURITY_POLICY.md) (photo sharing)

