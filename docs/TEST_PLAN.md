# Test Plan

## Approach
Manual regression suite for a static PWA + Apps Script system. Automate later with parser/scan fixtures.

## Environments
- Production Pages URL
- Optional local static server against the same or copy GAS deployment

## Entry criteria
- Backend **New version** deployed
- `SCRIPT_URL` correct
- Tester has credentials
- Sample `P` / tool codes exist in catalogs

## Test suites
See `TEST_CASES/`:
- [LOGIN](./TEST_CASES/LOGIN.md)
- [SCANNER](./TEST_CASES/SCANNER.md)
- [OFFLINE](./TEST_CASES/OFFLINE.md)
- [RESULTS](./TEST_CASES/RESULTS.md) (Overview)
- [DASHBOARD](./TEST_CASES/DASHBOARD.md)
- [WORKER](./TEST_CASES/WORKER.md)
- [TOOL](./TEST_CASES/TOOL.md)
- [DAMAGE](./TEST_CASES/DAMAGE.md)
- [API](./TEST_CASES/API.md)

## Smoke (every release)
1. Login success/fail
2. P→OUT→tool sync to sheet
3. Overview shows tool out
4. P→IN→tool returns in store
5. Dashboard loads
6. Damage submit without photo
7. Hard refresh still authenticated until logout

## Exit criteria
- No Critical defects introduced
- Smoke green
- Docs updated if behavior changed

## Defect severity
| Level | Meaning |
|-------|---------|
| Critical | Data loss, auth bypass, crash |
| High | Wrong custody attribution |
| Medium | UX/workflow friction |
| Low | Cosmetic |

## Related documents
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- [RELEASE_PLAN.md](./RELEASE_PLAN.md)

