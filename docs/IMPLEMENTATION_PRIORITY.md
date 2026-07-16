# Implementation Priority — ToolCustody / Abu Amjad

| Field | Value |
|-------|--------|
| **Based on** | [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md) (2026-07-16) |
| **Mode** | Planning only — no source fixes until explicitly approved |
| **Principle** | Fix integrity & auth before features; preserve **Person → Direction → Tools** |
| **Constraint** | No casual rewrites; smallest safe change per finding |

---

## How to use this document

1. Approve a **Wave** (or a named package below).
2. Implement only that wave’s AUD items.
3. Re-test using `docs/testing/` cases + manual store scenarios.
4. Do not start the next wave until the current wave’s exit criteria pass.

Difficulty key: **E** Easy · **M** Medium · **H** Hard

---

## Priority waves

```text
P0  Wave 0 — Emergency correctness (worker + auth bypass)
P1  Wave 1 — Sync integrity + XSS quick wins
P2  Wave 2 — Security hardening (token, password transport, photos)
P3  Wave 3 — Custody identity + product rules
P4  Wave 4 — Platform / ops / quality
```

---

## Wave 0 — Emergency correctness (do first)

**Goal:** Worker page must not crash; holdings must not double; login must not succeed without server proof.

| Order | ID | Title | Sev | Diff | Depends |
|------:|----|-------|-----|------|---------|
| 1 | AUD-003 | Fix `active` TDZ in `parseForWorker` | Critical | E | — |
| 2 | AUD-004 | Remove double ledger replay in `parseForWorker` | Critical | M | AUD-003 same function |
| 3 | AUD-002 | Remove login no-cors “success” fallback | Critical | M | — |

**Exit criteria**

- [ ] Worker page loads with ledger containing C/B consumable rows.
- [ ] Fixture: one OUT to worker ⇒ `toolsHeld.qty === 1` (not 2).
- [ ] Failed CORS/login cannot set `tc_token` / cannot pass `requireAuth`.
- [ ] Person → Direction → Tools unchanged on scanner.

**Suggested package name:** `fix/wave0-worker-auth`

---

## Wave 1 — Offline sync integrity + XSS

**Goal:** Queue never lies; Activity Log cannot execute QR payloads.

| Order | ID | Title | Sev | Diff | Depends |
|------:|----|-------|-----|------|---------|
| 1 | AUD-012 | Escape scan `code` in Activity Log | High | E | — |
| 2 | AUD-013 | Escape `e.message` (and similar) in page HTML | High | E | — |
| 3 | AUD-005 | Require CORS JSON ack before `sent = true` | High | M | GAS CORS |
| 4 | AUD-006 | Never delete unsent queue rows on overflow | High | M | — |
| 5 | AUD-009 | Reject duplicate tool in active batch | High | E | — |

**Exit criteria**

- [ ] QR payload with `<` / script text appears as text only in log.
- [ ] Kill network mid-sync ⇒ items remain Pending and retry.
- [ ] At queue cap, operator sees block message; unsent retained.
- [ ] Second scan of same tool in batch → blocked with clear error.

**Suggested package name:** `fix/wave1-sync-xss`

---

## Wave 2 — Security hardening

**Goal:** Close public-token and credential-in-URL class issues.

| Order | ID | Title | Sev | Diff | Depends |
|------:|----|-------|-----|------|---------|
| 1 | AUD-001 | Remove hardcoded `SESSION_TOKEN` fallback | Critical | M | AUD-002 done |
| 2 | AUD-014 | Per-login / rotatable server tokens (design + implement) | High | H | AUD-001 |
| 3 | AUD-007 | Login via POST body (no password in query) | High | M | GAS + client |
| 4 | AUD-008 | Stop `ANYONE_WITH_LINK` on damage photos | High | M | Drive policy |
| 5 | AUD-041 | Drop official `file://` support (forces honest CORS) | Low | E/M | Product decision |

**Exit criteria**

- [ ] `getApiToken()` returns empty/throws when logged out — no public constant used for API.
- [ ] Deployed GAS `API_TOKEN` rotated; old token rejected.
- [ ] Password never appears in URL bar or server query logs.
- [ ] Damage image URLs not world-readable by default.

**Suggested package name:** `security/wave2-authz-photos`

**Note:** Rotate secrets in Google Apps Script Properties — do not commit `Code.gs.txt`.

---

## Wave 3 — Custody model correctness

**Goal:** Stable identity and clear consumable/damage rules.

| Order | ID | Title | Sev | Diff | Depends |
|------:|----|-------|-----|------|---------|
| 1 | AUD-010 | Holders keyed by `P###` not display name | High | H | Parser fixtures |
| 2 | AUD-025 | Product rule: consumable IN allow/block | Medium | M | Owner decision |
| 3 | AUD-029 | Damage ↔ ledger workflow (IN / status) | Medium | M | Owner decision |
| 4 | AUD-017 | Confirm `OVERDUE_DAYS` with operations | Medium | E | Owner decision |
| 5 | AUD-011 | Multi-tab queue merge or lock | High | M | Wave 1 queue stable |

**Exit criteria**

- [ ] Two workers with same Arabic/English name do not share holdings.
- [ ] Rename worker description does not break IN matching for open OUTs.
- [ ] Written rule for consumables + damage reflected in scanner + docs AS-BUILT.

**Suggested package name:** `fix/wave3-identity-rules`

---

## Wave 4 — Platform, roles, quality

**Goal:** Reduce operational and regression risk.

| Order | ID | Title | Sev | Diff | Depends |
|------:|----|-------|-----|------|---------|
| 1 | AUD-027 | Automated parser + ScanEngine fixture tests + CI | Medium | M | — |
| 2 | AUD-022 | SW cache version discipline + update UX | Medium | M | — |
| 3 | AUD-019 / AUD-020 | GAS lock + column B performance | Medium | M | Sheet size metrics |
| 4 | AUD-023 | Role-based access (server enforced) | Medium | H | Wave 2 tokens |
| 5 | AUD-015 / AUD-016 / AUD-018 | Dead prefs / theme label cleanup | Medium/Low | E | — |
| 6 | AUD-033 | Vendor CDN assets into repo + SW | Low | M | — |
| 7 | AUD-024 / AUD-034 / AUD-031 | Icons, TODO sync, legacy HTML | Low | E | — |
| 8 | AUD-035 / AUD-037 / AUD-040 | CSP, a11y, retention policy | Low | M/H | — |

**Exit criteria**

- [ ] CI fails on parser fixture regression.
- [ ] Release checklist includes SW cache bump.
- [ ] Roles (if approved) enforced in GAS, not only hidden nav.

**Suggested package name:** `chore/wave4-platform`

---

## Deferred / accept as architecture

| ID | Title | Disposition |
|----|-------|-------------|
| AUD-026 | Client-only custody projection | Accept short-term; revisit if multi-client drift hurts |
| AUD-030 | Public GitHub Pages client | Accept; compensate with Wave 2 server controls |
| AUD-038 | Monolithic HTML scripts | Opportunistic refactor only |
| AUD-039 | Emoji in parser strings | Optional polish |
| AUD-042 | Upload helper scripts | Hygiene review only |

---

## Recommended first approval package

If approving **one** implementation batch after this audit:

### Package A — “Trust restore” (recommended)

Includes:

- Wave 0: AUD-003, AUD-004, AUD-002  
- Wave 1 (partial): AUD-012, AUD-005, AUD-006, AUD-009  

**Why:** Restores worker truth, closes auth bypass, stops silent scan loss, blocks duplicate tools, closes obvious XSS — without boiling the ocean on token redesign.

### Package B — “Security spine”

Wave 2 full (after Package A).

### Package C — “Identity”

Wave 3 (after Package A; ideally after parser tests from Wave 4 item AUD-027 started).

---

## Dependency graph (simplified)

```text
AUD-003 ──► AUD-004
AUD-002 ──► AUD-001 ──► AUD-014 ──► AUD-023
AUD-005 ◄── GAS CORS (same as honest login)
AUD-006 independent but pair with AUD-005
AUD-010 needs fixtures (AUD-027 helps)
AUD-011 after queue semantics stable (AUD-006)
```

---

## Explicit non-goals (until asked)

- New features / modules not in audit waves  
- Rewriting Sheets backend to another database  
- Changing Person → Direction → Tools order  
- Committing secrets or `Code.gs.txt`  
- “While we’re here” refactors outside the approved AUD list  

---

## Approval checklist (for product owner)

Copy into chat when ready:

```text
Approve Package A (Trust restore):
- AUD-003, AUD-004, AUD-002
- AUD-012, AUD-005, AUD-006, AUD-009
Do not implement other waves yet.
```

Or:

```text
Approve Wave 0 only.
```

---

## Traceability

| Deliverable | Path |
|-------------|------|
| Full findings | [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md) |
| Optional GitHub issue drafts | [GITHUB_ISSUES.md](./GITHUB_ISSUES.md) (if present) |
| Known issues (product) | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| Test cases | [testing/TEST_CASES.md](./testing/TEST_CASES.md) |

---

*End of Implementation Priority — 2026-07-16*
