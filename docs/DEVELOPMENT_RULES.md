# Development Rules

These rules complement [MASTER_PROMPT.md](./MASTER_PROMPT.md).

## Golden rules
1. Read the project before changing it.
2. Preserve **Person → Direction → Tools**.
3. Do not rewrite working modules.
4. Do not break backward compatibility.
5. Do not commit secrets.
6. Prefer surgical diffs over redesigns.
7. Update docs when behavior changes.
8. Seek approval for architectural changes.

## Source-of-truth ownership

| Concern | Owner file |
|---------|------------|
| Live scan validation | `scan.js` |
| Custody math | `parser.js` |
| HTTP / auth helpers | `config.js` |
| Chrome / nav / auth gate | `ui.js` |

## Change process
Analyze → Explain → Affected files → Risks → Approval → Implement → Self-test → Document.

## Forbidden without explicit request
- Renaming public files
- Changing API action names
- Removing offline queue
- Removing validations
- UI redesigns
- Silent parser semantic changes

## Testing minimum before finish
Login, Scanner, Parser views, Dashboard, Overview (`results.html`), Worker, Tool, Damage, Offline queue, Sync, no console errors.

## Related documents
- [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [TEST_PLAN.md](./TEST_PLAN.md)
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)

