# Test Cases — Dashboard

## Related documents
- [FEATURES/009_DASHBOARD_V2.md](../FEATURES/009_DASHBOARD_V2.md)
- [DECISIONS/ADR-005-DASHBOARD.md](../DECISIONS/ADR-005-DASHBOARD.md)
- [TEST_CASES/RESULTS.md](./RESULTS.md)

## Scope
Validate KPIs, alerts, lookup, refresh, and exports on `dashboard.html`.

| ID | Steps | Expected |
|----|-------|----------|
| D1 | Load date with data | KPIs populate |
| D2 | Tool out prior day still held | Overdue/alert text |
| D3 | No-direction tool scans | Warning alerts |
| D4 | Lookup existing tool | Result card + link |
| D5 | Lookup existing worker | Result card + link |
| D6 | Wait ~30s | Auto-refresh updates "Updated" time |
| D7 | Export CSV | Download works |
| D8 | Open Damage link | Navigates to `damage.html` |

