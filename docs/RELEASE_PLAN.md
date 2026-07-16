# Release Plan

## Release types

| Type | When | Surfaces |
|------|------|----------|
| Frontend-only | UI/docs/PWA changes | GitHub Pages |
| Backend-only | `Code.gs` actions | Apps Script new version |
| Coordinated | API contract changes | Both, same day |

## Pre-release checklist
- [ ] No secrets staged (`Code.gs.txt` gitignored)
- [ ] [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) reviewed for regressions
- [ ] Manual smoke from [TEST_PLAN.md](./TEST_PLAN.md)
- [ ] `SCRIPT_URL` in `config.js` still correct
- [ ] If SW assets changed: bump `CACHE` id in `sw.js`
- [ ] Docs updated for behavior changes

## Frontend release steps
1. Merge to `main`
2. Push to GitHub
3. Verify https://abouamjad.github.io/QrCode-Scaning/
4. Hard refresh + confirm service worker

## Backend release steps
1. Sync/paste `Code.gs`
2. Deploy → **New version**
3. Smoke: login, getDates, scanData, submitDamage
4. Confirm Terminal still writes ledger column B

## Hotfix
Prefer minimal revert over large forward fixes. Record in [CHANGELOG.md](./CHANGELOG.md).

## Versioning suggestion
Date tags (`2026.07.16`) or semver once automation exists. Today: git SHA + Apps Script deployment version.

## Related documents
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md)
- [API_REFERENCE.md](./API_REFERENCE.md)

