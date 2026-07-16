# Test Cases — API

## Related documents
- [API_REFERENCE.md](../API_REFERENCE.md)
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)

## Scope
Validate Apps Script web app actions against the deployed `/exec` URL.

| ID | Call | Expected |
|----|------|----------|
| A1 | login bad creds | `{success:false}` |
| A2 | login good | `{success:true, token}` |
| A3 | getDates + token | Array of date strings |
| A4 | getData + token + date | Array of history rows |
| A5 | getData bad token | UNAUTHORIZED |
| A6 | scanData + token | status OK and column B write |
| A7 | getDesc known code | description string |
| A8 | submitDamage valid | success true |
| A9 | Unknown action on stale deploy | NO ACTION SPECIFIED |
| A10 | getDamageDates | Array or empty |

