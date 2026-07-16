# Feature 021 — Backup & Restore

## Status
**PARTIAL**

## Business goal
Durability currently relies on Google Sheets/Drive version history.

## Primary files
- Google Workspace (external)
- DEPLOYMENT_GUIDE.md rollback notes

## Behavior / notes
- Manual restore via Sheets version history
- Frontend rollback via git
- GAS rollback via prior deployment version

## Gaps / risks
- No automated export job or restore runbook UI

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)

