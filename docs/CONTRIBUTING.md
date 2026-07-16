# Contributing

## Before you start
1. Read [MASTER_PROMPT.md](./MASTER_PROMPT.md).
2. Read [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md).
3. Read [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).
4. Follow [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) and [CODING_STANDARDS.md](./CODING_STANDARDS.md).

## Scope of contributions
- Prefer surgical fixes and documented Phase 1 hardening.
- Do not change Person → Direction → Tools without explicit approval.
- Do not commit secrets (`Code.gs.txt`, `.env`, live tokens).

## Branching & review
- Prefer feature branches; production tracks `main`.
- PRs must explain why, list affected files, risks, and test evidence from [TEST_PLAN.md](./TEST_PLAN.md).

## Documentation
- Update as-built docs when behavior changes.
- Mark future work **PLANNED**.
- Keep status labels consistent: **AS-BUILT** / **PARTIAL** / **PLANNED**.

## Code ownership
| Concern | Module |
|---------|--------|
| Scan session rules | `scan.js` |
| Custody math | `parser.js` |
| API/auth helpers | `config.js` |
| Chrome/auth gate | `ui.js` |

Do not duplicate these modules inside page scripts.

## Related documents
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [RELEASE_PLAN.md](./RELEASE_PLAN.md)
- [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md)

