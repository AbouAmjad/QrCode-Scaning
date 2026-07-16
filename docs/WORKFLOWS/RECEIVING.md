# Workflow — Receiving

## Status
**PLANNED** (not implemented in source)

## Intent
Provide a controlled way to add new person/tool/consumable codes into catalog spreadsheets and optionally generate QR labels.

## Current as-built workaround
Operators edit catalog Google Sheets directly:
- Column A = code
- Column E = description (default map in Apps Script)

There is **no** `receiving.html` page and **no** GAS `receiveItem` action in `Code.gs.example`.

## Future workflow sketch
1. Admin opens Receiving module.
2. Selects prefix (P/I/E/C/B).
3. Enters code + description (+ optional metadata).
4. System appends catalog row via Apps Script.
5. Optional: generate QR / print label ([FEATURES/019_QR_GENERATOR.md](../FEATURES/019_QR_GENERATOR.md)).
6. Optional: write audit entry ([FEATURES/003_AUDIT_LOG.md](../FEATURES/003_AUDIT_LOG.md)).

## Related documents
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [FEATURES/005_RECEIVING_MODULE.md](../FEATURES/005_RECEIVING_MODULE.md)
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md)

## Out of scope today
Do not confuse Receiving with Terminal checkout (`OUT`). Checkout assumes catalog codes already exist.

