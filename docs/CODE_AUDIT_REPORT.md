# Code Audit Report — ToolCustody / Abu Amjad

| Field | Value |
|-------|--------|
| **Mode** | Enterprise Audit (inspect only — no source fixes) |
| **Audit date** | 2026-07-16 |
| **Scope** | Entire repository: HTML, JS, CSS, GAS example, PWA, configs, docs, workflows, APIs, offline sync, auth, parser, scanner, dashboard, worker, tool, damage, consumables |
| **Source of truth** | Live application source + `Code.gs.example` |
| **Live deploy** | `Code.gs.txt` (gitignored) — not audited line-by-line; treat example as intended contract |
| **Auditor role** | Senior Architect / Security Reviewer / Product QA |
| **Method** | Static analysis of every application source file; cross-check against documented workflows and AS-BUILT docs |

---

## Executive Summary

ToolCustody is a production-used QR custody system with a clear core workflow (**Person → Direction → Tools**), a capable client parser, and a working PWA/offline queue. The architecture is appropriate for a store warehouse on Google Sheets.

**However, several Critical and High defects undermine trust in authentication, offline integrity, and worker inventory accuracy.** These must be treated as release blockers before further feature work.

| Severity | Count |
|----------|------:|
| Critical | 4 |
| High | 10 |
| Medium | 16 |
| Low | 12 |
| **Total** | **42** |

### Top risks (business language)

1. **Auth can be bypassed** when CORS fails — operator may appear “logged in” without a verified password.
2. **API token is effectively public** — hardcoded fallback in client JS deployed on GitHub Pages.
3. **Worker page can crash** on consumable ledger rows (`active` used before declaration).
4. **Worker “tools held” can be wrong** because inventory is replayed twice.
5. **Offline queue can silently drop unsent scans** under storage pressure.
6. **Optimistic sync** can mark scans sent without server confirmation.

### What is solid

- Core scan session model (`scan.js`) enforces Person → Direction → Tools with conflict modal.
- Shared chrome (`ui.js` + `app.css`) is consistent across pages.
- Damage photo pipeline (camera + gallery) is thoughtfully built.
- Documentation tree is extensive and mostly AS-BUILT aligned.
- Parser ledger model for dashboard/results is coherent (when not double-applied).

---

## Inventory Audited

### Application source (all reviewed)

| File | Role |
|------|------|
| `index.html` | Scanner UI, queue, sync, Activity Log, camera |
| `login.html` | Login form |
| `dashboard.html` | KPIs, overdue, warnings |
| `results.html` | Daily tools + attendance |
| `worker.html` | Per-worker holdings + log |
| `tool.html` | Tool history |
| `consumables.html` | Consumable issue history |
| `damage.html` | Damage reports + photos |
| `ABU-HASAN.html` | Redirect stub |
| `config.js` | API, auth storage, theme, fetch helpers |
| `scan.js` | ScanEngine session rules |
| `parser.js` | CustodyParser ledger |
| `ui.js` | Top bar, auth gate, toasts |
| `app.css` | Design system |
| `manifest.json` / `sw.js` | PWA |
| `Code.gs.example` | Backend contract |
| `appsscript.json.example` | Apps Script manifest |
| `icons/` | PWA icons |

### Documentation

All `/docs` markdown (architecture, SRS, API, security, features 001–030, workflows, ADRs, tests, roadmap, known issues, prior audit/issue drafts) reviewed for consistency with code. Documentation quality is high; this report focuses on **code/runtime** defects.

### Out of scope for line audit

- `Code.gs.txt` (local secret deploy artifact — gitignored)
- `node_modules` / OS junk if present
- Binary icons (presence verified; pixels not reviewed)

---

## Findings

Severity guide:

| Level | Meaning |
|-------|---------|
| **Critical** | Integrity, auth, or crash in production path — fix immediately |
| **High** | Significant data loss, security exposure, or wrong custody answers |
| **Medium** | Incorrect behavior, UX/security debt, or maintainability risk |
| **Low** | Polish, docs drift, unused config, minor UX |

---

### CRITICAL

---

#### AUD-001 — Hardcoded API token fallback

| Field | Detail |
|-------|--------|
| **Title** | Client falls back to hardcoded `SESSION_TOKEN` when session empty |
| **Description** | `getApiToken()` returns `getToken() \|\| AppConfig.SESSION_TOKEN`. The constant `"abouamjad_secure_session_token"` is shipped in public JS on GitHub Pages. Anyone can call the GAS Web App with that token. |
| **Business Impact** | Unauthorized ledger writes, fake damage reports, data exfiltration via `getData`/`getDashboard`. Store custody records become untrustworthy. |
| **Technical Impact** | AuthZ reduced to security-through-obscurity of the GAS URL + a public string. |
| **Affected Files** | `config.js` (`SESSION_TOKEN`, `getApiToken`); all callers of `apiGet` / `apiPost` / `syncScan` / `loginRequest` |
| **Recommended Solution** | Never fall back to a public constant. Require login-issued token only. Rotate deployed GAS `API_TOKEN`. Prefer short-lived server session tokens. |
| **Estimated Difficulty** | Medium |

---

#### AUD-002 — Login succeeds without password verification (no-cors fallback)

| Field | Detail |
|-------|--------|
| **Title** | `loginRequest` no-cors path returns `ok: true` with static token |
| **Description** | After CORS/`apiGet` failure, code `fetch`es login URL with `mode: "no-cors"`, then returns `{ ok: true, token: AppConfig.SESSION_TOKEN, fallback: true }` without reading any response. Password is never validated in this path. |
| **Business Impact** | Anyone who can open `login.html` may enter the app as “authenticated” when the primary login path fails (common with GAS + browsers). |
| **Technical Impact** | Auth gate (`TCUI.bootPage` / `requireAuth`) becomes a UI lock only, not a security control. |
| **Affected Files** | `config.js` (`loginRequest`); `login.html` |
| **Recommended Solution** | Remove success-on-opaque-response. Use CORS-enabled JSON login only; on failure show error. Never mint client-side tokens. |
| **Estimated Difficulty** | Medium |

---

#### AUD-003 — `parseForWorker` Temporal Dead Zone on consumables

| Field | Detail |
|-------|--------|
| **Title** | `active` referenced before `const active` initialization |
| **Description** | In `parseForWorker`, consumable branch uses `active` (~line 248) before `const active = lastPersonCode === workerCode` (~line 256). Any consumable row in the ledger throws `ReferenceError` and aborts worker page load. |
| **Business Impact** | Worker lookup page broken for real store data that includes C/B consumable scans — supervisors cannot see who holds what. |
| **Technical Impact** | Hard crash; function never returns; UI shows generic error. |
| **Affected Files** | `parser.js` (`parseForWorker`); `worker.html` |
| **Recommended Solution** | Move `const active = …` above the consumable branch (or compute a local flag earlier). Add regression test with C-code in ledger. |
| **Estimated Difficulty** | Easy |

---

#### AUD-004 — Double inventory replay inflates worker holdings

| Field | Detail |
|-------|--------|
| **Title** | `parseForWorker` mutates result of `runInventory` then replays ledger again |
| **Description** | Function starts with `const inv = runInventory(rows)` (full ledger applied), then loops all rows again pushing/splicing the same `holdersList`. Net effect: holdings counted twice (and warnings/log noise). |
| **Business Impact** | Wrong “tools with worker” counts → false accusations, missed returns, bad overtime/overdue decisions. |
| **Technical Impact** | Custody math incorrect; KPIs derived indirectly from this view are unusable. |
| **Affected Files** | `parser.js` (`parseForWorker`); `worker.html` |
| **Recommended Solution** | Build `inv` empty (or clone structure without replaying), then single-pass replay for log + holdings — mirror `runInventory` once only. Add fixture test: 1 OUT ⇒ qty 1. |
| **Estimated Difficulty** | Medium |

---

### HIGH

---

#### AUD-005 — Optimistic sync marks scans sent without confirmation

| Field | Detail |
|-------|--------|
| **Title** | `syncScan` uses `no-cors` and always reports success |
| **Description** | After opaque `fetch`, client assumes write succeeded (`{ ok: true }`) and sets `scans[i].sent = true`. |
| **Business Impact** | Scans disappear from retry queue but never reach Sheets — silent custody gaps. |
| **Technical Impact** | No retry; no server ack; false “Synced” UI. |
| **Affected Files** | `config.js` (`syncScan`); `index.html` (`processQueue`) |
| **Recommended Solution** | CORS JSON ack `{ok:true}`; only then mark sent. Keep pending on network/HTTP failure. |
| **Estimated Difficulty** | Medium |

---

#### AUD-006 — Offline queue deletes unsent scans on overflow

| Field | Detail |
|-------|--------|
| **Title** | Queue trim removes oldest **unsent** entries |
| **Description** | When `scans.length > 200`, loop splices entries with `!scans[i].sent`. Unsynced work is discarded to free space. |
| **Business Impact** | Lost OUT/IN events under heavy offline use — tools appear in store while physically out. |
| **Technical Impact** | Durability violation; conflicts with offline-first promise. |
| **Affected Files** | `index.html` (`saveScans`) |
| **Recommended Solution** | Never delete unsent. Cap by refusing new scans with operator message, or spill to IndexedDB. Prefer delete **sent** first only. |
| **Estimated Difficulty** | Medium |

---

#### AUD-007 — Login password sent in URL query string

| Field | Detail |
|-------|--------|
| **Title** | Credentials travel as GET query parameters |
| **Description** | `loginRequest` builds URL with `user` and `pass` query params. |
| **Business Impact** | Password leakage via proxies, browser history, GAS/exec logs, referrer headers. |
| **Technical Impact** | Violates basic credential handling; complicates compliance. |
| **Affected Files** | `config.js`; `Code.gs.example` (`action=login`) |
| **Recommended Solution** | POST JSON body over HTTPS only; never log body; rate-limit failures. |
| **Estimated Difficulty** | Medium |

---

#### AUD-008 — Damage photos shared as Anyone with link

| Field | Detail |
|-------|--------|
| **Title** | Drive files set `ANYONE_WITH_LINK` view |
| **Description** | After upload, `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, …)`. |
| **Business Impact** | Leaked URLs expose incident photos (site, plates, faces) without auth. |
| **Technical Impact** | No per-user ACL; URL becomes capability bearer. |
| **Affected Files** | `Code.gs.example` (`saveDamagePhoto_`) |
| **Recommended Solution** | Domain-restricted sharing or authenticated image proxy; avoid public links. |
| **Estimated Difficulty** | Medium |

---

#### AUD-009 — Duplicate tool scans allowed in same batch

| Field | Detail |
|-------|--------|
| **Title** | `ScanEngine` does not reject duplicate tool codes in batch |
| **Description** | `toolsInBatch.push(code)` with no `includes` check; backend appends another OUT/IN. |
| **Business Impact** | Double custody lines; confusing returns; inflated holder stacks. |
| **Technical Impact** | Ledger ambiguity; parser warnings cascade. |
| **Affected Files** | `scan.js`; `index.html` |
| **Recommended Solution** | Reject duplicate tool in active batch (strict); optional explicit qty mode later. |
| **Estimated Difficulty** | Easy |

---

#### AUD-010 — Holders keyed by display name not person code

| Field | Detail |
|-------|--------|
| **Title** | `holdersList` stores person **names** |
| **Description** | Parser pushes `lastPerson` (description). Two workers with same name collide; rename breaks IN matching. |
| **Business Impact** | Wrong holder attribution; failed returns; unfair blame. |
| **Technical Impact** | Identity not stable; joins fragile. |
| **Affected Files** | `parser.js` (all inventory passes); pages rendering holders |
| **Recommended Solution** | Store `P###` codes; display names via lookup map. Migration note for historical sheets. |
| **Estimated Difficulty** | Hard |

---

#### AUD-011 — Multi-tab race on scan queue

| Field | Detail |
|-------|--------|
| **Title** | No cross-tab coordination for `toolCustodyQueue` |
| **Description** | Two scanner tabs can overwrite each other’s `localStorage` queue. |
| **Business Impact** | Lost scans during shift handoff / dual devices. |
| **Technical Impact** | Last-write-wins; no merge. |
| **Affected Files** | `index.html` |
| **Recommended Solution** | `storage` event merge, `BroadcastChannel`, or single-tab lock (`navigator.locks`). |
| **Estimated Difficulty** | Medium |

---

#### AUD-012 — Activity Log XSS via raw QR payload in HTML

| Field | Detail |
|-------|--------|
| **Title** | Scan `code` interpolated into `innerHTML` without escape |
| **Description** | `addLog` escapes `description` but not `code`. Malicious QR could inject HTML/JS. |
| **Business Impact** | Session token theft from `localStorage`; defacement; phishing inside trusted app. |
| **Technical Impact** | DOM XSS on scanner page. |
| **Affected Files** | `index.html` (`addLog`) |
| **Recommended Solution** | Use `escHtml(code)` or `textContent`-only DOM APIs. |
| **Estimated Difficulty** | Easy |

---

#### AUD-013 — Error messages injected as HTML

| Field | Detail |
|-------|--------|
| **Title** | `e.message` embedded in `innerHTML` on results (and similar patterns) |
| **Description** | Fetch/parser errors rendered into HTML strings without escaping. |
| **Business Impact** | Low probability XSS if error text ever reflects remote content. |
| **Technical Impact** | Unsafe HTML sink. |
| **Affected Files** | `results.html`; review `dashboard.html`, `worker.html`, `tool.html`, `consumables.html`, `damage.html` for same pattern |
| **Recommended Solution** | `textContent` or `escHtml` for all dynamic error/detail strings. |
| **Estimated Difficulty** | Easy |

---

#### AUD-014 — Shared static GAS bearer token

| Field | Detail |
|-------|--------|
| **Title** | Single long-lived `API_TOKEN` for all clients |
| **Description** | Backend accepts one shared secret; no per-user API credentials, expiry, or revocation list. |
| **Business Impact** | One leak ⇒ full API access until manual Script Property rotation + redeploy. |
| **Technical Impact** | No session binding; no least privilege. |
| **Affected Files** | `Code.gs.example`; `config.js` |
| **Recommended Solution** | Per-login opaque tokens with expiry stored in Properties/Cache; revoke on password change. |
| **Estimated Difficulty** | Hard |

---

### MEDIUM

---

#### AUD-015 — Dead settings: auto direction & validation mode

| Field | Detail |
|-------|--------|
| **Title** | `autoDirectionMode` / `validationMode` stored but unused by ScanEngine |
| **Description** | Preferences persist in `localStorage` but `scan.js` ignores them; UI may imply behavior that never runs. |
| **Business Impact** | Operator confusion; false confidence in “lenient” mode. |
| **Technical Impact** | Dead config; drift from FEATURE docs. |
| **Affected Files** | `config.js`; `index.html` (prefs UI if present); `scan.js` |
| **Recommended Solution** | Wire into ScanEngine or remove from UI until implemented. |
| **Estimated Difficulty** | Medium |

---

#### AUD-016 — `soundVolume` preference unused

| Field | Detail |
|-------|--------|
| **Title** | Volume setting not applied to Web Audio beeps |
| **Description** | Oscillator gain paths ignore `AppConfig.prefs.soundVolume`. |
| **Business Impact** | Minor UX; noisy warehouse can’t quiet scanner. |
| **Technical Impact** | Dead preference. |
| **Affected Files** | `config.js`; `index.html` |
| **Recommended Solution** | Multiply gain by preference or remove control. |
| **Estimated Difficulty** | Easy |

---

#### AUD-017 — OVERDUE_DAYS = 1 may be too aggressive

| Field | Detail |
|-------|--------|
| **Title** | Tools overdue after one calendar day |
| **Description** | Config default `OVERDUE_DAYS: 1` flags overnight jobs as overdue. |
| **Business Impact** | Alert fatigue; real overdue items ignored. |
| **Technical Impact** | KPI noise on dashboard. |
| **Affected Files** | `config.js`; `parser.js` / dashboard consumers |
| **Recommended Solution** | Confirm with operations; make Script Property / admin setting. |
| **Estimated Difficulty** | Easy |

---

#### AUD-018 — Theme control label bug risk

| Field | Detail |
|-------|--------|
| **Title** | `syncThemeControls` may set `textContent` to full phrase incorrectly |
| **Description** | Label update logic can assign a long string where a short Moon/Sun label is expected depending on element targeting. |
| **Business Impact** | Confusing theme toggle. |
| **Technical Impact** | UI defect only. |
| **Affected Files** | `config.js` (`syncThemeControls`); `ui.js` theme button |
| **Recommended Solution** | Set explicit short labels per control id. |
| **Estimated Difficulty** | Easy |

---

#### AUD-019 — Sheet append race (partial mitigation)

| Field | Detail |
|-------|--------|
| **Title** | Lock wait 5s then append — concurrent writers can still conflict |
| **Description** | `LockService` helps but timeout/failure paths and multi-deploy races remain. |
| **Business Impact** | Rare duplicate/missing rows under burst scanning. |
| **Technical Impact** | Non-serializable writes at scale. |
| **Affected Files** | `Code.gs.example` |
| **Recommended Solution** | Longer lock, queue writes, or switch to atomic append API patterns; monitor failures. |
| **Estimated Difficulty** | Medium |

---

#### AUD-020 — Column B scan uses unbounded `B1:B`

| Field | Detail |
|-------|--------|
| **Title** | Duplicate-check / scan reads entire column B |
| **Description** | `getRange("B1:B")` grows with sheet size → latency and memory. |
| **Business Impact** | Slow scans as history grows; timeouts under load. |
| **Technical Impact** | O(n) per request. |
| **Affected Files** | `Code.gs.example` |
| **Recommended Solution** | Constrain to used range; maintain hash index sheet; or append-only without full scan when safe. |
| **Estimated Difficulty** | Medium |

---

#### AUD-021 — Damage sheet ID default embedded in example

| Field | Detail |
|-------|--------|
| **Title** | `DEFAULT_DAMAGE_SHEET_ID` hardcoded in `Code.gs.example` |
| **Description** | Example contains a real-looking spreadsheet id. Risk of copy-paste to wrong env or info disclosure. |
| **Business Impact** | Misconfigured deploys write to wrong spreadsheet. |
| **Technical Impact** | Environment coupling. |
| **Affected Files** | `Code.gs.example` |
| **Recommended Solution** | Empty default; require Script Property; document setup only. |
| **Estimated Difficulty** | Easy |

---

#### AUD-022 — Service Worker cache may serve stale app JS

| Field | Detail |
|-------|--------|
| **Title** | SW caches shell; updates depend on version bump discipline |
| **Description** | If `CACHE` name not bumped on release, users keep old `scan.js`/`parser.js`. |
| **Business Impact** | “Fixed” bugs persist in field devices. |
| **Technical Impact** | Classic SW staleness. |
| **Affected Files** | `sw.js`; `manifest.json` |
| **Recommended Solution** | Versioned cache; `skipWaiting` + reload prompt; release checklist. |
| **Estimated Difficulty** | Medium |

---

#### AUD-023 — No role-based access control

| Field | Detail |
|-------|--------|
| **Title** | Any logged-in user can open all modules |
| **Description** | Login is binary; scanner, damage, dashboard equally available. |
| **Business Impact** | Helpers may see wages/attendance/damage beyond need-to-know. |
| **Technical Impact** | No server-side role checks on actions. |
| **Affected Files** | `ui.js`; `login.html`; `Code.gs.example` |
| **Recommended Solution** | Roles in Credentials + server enforce per action; UI hide as UX only. |
| **Estimated Difficulty** | Hard |

---

#### AUD-024 — PWA icons incomplete vs manifest

| Field | Detail |
|-------|--------|
| **Title** | Manifest may reference sizes not fully provided |
| **Description** | Install experience degraded on some Android launchers. |
| **Business Impact** | Unprofessional install; trust friction. |
| **Technical Impact** | Manifest validation warnings. |
| **Affected Files** | `manifest.json`; `icons/` |
| **Recommended Solution** | Generate full maskable set matching manifest entries. |
| **Estimated Difficulty** | Easy |

---

#### AUD-025 — Consumable IN semantics ambiguous

| Field | Detail |
|-------|--------|
| **Title** | Consumables allow IN logging while stock model is issue-oriented |
| **Description** | Engine allows IN for C/B; parser mostly tracks OUT issues. Business rule unclear. |
| **Business Impact** | Misleading “return” of consumables that aren’t returned. |
| **Technical Impact** | Inconsistent domain model. |
| **Affected Files** | `scan.js`; `parser.js`; `consumables.html` |
| **Recommended Solution** | Product decision: block IN for consumables or define restock workflow explicitly. |
| **Estimated Difficulty** | Medium |

---

#### AUD-026 — Dashboard and results trust client parse only

| Field | Detail |
|-------|--------|
| **Title** | No server-side custody projection |
| **Description** | All holder/overdue math is browser-side from raw rows. |
| **Business Impact** | Different clients/versions ⇒ different “truth.” |
| **Technical Impact** | Cannot enforce invariants server-side. |
| **Affected Files** | `parser.js`; pages; GAS |
| **Recommended Solution** | Long-term: server projection table; short-term: single parser version + tests. |
| **Estimated Difficulty** | Hard |

---

#### AUD-027 — No automated tests in CI

| Field | Detail |
|-------|--------|
| **Title** | Parser/scan rules lack executable test suite in repo |
| **Description** | Docs describe test cases; no `npm test` / CI running fixtures. |
| **Business Impact** | Regressions ship unnoticed (as AUD-003/004 show). |
| **Technical Impact** | No safety net for ledger changes. |
| **Affected Files** | Repo root; `docs/testing/*` |
| **Recommended Solution** | Add Node fixture tests for `CustodyParser` + ScanEngine; GitHub Action. |
| **Estimated Difficulty** | Medium |

---

#### AUD-028 — Credentials sheet is single point of failure

| Field | Detail |
|-------|--------|
| **Title** | Passwords (even if hashed poorly) live in Google Sheet |
| **Description** | Sheet-based users; export/share risk. |
| **Business Impact** | Account takeover if sheet leaked. |
| **Technical Impact** | Depends on hash quality in deployed `Code.gs.txt` (verify deploy!). |
| **Affected Files** | `Code.gs.example`; Google Sheet “Credentials” |
| **Recommended Solution** | Verify deploy uses salted hashes; restrict sheet ACL; consider Workspace SSO later. |
| **Estimated Difficulty** | Medium |

---

#### AUD-029 — Damage form vs custody ledger decoupling

| Field | Detail |
|-------|--------|
| **Title** | Damage reports do not adjust tool holder state |
| **Description** | By design damage is separate; lost/damaged tools may still show as held. |
| **Business Impact** | Inventory lies after write-off unless manual IN. |
| **Technical Impact** | Two sources of truth. |
| **Affected Files** | `damage.html`; `parser.js`; GAS damage sheet |
| **Recommended Solution** | Workflow: damage → prompt compulsory IN / status flag in main ledger. |
| **Estimated Difficulty** | Medium |

---

#### AUD-030 — GitHub Pages + public repo expose full client

| Field | Detail |
|-------|--------|
| **Title** | Entire client logic and endpoints visible |
| **Description** | Expected for static hosting; increases need for server-side controls. |
| **Business Impact** | Attackers study validation and craft API calls. |
| **Technical Impact** | Client checks are UX only. |
| **Affected Files** | All frontend; repo |
| **Recommended Solution** | Assume hostile client; strengthen GAS validation (AUD-001/002/014). |
| **Estimated Difficulty** | N/A (architectural acceptance) |

---

### LOW

---

#### AUD-031 — `ABU-HASAN.html` legacy redirect

| Field | Detail |
|-------|--------|
| **Title** | Extra entry HTML for rename compatibility |
| **Description** | Harmless redirect; slightly confusing for new operators. |
| **Business Impact** | Negligible. |
| **Technical Impact** | Maintenance noise. |
| **Affected Files** | `ABU-HASAN.html` |
| **Recommended Solution** | Keep with comment or remove after analytics show zero hits. |
| **Estimated Difficulty** | Easy |

---

#### AUD-032 — Mixed Arabic/English operator strings

| Field | Detail |
|-------|--------|
| **Title** | UI language inconsistency |
| **Description** | Some strings Arabic, most English. |
| **Business Impact** | Training friction. |
| **Technical Impact** | i18n debt. |
| **Affected Files** | Multiple HTML/JS |
| **Recommended Solution** | Pick primary locale; extract string table. |
| **Estimated Difficulty** | Medium |

---

#### AUD-033 — CDN dependency (Bootstrap / html5-qrcode)

| Field | Detail |
|-------|--------|
| **Title** | Runtime depends on third-party CDNs |
| **Description** | Offline install shell may still need CDN for first camera library load depending on cache. |
| **Business Impact** | Scanner broken if CDN blocked. |
| **Technical Impact** | Availability risk. |
| **Affected Files** | `index.html`; other HTML heads |
| **Recommended Solution** | Vendor minified assets into repo; cache via SW. |
| **Estimated Difficulty** | Medium |

---

#### AUD-034 — Documentation status vs root TODO drift

| Field | Detail |
|-------|--------|
| **Title** | Root `TODO.md` may lag AS-BUILT features (e.g. PWA) |
| **Description** | Historical checkboxes not updated. |
| **Business Impact** | Planning confusion. |
| **Technical Impact** | None runtime. |
| **Affected Files** | `TODO.md`; `docs/*` |
| **Recommended Solution** | Sync TODO with ROADMAP / audit. |
| **Estimated Difficulty** | Easy |

---

#### AUD-035 — No Content-Security-Policy

| Field | Detail |
|-------|--------|
| **Title** | Pages ship without CSP headers/meta |
| **Description** | XSS impact radius larger (see AUD-012/013). |
| **Business Impact** | Defense-in-depth missing. |
| **Technical Impact** | Any sink is higher severity. |
| **Affected Files** | All HTML; hosting config |
| **Recommended Solution** | Strict CSP on GitHub Pages via meta where possible; reduce inline scripts long-term. |
| **Estimated Difficulty** | Hard |

---

#### AUD-036 — Limited structured logging / metrics

| Field | Detail |
|-------|--------|
| **Title** | No product analytics for sync failure rates |
| **Description** | Cannot measure silent sync loss. |
| **Business Impact** | Issues discovered only when tools go missing. |
| **Technical Impact** | Blind ops. |
| **Affected Files** | Frontend; GAS |
| **Recommended Solution** | Log sync nack counts; simple ops dashboard. |
| **Estimated Difficulty** | Medium |

---

#### AUD-037 — Accessibility gaps

| Field | Detail |
|-------|--------|
| **Title** | Scanner/conflict UI partially inaccessible |
| **Description** | Focus traps, ARIA, contrast not systematically audited. |
| **Business Impact** | Harder for some staff; possible compliance gap. |
| **Technical Impact** | A11y debt. |
| **Affected Files** | `index.html`; `app.css`; modals |
| **Recommended Solution** | Keyboard path for conflict modal; labels on controls. |
| **Estimated Difficulty** | Medium |

---

#### AUD-038 — Large monolithic HTML inline scripts

| Field | Detail |
|-------|--------|
| **Title** | Page logic embedded in large `<script>` blocks |
| **Description** | Harder to test and review than modules. |
| **Business Impact** | Slower safe change velocity. |
| **Technical Impact** | Maintainability. |
| **Affected Files** | `index.html`, `damage.html`, etc. |
| **Recommended Solution** | Gradual extract to JS modules (no behavior change). |
| **Estimated Difficulty** | Hard |

---

#### AUD-039 — Parser warning strings use emoji

| Field | Detail |
|-------|--------|
| **Title** | Log text includes emoji prefixes |
| **Description** | Inconsistent with some UI polish guidelines; minor. |
| **Business Impact** | None. |
| **Technical Impact** | Cosmetic. |
| **Affected Files** | `parser.js` |
| **Recommended Solution** | Optional plain-text mode. |
| **Estimated Difficulty** | Easy |

---

#### AUD-040 — No explicit privacy policy / data retention

| Field | Detail |
|-------|--------|
| **Title** | Photos and attendance retained indefinitely in Sheets/Drive |
| **Description** | No documented retention/deletion job. |
| **Business Impact** | Privacy/legal exposure over time. |
| **Technical Impact** | Unbounded storage growth. |
| **Affected Files** | Docs; GAS; Drive folder |
| **Recommended Solution** | Retention policy + periodic cleanup. |
| **Estimated Difficulty** | Medium |

---

#### AUD-041 — `file://` support complicates security

| Field | Detail |
|-------|--------|
| **Title** | Design comments optimize for `file://` + no-cors |
| **Description** | Legacy local-file usage drives unsafe fetch modes. |
| **Business Impact** | Keeps Critical auth/sync issues alive. |
| **Technical Impact** | Forces opaque responses. |
| **Affected Files** | `config.js`; comments in sync/login |
| **Recommended Solution** | Officially require https Pages only; drop file:// support. |
| **Estimated Difficulty** | Easy (decision) / Medium (code cleanup) |

---

#### AUD-042 — Upload helper scripts in repo root

| Field | Detail |
|-------|--------|
| **Title** | Multiple `.bat`/`.ps1` upload helpers |
| **Description** | Convenience scripts; risk if they embed tokens (review before sharing). |
| **Business Impact** | Low if clean; high if secrets added later. |
| **Technical Impact** | Clutter. |
| **Affected Files** | `UPLOAD_NOW.bat`, `push_to_github.bat`, etc. |
| **Recommended Solution** | Ensure no secrets; document official git workflow only. |
| **Estimated Difficulty** | Easy |

---

## Module Scorecard

| Module | Health | Notes |
|--------|--------|-------|
| Auth / session | Poor | AUD-001, 002, 007, 014 |
| Offline sync | Poor | AUD-005, 006, 011 |
| `parser.js` | Poor–Fair | AUD-003, 004, 010; dashboard path OK |
| `scan.js` | Fair–Good | Solid session; missing duplicate tool (009) |
| Scanner UI | Fair | XSS 012; queue 006 |
| Dashboard | Fair | Depends on parser; overdue policy 017 |
| Worker | Poor | Hard-broken by 003/004 |
| Tool history | Fair | Holder identity 010 |
| Consumables | Fair | Semantics 025; worker crash 003 |
| Damage | Fair | Public photos 008; ledger decouple 029 |
| PWA | Fair | SW versioning 022; icons 024 |
| GAS backend | Fair | Lock/column scan; token model |
| CSS / UI chrome | Good | Consistent TC design |
| Documentation | Good | Extensive; keep AS-BUILT honest |

---

## Workflow Audit (summary)

| Workflow | Result |
|----------|--------|
| Person → Direction → Tools | **Enforced** in `scan.js` |
| Direction conflict modal | **Present** |
| Mid-batch direction change | **Blocked** |
| Duplicate person/direction/tool rules | Person/dir OK; **tool duplicate missing** |
| Offline queue | **Present but unsafe** under overflow + optimistic sync |
| Login gate | **UI-only when fallback triggers** |
| Damage photo | **Works**; sharing too open |
| Dashboard overdue | **Works**; threshold may be wrong |
| Worker view | **Broken/incorrect** with consumables + double replay |

---

## API Audit (summary)

| Action | Risk |
|--------|------|
| `login` | GET password; no-cors bypass |
| `sync` / scan append | Optimistic client; token in query |
| `getData` / dashboard feeds | Readable with leaked token |
| `getDamage` / photo upload | Photo public link |
| Token check | Shared static secret |

---

## Recommended Immediate Actions (no code in this phase)

1. Treat AUD-003 and AUD-004 as emergency parser fixes (worker trust).
2. Disable or remove login no-cors success (AUD-002).
3. Remove hardcoded token fallback; rotate GAS token (AUD-001).
4. Stop deleting unsent queue rows; require sync ack (AUD-005/006).
5. Escape Activity Log codes (AUD-012).

See **[IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md)** for sequenced waves.

---

## Sign-off

| Item | Status |
|------|--------|
| Source code modified in this audit | **No** |
| Fixes applied | **No** |
| Reports generated | `CODE_AUDIT_REPORT.md`, `IMPLEMENTATION_PRIORITY.md` |
| Next step | Product owner approves Wave 0 / Wave 1 implementation package |

---

*End of Enterprise Code Audit Report — 2026-07-16*
