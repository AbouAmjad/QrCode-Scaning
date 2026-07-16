# Test Cases — Login

## Related documents
- [WORKFLOWS/LOGIN.md](../WORKFLOWS/LOGIN.md)
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- [DECISIONS/ADR-004-AUTHENTICATION.md](../DECISIONS/ADR-004-AUTHENTICATION.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

## Scope
Validate authentication UX and auth gate behavior for `login.html` and protected routes.

| ID | Preconditions | Steps | Expected |
|----|---------------|-------|----------|
| L1 | Cleared site data | Open `login.html` | Login form; no auto Terminal |
| L2 | Valid GAS creds | Submit correct user/pass | Token stored; redirect `index.html` |
| L3 | Valid deploy | Wrong password | Error shown; token not set |
| L4 | — | Empty user or pass | Client validation message |
| L5 | Logged out | Open `dashboard.html` | Redirect to login |
| L6 | Logged in | Click Logout | Token cleared; login page |
| L7 | Token present | Open `login.html` | Redirect Terminal |
| L8 | Network down | Attempt login | Network error path (watch KI-02; success without creds is a defect) |

