# Test Cases — Tool Profile

## Related documents
- [FEATURES/015_TOOL_PROFILE.md](../FEATURES/015_TOOL_PROFILE.md)
- [FEATURES/013_TOOL_TIMELINE.md](../FEATURES/013_TOOL_TIMELINE.md)
- [FEATURES/029_CONSUMABLES_MODULE.md](../FEATURES/029_CONSUMABLES_MODULE.md)

## Scope
Verify `tool.html?code=&date=` for durables and consumables.

| ID | Preconditions | Steps | Expected |
|----|---------------|-------|----------|
| T1 | Durable currently out | Open tool profile | Holders listed |
| T2 | Durable in store | Open profile | Empty holders / in-store message |
| T3 | History exists | Review timeline | OUT/IN/warn rows by date |
| T4 | Consumable `C…` | Open profile | Issuance messaging; no custody holders |
| T5 | Invalid non-tool code | Open with bad code | Error state |
| T6 | Holder has personCode | Click holder | Opens worker profile |
| T7 | Auth logged out | Open tool URL | Redirect login |

