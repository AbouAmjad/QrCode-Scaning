# Workflow — Login

## Status
**AS-BUILT**

## Actors
Any operator with valid Apps Script credentials.

## Entry points
- `login.html`
- Redirect from protected pages via `TCUI.bootPage` → `requireAuth`

## Steps
1. Open `login.html` (or land there after auth gate).
2. Enter username and password.
3. Client calls `loginRequest` → GAS `action=login`.
4. On success: `setToken(token)`, redirect to Terminal (`index.html`).
5. If a token already exists when opening login: redirect to Terminal.
6. Logout (top bar): `clearToken` → `login.html`.

## Failure modes
| Condition | Expected UX |
|-----------|-------------|
| Empty fields | Client validation message |
| Bad credentials | Error message; no token |
| Network error | Network error message |
| CORS fallback path | **Risk:** may accept static token (KI-02) — treat as defect, not desired behavior |

## Security notes
See [SECURITY_POLICY.md](../SECURITY_POLICY.md) and [ADR-004](../DECISIONS/ADR-004-AUTHENTICATION.md).

## Related documents
- [TEST_CASES/LOGIN.md](../TEST_CASES/LOGIN.md)
- [API_REFERENCE.md](../API_REFERENCE.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

