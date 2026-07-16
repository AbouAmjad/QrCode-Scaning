# Coding Standards

## Language
- Vanilla JavaScript (ES2017+); no mandatory framework.
- Prefer `const` / `let`.
- Keep compatibility with modern Chromium and Safari.

## Naming
- `camelCase` functions/variables.
- `PascalCase` module facades: `ScanEngine`, `CustodyParser`, `TCUI`.
- HTML ids/classes follow existing `tc-*` conventions.

## Module boundaries
| Module | Own |
|--------|-----|
| `scan.js` | Live session validation |
| `parser.js` | Historical custody projections |
| `config.js` | Config, auth helpers, HTTP |
| `ui.js` | Chrome, auth gate, PWA register |

Page scripts orchestrate DOM only; they must call shared engines for domain rules.

## HTML / CSS
- Protected pages: `TCUI.bootPage` + `mountHeader`.
- Prefer `app.css` tokens (`--tc-*`).
- Include manifest + theme-color consistently.

## Security in code
- Escape dynamic text with `escHtml`.
- Never commit live passwords/tokens.
- Never log secrets.

## Errors & UX copy
- Surface blocked-scan reasons in the Terminal log.
- Fail closed on auth where possible.
- Prefer precise operator language (Person, OUT, IN, tool code).

## Related documents
- [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md)
- [MASTER_PROMPT.md](./MASTER_PROMPT.md)
- [SECURITY_POLICY.md](./SECURITY_POLICY.md)

