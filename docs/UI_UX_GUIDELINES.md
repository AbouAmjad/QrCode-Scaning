# UI / UX Guidelines

## Product chrome
Sticky top bar (via `TCUI`):
**Terminal · Dashboard · Overview · Consumables · Damage · Theme · Logout**

Login page shows brand chrome without nav/logout.

## Page anatomy
1. Top bar  
2. `.tc-shell` card  
3. Page head (icon + title + subtitle + toolbar)  
4. Content (cards, tables, forms)  
5. Optional footer status  

## Terminology (UI labels)
| UI label | File |
|----------|------|
| Terminal | `index.html` |
| Dashboard | `dashboard.html` |
| Overview | `results.html` |
| Consumables | `consumables.html` |
| Damage | `damage.html` |
| Worker profile | `worker.html` |
| Tool profile | `tool.html` |

## Terminal UX
- Show steps: Person → IN/OUT → Tools.
- Block invalid sequences with clear Activity Log messages.
- Direction conflict must use an explicit choice dialog.
- Optional sound when enabled in settings.

## Data pages
- Require date selection before heavy loads where applicable.
- Provide loading, empty, and error states.
- Deep-link to worker/tool profiles with `code` + `date` query params.

## Themes
Support `theme-black` and `theme-red` via `config.js` theme helpers.

## Mobile
- Large scan input.
- Touch-friendly controls.
- No hover-only critical actions.

## Do not
- Clutter Terminal with dashboard widgets.
- Invent a second navigation system.
- Redesign design tokens without an explicit request.

## Related documents
- [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)
- [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- [FEATURES/001_SESSION_SYSTEM.md](./FEATURES/001_SESSION_SYSTEM.md)

