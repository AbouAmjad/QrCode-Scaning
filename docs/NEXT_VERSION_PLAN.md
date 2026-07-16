# Next Version Plan — ToolCustody / Abu Amjad

| Field | Value |
|-------|--------|
| **Based on** | [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md), [IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md), [GITHUB_ISSUES.md](./GITHUB_ISSUES.md) |
| **Date** | 2026-07-16 |
| **Intent** | What to build **first** in the next version — not a feature wishlist |
| **Focus** | Stability · Reliability · Security · Performance · Maintainability |
| **Excluded** | Cosmetic UI polish, i18n cosmetics, emoji/theme labels, icon aesthetics, docs checkbox hygiene |
| **Constraint** | Preserve **Person → Direction → Tools**; no implementation in this document |

---

## Verdict: what to do first

**Implement Phase 1 before anything else.**

Until Phase 1 ships, the system cannot be trusted for:

- Worker “who holds what” answers  
- Login as a real security boundary  
- Offline scans reaching Google Sheets  

Cosmetic and nice-to-have work must wait. New product features should wait.

**Recommended first ship slice (minimum viable next version):** all of Phase 1, then the top of Phase 2 (honest sync + queue durability).

---

## Principles for this version

1. **Truth over features** — wrong holdings and lost scans beat any new screen.  
2. **Server must be honest** — client UX checks are not security.  
3. **Never lie about sync** — Pending means not acknowledged.  
4. **Smallest safe change** — fix the defect; do not rewrite the stack.  
5. **Tests before identity refactors** — protect `parser.js` / `scan.js` before AUD-010-class changes.

---

## Out of scope for this plan (intentionally ignored)

| Item | Why ignored here |
|------|------------------|
| Theme label / sound volume polish | Cosmetic / minor UX |
| UI language mix, emoji in logs | Cosmetic |
| PWA icon artwork completeness | Cosmetic unless install is broken |
| Legacy `ABU-HASAN.html`, TODO.md sync | Hygiene only |
| Accessibility / CSP as primary drivers | Valuable later; not first blockers |
| Full i18n, HTML module extraction as big-bang | Maintainability later, not Phase 1 |

---

# Phase 1 — Critical

**Goal:** Restore correctness and close auth bypass.  
**Outcome:** Worker page works; holdings math is trustworthy; login cannot succeed without server proof; public token fallback removed from the trust path.  
**Est. effort:** ~12–20 engineering hours + deploy/token rotation.

| Order | ID | Improvement | Pillars | Why first |
|------:|----|-------------|---------|-----------|
| 1 | AUD-003 | Fix `parseForWorker` `active` TDZ (consumables crash) | Stability | Hard crash on real ledgers |
| 2 | AUD-004 | Single-pass inventory in `parseForWorker` (no double replay) | Reliability | Wrong custody quantities |
| 3 | AUD-002 | Remove login no-cors “always success” | Security | Auth gate is bypassable |
| 4 | AUD-001 | Remove hardcoded `SESSION_TOKEN` fallback; rotate GAS token | Security | Public client token = open API |

### Phase 1 exit criteria

- [ ] Worker page loads with C/B rows in the sheet.  
- [ ] One OUT ⇒ worker holds qty **1** (not 2).  
- [ ] Failed/unreadable login never stores a session.  
- [ ] Logged-out client cannot call API via bundled constant.  
- [ ] Deployed API token rotated; old public string rejected.  
- [ ] Scanner workflow Person → Direction → Tools unchanged.

### Phase 1 non-goals

- Per-user token redesign (Phase 2/3)  
- Holder identity migration to `P###` (Phase 3)  
- UI redesign  

---

# Phase 2 — Important

**Goal:** Make offline/online sync trustworthy; close high-impact XSS and custody write bugs; start security spine.  
**Outcome:** Queue does not silently drop work; “Synced” means server ack; duplicate tools blocked; obvious XSS sinks closed; passwords and photos hardened.  
**Est. effort:** ~30–50 engineering hours (can ship as 2.A then 2.B).

### 2.A — Reliability of the scanner pipeline (do immediately after Phase 1)

| Order | ID | Improvement | Pillars |
|------:|----|-------------|---------|
| 1 | AUD-012 | Escape Activity Log scan `code` | Security |
| 2 | AUD-013 | Escape dynamic error HTML on pages | Security |
| 3 | AUD-005 | CORS JSON ack before `sent = true` | Reliability · Stability |
| 4 | AUD-006 | Never delete **unsent** queue rows on overflow | Reliability |
| 5 | AUD-009 | Reject duplicate tool in active batch | Reliability · Stability |

**2.A exit criteria**

- [ ] Network kill mid-sync ⇒ items stay Pending and retry.  
- [ ] Queue at cap ⇒ operator blocked; unsent retained.  
- [ ] Malicious QR text cannot execute in Activity Log.  
- [ ] Duplicate tool in batch rejected with clear error.

### 2.B — Security spine (after 2.A)

| Order | ID | Improvement | Pillars |
|------:|----|-------------|---------|
| 1 | AUD-007 | Login via POST body (no password in query) | Security |
| 2 | AUD-008 | Stop Anyone-with-link on damage photos | Security |
| 3 | AUD-014 | Per-login rotatable tokens (replace shared static bearer) | Security · Maintainability |
| 4 | AUD-041 | Officially require https Pages only (drop `file://`) | Security · Maintainability |

**2.B exit criteria**

- [ ] Password never appears in URL/query logs.  
- [ ] New damage photos not world-link-readable by default.  
- [ ] Client never holds the master Script Property secret.  
- [ ] Docs/code stop promising `file://` mode.

### Phase 2 note

AUD-011 (multi-tab queue) belongs at the **end of 2.A** if dual-device scanning is common in the store; otherwise early Phase 3. It is reliability-critical in multi-tab use, not cosmetic.

---

# Phase 3 — Enhancements

**Goal:** Stronger custody model, performance under growth, and engineering safety net.  
**Outcome:** Stable identity; measurable sync; faster Sheets ops; regressions caught in CI; stale PWA risk reduced.  
**Est. effort:** ~40–70 hours across several PRs.

### 3.A — Maintainability & regression safety

| ID | Improvement | Pillars |
|----|-------------|---------|
| AUD-027 | Fixture tests for `CustodyParser` + `ScanEngine` + CI | Maintainability · Stability |
| AUD-022 | Service Worker cache version discipline + update path | Reliability · Maintainability |
| AUD-021 | No hardcoded damage sheet ID in example; require Script Property | Reliability · Security |
| AUD-028 | Verify deploy password hashing + Credentials sheet ACL | Security |

### 3.B — Performance (Sheets / GAS)

| ID | Improvement | Pillars |
|----|-------------|---------|
| AUD-020 | Constrain Column B reads (no unbounded `B1:B`) | Performance · Stability |
| AUD-019 | Stronger append lock / explicit failure on contention | Reliability · Performance |

### 3.C — Custody correctness (product + model)

| ID | Improvement | Pillars |
|----|-------------|---------|
| AUD-010 | Holders keyed by `P###` not display name | Reliability · Maintainability |
| AUD-011 | Multi-tab queue merge or lock (if not done in Phase 2) | Reliability |
| AUD-025 | Explicit consumable IN rule enforced in scanner | Reliability |
| AUD-029 | Damage → custody status / compulsory IN path | Reliability |
| AUD-017 | Confirm `OVERDUE_DAYS` with operations (alert quality) | Reliability |

### 3.D — Dead config cleanup (maintainability only)

| ID | Improvement | Pillars |
|----|-------------|---------|
| AUD-015 | Wire or **remove** unused `autoDirectionMode` / `validationMode` | Maintainability |

*(Do not implement half-working prefs — either real behavior + tests, or delete.)*

### Phase 3 exit criteria

- [ ] CI fails if parser/scan fixtures regress.  
- [ ] Release checklist includes SW cache bump.  
- [ ] Large sheet sync remains within agreed latency budget.  
- [ ] Same display name / rename does not corrupt holdings (if AUD-010 ships).  
- [ ] Consumable + damage rules written AS-BUILT and enforced.

---

# Phase 4 — Future Ideas

**Goal:** Strategic hardening and scale — not required to trust daily store operations after Phases 1–3.  
**Outcome:** Clear backlog for later versions; no pressure to build now.

| ID | Idea | Pillars | Notes |
|----|------|---------|-------|
| AUD-014→023 | Role-based access (server enforced) | Security | Needs solid session tokens first |
| AUD-026 | Server-side custody projection table | Reliability · Performance | Ends client-version “truth” drift |
| AUD-033 | Vendor CDN libs into repo + SW | Reliability | Offline/CDN independence |
| AUD-035 | Content-Security-Policy | Security | After XSS sinks fixed |
| AUD-036 | Sync nack / queue depth metrics | Reliability · Maintainability | Ops visibility |
| AUD-038 | Extract monolithic HTML scripts to modules | Maintainability | Opportunistic, phased |
| AUD-040 | Retention policy for photos + attendance | Security · Maintainability | Legal/ops driven |
| — | Replace Sheets with a real DB / queue | Performance · Scale | Only if sheet limits bite |
| — | SSO / Workspace identity | Security | Enterprise later |
| AUD-030 | Threat model doc for public Pages | Security · Maintainability | Accept architecture; document it |

### Explicitly deferred (not “next version” drivers)

- Full UI redesign  
- New modules unrelated to custody integrity  
- Rewriting working scanner session model  
- Big-bang framework migration (React/etc.) without a reliability trigger  

---

## Suggested release naming

| Release | Contents |
|---------|----------|
| **vNext.1** | Phase 1 only |
| **vNext.2** | Phase 1 + Phase 2.A |
| **vNext.3** | + Phase 2.B |
| **vNext.4** | Phase 3.A + 3.B |
| **vNext.5** | Phase 3.C (identity + domain rules) |

Minimum responsible production trust: **vNext.2**.

---

## Dependency sketch

```text
Phase 1:  003 → 004
          002 → 001

Phase 2A: 012, 013, 009 (parallel)
          005 ∥ 006  (pair; need CORS JSON)

Phase 2B: 001 done → 014 → (later) 023
          007, 008, 041

Phase 3:  027 early (unlocks safe 010)
          020, 019 after honest sync (005)
          010 after 003/004 + 027
```

---

## What to approve first (copy/paste)

```text
Approve NEXT_VERSION Phase 1:
AUD-003, AUD-004, AUD-002, AUD-001
No Phase 2+ until Phase 1 exit criteria pass.
Do not implement cosmetics.
```

Or jump to the reliability slice:

```text
Approve NEXT_VERSION Phase 1 + Phase 2.A:
AUD-003, AUD-004, AUD-002, AUD-001
AUD-012, AUD-013, AUD-005, AUD-006, AUD-009
```

---

## Traceability

| Doc | Role |
|-----|------|
| [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md) | Full findings |
| [IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md) | Wave packaging |
| [GITHUB_ISSUES.md](./GITHUB_ISSUES.md) | Issue-ready backlog |
| **This file** | What the **next version** should prioritize |

---

*Planning only — no source code modified — 2026-07-16*
