# Project Roadmap

## Guiding principle
Stabilize integrity and security before expanding features. Preserve Person → Direction → Tools.

## Phase 1 — Stabilize & Secure (NOW)
1. Fix worker parser consumable bug (KI-01)
2. Remove auth bypass fallbacks (KI-02, KI-03)
3. Confirmable scan sync (KI-04)
4. Prevent queue silent loss (KI-05)
5. Block duplicate tools per batch (KI-06)
6. Keep docs/KNOWN_ISSUES current
7. SW cache bump on each release

**Exit:** no auth bypass; sync ACK; worker page stable.

## Phase 2 — Correctness & Maintainability
1. Custody keyed by person code
2. Parser consolidation + golden fixtures
3. Wire or remove dead settings
4. As-built docs stay complete
5. GAS/Pages deploy runbook practiced

## Phase 3 — Scale & Operations
1. Cached/batch getDesc
2. Date-scoped or incremental getData
3. Dashboard query reduction
4. Roles (scanner vs admin)
5. Audit log + backup procedure

## Phase 4 — Product expansion (sequential V2)

All ten V2 modules are ordered **one after another** in:

**[PRODUCT_V2_SEQUENTIAL_PLAN.md](./PRODUCT_V2_SEQUENTIAL_PLAN.md)**

```text
Step 0 Trust → 1 Roles → 2 Audit → 3 QR → 4 Receiving
→ 5 Repair → 6 Timeline → 7 Search → 8 Dashboard V2
→ 9 Reports → 10 Notifications
```

Do not start Step 1+ until Step 0 (trust) exit criteria pass.

## Explicitly deferred
Multi-tenant SaaS, native apps — unless newly prioritized. ERP depth lands via Receiving/PO inside the sequential plan.
