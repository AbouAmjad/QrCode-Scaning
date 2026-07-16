# Feature 014 — Worker Profile

## Status
**AS-BUILT**

## Business goal
Profile of a worker code showing currently held durables and daily activity log.

## Primary files
- worker.html
- parser.js (parseForWorker, computeToolTakenDates)

## Behavior / notes
- toolsHeld with qty and first-taken date
- workerDailyLog by date
- deep link ?code=&date=

## Gaps / risks
- KI-01: consumable branch can throw ReferenceError (active before init)

## Acceptance ideas
- Documented behavior matches runtime on supported browsers.
- No regression to Person → Direction → Tools protocol.
- Related test cases in `TEST_CASES/` pass where AS-BUILT.

## Compatibility
Do not break existing Apps Script action names or ledger column conventions without a coordinated release.

## Related documents
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md)
- [TEST_CASES/WORKER.md](../TEST_CASES/WORKER.md)
- [WORKFLOWS/INVENTORY.md](../WORKFLOWS/INVENTORY.md)

