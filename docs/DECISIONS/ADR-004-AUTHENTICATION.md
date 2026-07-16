# ADR-004 — Shared Token Authentication

## Status
**Accepted historically** — **must harden** (see roadmap Phase 1)

## Context
GitHub Pages cannot hold server secrets. Apps Script web apps are commonly deployed as “Anyone” with an application-level token.

## Decision (current as-built)
1. `login` validates username/password in Apps Script.
2. Response returns a **shared static token**.
3. Client stores token in `localStorage`.
4. API calls send `token`; GAS checks equality.

## Known weaknesses (documented, not aspirational)
- Password/token often travel as GET query parameters.
- Client `getApiToken()` may fall back to hardcoded `SESSION_TOKEN` (KI-03).
- Login CORS fallback may accept static token without proving credentials (KI-02).
- No roles, expiry, or per-user sessions.

## Target direction
POST login, remove client fallbacks, expiring sessions, optional roles — without breaking Terminal UX.

## Related documents
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- [FEATURES/025_SECURITY_ENHANCEMENTS.md](../FEATURES/025_SECURITY_ENHANCEMENTS.md)
- [FEATURES/004_ROLE_PERMISSIONS.md](../FEATURES/004_ROLE_PERMISSIONS.md)
- [WORKFLOWS/LOGIN.md](../WORKFLOWS/LOGIN.md)
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)

