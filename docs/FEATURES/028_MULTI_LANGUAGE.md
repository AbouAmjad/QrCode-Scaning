# Feature 028 — Multi-language (AR/EN)

## Status
**PLANNED**

## Business goal
UI language toggle with Arabic-first operator UX while keeping QR payloads unchanged.

## Primary files
- Not implemented — UI strings currently English

## Behavior / notes
- Code identifiers (P/IN/OUT/I/E/C/B) remain English protocol

## Gaps / risks
- No i18n dictionary layer

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [UI_UX_GUIDELINES.md](../UI_UX_GUIDELINES.md)
- [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md)

