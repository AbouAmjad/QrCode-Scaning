# Product V2 — Sequential Build Plan (خطوة تلو الأخرى)

| Field | Value |
|-------|--------|
| **Date** | 2026-07-16 |
| **Mode** | Ordered delivery of all 10 V2 modules — one step fully done before the next |
| **Rule** | No parallel feature branches mixing modules; finish → verify → next |
| **Preserve** | **Person → Direction → Tools** on the scanner |
| **Prerequisite** | Trust fixes (Step 0) **must** complete before any of the 10 modules |

### Progress (2026-07-16)

| Step | Status |
|------|--------|
| 0 Trust (client) | ✅ parser, auth, sync ack, queue, XSS, duplicate tools |
| 0 Trust (GAS deploy) | ⬜ copy `Code.gs.example` + rotate `APP_TOKEN` — see [DEPLOY_V2_FOUNDATION.md](./DEPLOY_V2_FOUNDATION.md) |
| 1–10 UI foundations | ✅ pages + API hooks (deepen next iterations) |

---

## How “خطوة تلو الأخرى” works

1. Complete the current step’s **exit criteria**.  
2. Deploy / smoke-test on production data sample.  
3. Mark step **DONE** in this file.  
4. Only then start the next step.  
5. Do **not** start Receiving while Roles is half-done, etc.

---

## Master sequence (locked order)

```text
Step 0   TRUST FOUNDATION          ← إلزامي قبل الكل
Step 1   Roles & Permissions       ← وحدتك #4
Step 2   Audit Log                 ← وحدتك #3
Step 3   Barcode & QR Generator    ← وحدتك #10
Step 4   Receiving Module          ← وحدتك #1
Step 5   Repair / Lifecycle        ← وحدتك #2
Step 6   Activity Timeline         ← وحدتك #9
Step 7   Search Engine             ← وحدتك #8
Step 8   Dashboard V2              ← وحدتك #7
Step 9   Reports                   ← وحدتك #6
Step 10  Notifications             ← وحدتك #5
```

**Why this order (not your star list order):**  
each step needs the previous one’s data and security. Example: Receiving needs QR generation; Notifications need overdue/damage/reports signals; Audit must exist before high-write modules.

---

# Step 0 — Trust Foundation (NOT optional)

**Source:** [NEXT_VERSION_PLAN.md](./NEXT_VERSION_PLAN.md) Phase 1 + Phase 2.A  
**Status:** ⬜ Not started

| Sub | AUD | Work |
|-----|-----|------|
| 0.1 | 003, 004 | Worker parser correctness |
| 0.2 | 002, 001 | Auth real + no public token fallback |
| 0.3 | 012, 013 | XSS sinks |
| 0.4 | 005, 006, 009 | Honest sync, durable queue, no duplicate tools |

**Exit criteria**

- [ ] Worker holdings correct; no consumable crash  
- [ ] Login cannot succeed without server proof  
- [ ] No hardcoded API token fallback; token rotated  
- [ ] Sync only marks sent on ack; unsent never deleted  
- [ ] Scanner workflow unchanged  

**Gate:** ⛔ Do not start Step 1 until all boxes above are checked.

---

# Step 1 — Roles & Permissions ⭐

**Your item:** #4  
**Docs:** [FEATURES/004_ROLE_PERMISSIONS.md](./FEATURES/004_ROLE_PERMISSIONS.md) · AUD-023  
**Status:** ⬜ Locked until Step 0 DONE

| Role | Typical access |
|------|----------------|
| **Admin** | All modules, users, settings, receiving, scrap |
| **Store Keeper** | Scan, receiving, consumables, damage entry |
| **Supervisor** | Dashboard, worker/tool views, repair, reports, approve scrap |
| **Viewer** | Read-only dashboard / history / search |

**Must include**

- Role stored server-side; GAS rejects forbidden actions  
- UI hides nav (UX only — server is source of truth)  
- Align with session tokens (AUD-014 if not done in Step 0 extension)

**Exit criteria**

- [ ] Four roles enforceable on GAS  
- [ ] Viewer cannot sync/write  
- [ ] Store Keeper cannot change users/roles  
- [ ] Docs AS-BUILT updated  

---

# Step 2 — Audit Log ⭐

**Your item:** #3  
**Docs:** [FEATURES/003_AUDIT_LOG.md](./FEATURES/003_AUDIT_LOG.md)  
**Status:** ⬜ After Step 1

**Every recorded event includes**

| Field | Meaning |
|-------|---------|
| Who | User id + role |
| When | Timestamp (ISO + local) |
| Before / After | Material state change snapshot |
| Device | User-Agent / coarse device id (no silent PII abuse) |
| Action | e.g. `SYNC_OUT`, `LOGIN`, `DAMAGE_CREATE`, `ROLE_CHANGE` |

**Exit criteria**

- [ ] Sensitive writes append audit row  
- [ ] Admin can query recent audit  
- [ ] Tamper-evident enough for store ops (append-only sheet/tab)  
- [ ] Docs AS-BUILT  

---

# Step 3 — Barcode & QR Generator ⭐

**Your item:** #10  
**Docs:** [FEATURES/019_QR_GENERATOR.md](./FEATURES/019_QR_GENERATOR.md), [020_LABEL_PRINTING.md](./FEATURES/020_LABEL_PRINTING.md)  
**Status:** ⬜ After Step 2

**Scope**

- Generate QR for Person / Tool / Consumable codes  
- Print-ready labels (browser print CSS)  
- Codes follow existing conventions (`P…`, `I/E…`, `C/B…`)

**Exit criteria**

- [ ] Admin/Store Keeper can generate + print label  
- [ ] Generated code scannable by existing `scan.js`  
- [ ] Audit: who generated which code  
- [ ] Does not invent a second custody protocol  

---

# Step 4 — Receiving Module ⭐

**Your item:** #1  
**Docs:** [FEATURES/005_RECEIVING_MODULE.md](./FEATURES/005_RECEIVING_MODULE.md), [WORKFLOWS/RECEIVING.md](./WORKFLOWS/RECEIVING.md), suppliers/PO features  
**Status:** ⬜ After Step 3

**Fields / entities**

- Supplier  
- Invoice  
- Purchase Order  
- Cost  
- Warranty  
- QR generation (calls Step 3)  
- Catalog write (code + description + metadata sheet/columns)

**Exit criteria**

- [ ] New tool enters catalog via Receiving UI (not only manual Sheet edit)  
- [ ] Supplier / invoice / PO / cost / warranty stored  
- [ ] QR issued in same flow  
- [ ] Roles enforced; audit written  
- [ ] Receiving ≠ checkout (`OUT`) — clearly separated  

---

# Step 5 — Repair Module (Lifecycle) ⭐

**Your item:** #2  
**Docs:** [FEATURES/006_REPAIR_WORKFLOW.md](./FEATURES/006_REPAIR_WORKFLOW.md), [008_TOOL_LIFECYCLE.md](./FEATURES/008_TOOL_LIFECYCLE.md)  
**Status:** ⬜ After Step 4

**States (per tool)**

```text
Active → Under Repair → Awaiting Parts → Active
                     ↘ Scrap
Returned (from repair vendor / external)
```

**Exit criteria**

- [ ] State machine enforced (illegal transitions blocked)  
- [ ] Tool Under Repair cannot be OUT as normal Active (rule documented + enforced)  
- [ ] Link from Damage → Repair optional but clear  
- [ ] Audit on every state change  
- [ ] Person → Direction → Tools still only for Active custody moves  

---

# Step 6 — Activity Timeline ⭐

**Your item:** #9  
**Docs:** [FEATURES/013_TOOL_TIMELINE.md](./FEATURES/013_TOOL_TIMELINE.md), [014_WORKER_PROFILE.md](./FEATURES/014_WORKER_PROFILE.md)  
**Status:** ⬜ After Step 5

**Scope**

- Full timeline per **tool** (custody + repair + damage + receiving)  
- Full timeline per **worker** (OUT/IN + warnings)

**Exit criteria**

- [ ] One page/section: chronological events  
- [ ] Uses person **codes** where possible (AUD-010 if already done)  
- [ ] Roles: Viewer can read  

---

# Step 7 — Search Engine ⭐

**Your item:** #8  
**Docs:** [FEATURES/012_GLOBAL_SEARCH.md](./FEATURES/012_GLOBAL_SEARCH.md)  
**Status:** ⬜ After Step 6

**Unified search targets**

- Worker · Tool · QR · Date · Operation (and later: PO/Invoice if indexed)

**Exit criteria**

- [ ] Single search entry point  
- [ ] Results deep-link to timeline / tool / worker  
- [ ] Performance acceptable on current sheet size (or indexed cache)  

---

# Step 8 — Dashboard V2 ⭐

**Your item:** #7  
**Docs:** [FEATURES/009_DASHBOARD_V2.md](./FEATURES/009_DASHBOARD_V2.md)  
**Status:** ⬜ After Step 7

**Scope**

- Live KPIs + charts (out now, overdue, repair queue, damage count, sync health if available)

**Exit criteria**

- [ ] Charts render on desktop + mobile  
- [ ] Numbers match parser/server truth (no second math)  
- [ ] Role-aware (Viewer OK; no write)  

---

# Step 9 — Reports ⭐

**Your item:** #6  
**Docs:** [FEATURES/010_REPORTS_AND_ANALYTICS.md](./FEATURES/010_REPORTS_AND_ANALYTICS.md), [027_EXPORT_SYSTEM.md](./FEATURES/027_EXPORT_SYSTEM.md)  
**Status:** ⬜ After Step 8

**Report pack**

- Daily · Weekly · Monthly  
- Lost Tools · Damage Cost  
- Worker History · Tool History  
- Inventory Valuation (needs cost from Receiving)

**Exit criteria**

- [ ] Each report exportable (PDF/CSV as chosen)  
- [ ] Valuation uses Receiving cost fields  
- [ ] Supervisor/Admin only where financial  

---

# Step 10 — Notifications ⭐

**Your item:** #5  
**Docs:** [FEATURES/011_NOTIFICATIONS.md](./FEATURES/011_NOTIFICATIONS.md)  
**Status:** ⬜ After Step 9

**Channels (start simple)**

- In-app badge / list first  
- Optional email later  

**Triggers**

- Overdue tools  
- Damage submitted  
- Unsynced queue (client signal + optional server)  
- System errors (sync nack, GAS lock fail)

**Exit criteria**

- [ ] Role-targeted notifications  
- [ ] No spam loops; mute/ack  
- [ ] Audit optional for admin notification config changes  

---

## Effort map (rough)

| Step | Est. | Depends on |
|------|------|------------|
| 0 Trust | 1–2 weeks | — |
| 1 Roles | 1–2 weeks | 0 |
| 2 Audit | 1 week | 1 |
| 3 QR/Labels | 1 week | 2 |
| 4 Receiving | 2–3 weeks | 3 |
| 5 Repair | 2–3 weeks | 4 |
| 6 Timeline | 1–2 weeks | 5 |
| 7 Search | 1–2 weeks | 6 |
| 8 Dashboard V2 | 1–2 weeks | 7 |
| 9 Reports | 2–3 weeks | 8 + Receiving costs |
| 10 Notifications | 1–2 weeks | 9 |
| **Total** | **~14–24 weeks** | calendar depends on availability |

---

## Hard rules (every step)

1. Do not break **Person → Direction → Tools**.  
2. Do not commit `Code.gs.txt` or secrets.  
3. Update feature doc status **PLANNED → AS-BUILT** when step exits.  
4. Add/adjust test cases before calling a step DONE.  
5. One step in flight; no “while we’re here” module jumping.

---

## Approval to start

Copy to approve the sequence and begin **Step 0 only**:

```text
أوافق على المسار المتسلسل في PRODUCT_V2_SEQUENTIAL_PLAN.md
ابدأ Step 0 (Trust Foundation) فقط
لا تنتقل لـ Roles قبل إغلاق Step 0
```

Or approve the whole roadmap without coding yet:

```text
أعتمد ترتيب الخطوات 0→10 كما في PRODUCT_V2_SEQUENTIAL_PLAN.md
بدون تنفيذ الآن
```

---

## Related

- [NEXT_VERSION_PLAN.md](./NEXT_VERSION_PLAN.md) — trust detail  
- [IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md) — AUD waves  
- [GITHUB_ISSUES.md](./GITHUB_ISSUES.md) — issue backlog  
- [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) — high-level roadmap  

---

*Sequence locked for “كلهم خطوة تلو الأخرى” — 2026-07-16*
