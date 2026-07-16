# ADR-003 — Google Sheets as System of Record

## Status
**Accepted** (as-built)

## Context
Catalogs and operational records already live in Google Workspace. Introducing a custom database would add hosting and ops cost.

## Decision
Use Google Sheets for the scan ledger, prefix catalogs (P/I/E/C/B), and Damage records. Use Google Apps Script as the HTTP API. Use Drive for optional damage photos.

## Alternatives considered
1. Firebase / SQL backend — deferred (overkill for current scale).
2. JSON files in repo — rejected (not multi-writer safe).

## Consequences
- **Positive:** Familiar operations; low infrastructure cost; fast iteration.
- **Negative:** Quotas/latency; weak schema enforcement; expensive full-ledger reads (KI-11).

## Follow-ups
Batch/cached `getDesc`; safer append strategy; optional custody snapshots.

## Related documents
- [DATABASE_DESIGN.md](../DATABASE_DESIGN.md)
- [API_REFERENCE.md](../API_REFERENCE.md)
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- [FEATURES/024_PERFORMANCE_OPTIMIZATION.md](../FEATURES/024_PERFORMANCE_OPTIMIZATION.md)

