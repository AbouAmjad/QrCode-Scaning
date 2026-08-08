# Development Rules

These rules complement [MASTER_PROMPT.md](./MASTER_PROMPT.md) and the root
**[AI_PROJECT_MEMORY.md](../AI_PROJECT_MEMORY.md)** (authoritative for agents).

## Golden rules
1. Read the project before changing it (start with root memory files).
2. Preserve **Person → Direction → Tools**.
3. Do not rewrite working modules.
4. Do not break backward compatibility.
5. Do not commit secrets.
6. Prefer surgical diffs over redesigns.
7. Update docs when behavior changes (root CHANGELOG / TASKS / DECISIONS).
8. Seek approval for architectural changes.
9. Never wipe production ledger tables to fix UI bugs.
10. Match production Postgres column names before writing SQL.

## Source-of-truth ownership

| Concern | Owner file |
|---------|------------|
| Live scan validation | `scan.js` |
| Client custody math | `parser.js` |
| Server custody math | `server/src/custody.js` |
| Stock available qty | `server/src/lib/stock.js` |
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
- Silent parser / stock semantic changes
- Re-adding Timesheet to production

## Testing minimum before finish
Login, Terminal, Catalog stock, Outstanding, Projects on-site, Receiving, Damage, Dashboard, smoke.js, no console errors.

## Related documents
- [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [../ARCHITECTURE.md](../ARCHITECTURE.md)
- [../DECISIONS.md](../DECISIONS.md)
