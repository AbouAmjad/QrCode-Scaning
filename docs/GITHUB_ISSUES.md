# GitHub Issues Backlog — ToolCustody / Abu Amjad

| Field | Value |
|-------|--------|
| **Source** | [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md) · [IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md) |
| **Generated** | 2026-07-16 |
| **Purpose** | Enterprise backlog ready to paste into GitHub Issues |
| **Sort order** | Highest priority → lowest (Critical → High → Medium → Low; within severity: Wave 0→4 then residual) |
| **Code changes** | None in this document |

---

## How to use

1. Create GitHub issues in the order listed (or import by wave).
2. Prefix titles with `[AUD-XXX]` for traceability.
3. Labels suggested: `priority:critical|high|medium|low`, `wave:0|1|2|3|4`, `area:parser|auth|sync|security|ui|gas|docs`.
4. Do not implement until a wave/package is explicitly approved.

**Difficulty:** Easy · Medium · Hard  
**Time:** Engineering estimate for a developer familiar with this repo (hours = wall-clock coding + focused test; excludes deploy approval delays).

---

## Summary

| Priority | Count | Est. total effort (sum of issue estimates) |
|----------|------:|--------------------------------------------|
| Critical | 4 | ~14–20 h |
| High | 10 | ~40–56 h |
| Medium | 16 | ~55–80 h |
| Low | 12 | ~30–50 h |
| **Total** | **42** | **~140–200 h** |

---

# CRITICAL

---

## Issue 1 — [AUD-003] Fix parseForWorker Temporal Dead Zone on consumables

| Field | Content |
|-------|---------|
| **Title** | [AUD-003] Fix `active` TDZ crash in `parseForWorker` (consumables) |
| **Description** | In `parser.js` `parseForWorker`, the consumable branch references `active` before `const active` is declared. Any ledger containing C/B consumable rows throws `ReferenceError` and aborts the worker page. This is a production crash path for real store data. |
| **Priority** | Critical |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `parser.js`, `worker.html` (verify), optional fixture under future tests |
| **Acceptance Criteria** | • Worker page loads when ledger includes consumable OUT/IN rows.<br>• No `ReferenceError` in console for `active`.<br>• Consumable log lines for the selected worker still appear when applicable.<br>• Person → Direction → Tools scanner behavior unchanged. |
| **Dependencies** | None |

---

## Issue 2 — [AUD-004] Remove double inventory replay in parseForWorker

| Field | Content |
|-------|---------|
| **Title** | [AUD-004] Stop double ledger replay that inflates worker holdings |
| **Description** | `parseForWorker` calls `runInventory(rows)` then replays the same rows mutating `holdersList` again. Worker “tools held” quantities are roughly doubled, producing false custody answers and bad operational decisions. |
| **Priority** | Critical |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–5 hours |
| **Files Affected** | `parser.js`, `worker.html` |
| **Acceptance Criteria** | • Fixture: single OUT of tool T to worker P ⇒ `toolsHeld` qty = 1 (not 2).<br>• Fixture: OUT then IN ⇒ worker holds 0.<br>• Daily log still records the worker’s own events once (no duplicate spam).<br>• Dashboard/`runInventory` path for other pages remains correct. |
| **Dependencies** | AUD-003 (same function; fix TDZ first or in same PR) |

---

## Issue 3 — [AUD-002] Remove login no-cors success without password verification

| Field | Content |
|-------|---------|
| **Title** | [AUD-002] Login must not succeed on opaque no-cors response |
| **Description** | When primary login fails, `loginRequest` falls back to `fetch(..., mode: "no-cors")` and returns `{ ok: true, token: SESSION_TOKEN }` without reading a response. Password is never verified. Auth gate becomes UI-only. |
| **Priority** | Critical |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–5 hours |
| **Files Affected** | `config.js`, `login.html`, `Code.gs.example` (CORS/JSON login path) |
| **Acceptance Criteria** | • Wrong password never sets session token.<br>• Opaque/no-cors response never returns `ok: true`.<br>• Clear user-visible error when login cannot be verified.<br>• Successful login still works via readable JSON CORS response on https deploy. |
| **Dependencies** | None (pair with GAS CORS confirmation) |

---

## Issue 4 — [AUD-001] Remove hardcoded SESSION_TOKEN API fallback

| Field | Content |
|-------|---------|
| **Title** | [AUD-001] Never fall back to public hardcoded API token |
| **Description** | `getApiToken()` returns `getToken() \|\| AppConfig.SESSION_TOKEN`. The constant is shipped on GitHub Pages and grants GAS API access to anyone who copies it. |
| **Priority** | Critical |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–6 hours (includes token rotation + deploy checklist) |
| **Files Affected** | `config.js`, all API callers, deployed Script Properties (not in git), `Code.gs.example` docs |
| **Acceptance Criteria** | • Logged-out client cannot call API with a bundled constant.<br>• `getApiToken()` empty/unauthorized when no login token.<br>• Deployed GAS token rotated; old public string rejected.<br>• Documented operator re-login after deploy. |
| **Dependencies** | AUD-002 (otherwise fallback login still mints the static token) |

---

# HIGH

---

## Issue 5 — [AUD-012] Escape Activity Log QR code (XSS)

| Field | Content |
|-------|---------|
| **Title** | [AUD-012] Escape scan `code` in Activity Log HTML |
| **Description** | `addLog` in `index.html` puts raw `code` into `innerHTML` while only escaping `description`. A malicious QR can inject HTML/JS and steal `localStorage` session tokens. |
| **Priority** | High |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 0.5–1 hour |
| **Files Affected** | `index.html` |
| **Acceptance Criteria** | • Payload containing `<img` / `<script` renders as visible text only.<br>• No script execution from scan code.<br>• Normal I/E/C/P codes still display correctly. |
| **Dependencies** | None |

---

## Issue 6 — [AUD-013] Escape dynamic error HTML on result pages

| Field | Content |
|-------|---------|
| **Title** | [AUD-013] Escape `e.message` and dynamic errors in page HTML |
| **Description** | Several pages embed `e.message` (and similar) into `innerHTML` without escaping, creating XSS sinks if error text ever reflects remote content. |
| **Priority** | High |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `results.html`, `dashboard.html`, `worker.html`, `tool.html`, `consumables.html`, `damage.html` (audit each) |
| **Acceptance Criteria** | • All user/remote-derived error strings use `textContent` or `escHtml`.<br>• Manual check: forced throw with `<b>x</b>` shows literal text.<br>• Loading/empty states unchanged. |
| **Dependencies** | None |

---

## Issue 7 — [AUD-005] Require server ack before marking scans sent

| Field | Content |
|-------|---------|
| **Title** | [AUD-005] Stop optimistic sync (`no-cors` always-success) |
| **Description** | `syncScan` uses opaque fetch and treats success as guaranteed; `index.html` marks queue items `sent = true`. Scans can vanish from retry while never reaching Sheets. |
| **Priority** | High |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–6 hours |
| **Files Affected** | `config.js`, `index.html`, `Code.gs.example` |
| **Acceptance Criteria** | • Mark `sent` only after readable `{ ok: true }` (or equivalent).<br>• Network failure / non-OK keeps item Pending and retries.<br>• UI still shows Synced only when ack received.<br>• Core scan workflow unchanged. |
| **Dependencies** | GAS must return CORS JSON for sync (align with AUD-002 hosting model) |

---

## Issue 8 — [AUD-006] Never delete unsent scans on queue overflow

| Field | Content |
|-------|---------|
| **Title** | [AUD-006] Preserve unsent offline queue under storage cap |
| **Description** | When queue length exceeds limit (~200), `saveScans` splices oldest **unsent** entries. Offline work is silently destroyed. |
| **Priority** | High |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 2–4 hours |
| **Files Affected** | `index.html` |
| **Acceptance Criteria** | • Unsent entries are never deleted by trim logic.<br>• At capacity: block new scans and show clear operator message (or spill to IndexedDB if chosen).<br>• Sent entries may be trimmed first if retention policy allows.<br>• Offline → online flush still works. |
| **Dependencies** | None (pair with AUD-005 in same wave) |

---

## Issue 9 — [AUD-009] Reject duplicate tool codes in active batch

| Field | Content |
|-------|---------|
| **Title** | [AUD-009] Block duplicate tool scan within same batch |
| **Description** | `ScanEngine` pushes every tool into `toolsInBatch` without dedupe. Double OUT/IN lines corrupt custody stacks. |
| **Priority** | High |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `scan.js`, `index.html` (error UX) |
| **Acceptance Criteria** | • Second scan of same tool in active batch returns blocked error.<br>• Different tools still accepted.<br>• New batch after person/dir reset allows the tool again.<br>• Person → Direction → Tools order preserved. |
| **Dependencies** | None |

---

## Issue 10 — [AUD-014] Replace shared static GAS bearer token model

| Field | Content |
|-------|---------|
| **Title** | [AUD-014] Issue per-login rotatable API tokens with expiry |
| **Description** | Backend uses one long-lived shared `API_TOKEN`. Any leak grants full API until manual rotation. No per-user binding or revocation list. |
| **Priority** | High |
| **Estimated Difficulty** | Hard |
| **Estimated Time** | 12–20 hours |
| **Files Affected** | `Code.gs.example` / deploy script, `config.js`, `login.html`, auth storage keys |
| **Acceptance Criteria** | • Login returns opaque session token (not the master secret).<br>• Token expires and/or is revocable.<br>• Master Script Property never shipped to client.<br>• Password change / admin revoke invalidates sessions. |
| **Dependencies** | AUD-001, AUD-002 |

---

## Issue 11 — [AUD-007] Send login password in POST body only

| Field | Content |
|-------|---------|
| **Title** | [AUD-007] Stop putting login password in URL query string |
| **Description** | `loginRequest` sends `user`/`pass` as GET query params — risk of history, proxy, and Apps Script logging exposure. |
| **Priority** | High |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–5 hours |
| **Files Affected** | `config.js`, `Code.gs.example`, `login.html` |
| **Acceptance Criteria** | • Password only in HTTPS POST JSON body.<br>• Query string login path removed or rejected.<br>• Failed attempts rate-limited or equivalent basic protection documented.<br>• Successful login UX unchanged. |
| **Dependencies** | GAS `doPost` login support; prefer after AUD-002 CORS honesty |

---

## Issue 12 — [AUD-008] Restrict damage photo Drive sharing

| Field | Content |
|-------|---------|
| **Title** | [AUD-008] Remove Anyone-with-link sharing on damage photos |
| **Description** | Uploaded Drive files are set `ANYONE_WITH_LINK` VIEW. Leaked URLs expose incident photos without app auth. |
| **Priority** | High |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–8 hours |
| **Files Affected** | `Code.gs.example` (`saveDamagePhoto_`), `damage.html` (viewer if URLs change) |
| **Acceptance Criteria** | • New uploads are not world-link-readable by default.<br>• Authorized operators can still view photos via approved mechanism (domain ACL or authenticated proxy).<br>• Existing public files: migration/cleanup plan documented. |
| **Dependencies** | Org Drive/sharing policy decision |

---

## Issue 13 — [AUD-010] Key holders by person code not display name

| Field | Content |
|-------|---------|
| **Title** | [AUD-010] Store custody holders as `P###` codes |
| **Description** | Parser `holdersList` uses display names. Same-name workers collide; renames break IN matching. |
| **Priority** | High |
| **Estimated Difficulty** | Hard |
| **Estimated Time** | 10–16 hours |
| **Files Affected** | `parser.js`, `dashboard.html`, `results.html`, `worker.html`, `tool.html`, docs AS-BUILT |
| **Acceptance Criteria** | • Holdings keyed by person code; UI shows resolved names.<br>• Two workers with identical names keep separate stacks.<br>• Renaming description does not break open OUT matching.<br>• Historical sheet behavior documented (migration/compat). |
| **Dependencies** | Strongly recommend AUD-027 fixtures first; AUD-003/004 fixed |

---

## Issue 14 — [AUD-011] Fix multi-tab scan queue races

| Field | Content |
|-------|---------|
| **Title** | [AUD-011] Coordinate `toolCustodyQueue` across browser tabs |
| **Description** | Multiple scanner tabs overwrite `localStorage` last-write-wins, dropping scans. |
| **Priority** | High |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–8 hours |
| **Files Affected** | `index.html` |
| **Acceptance Criteria** | • Two tabs cannot silently clobber unsent items (merge, lock, or single-tab guard).<br>• Operator warned if second tab is unsafe.<br>• Offline queue integrity preserved with AUD-006 rules. |
| **Dependencies** | AUD-006 (stable queue semantics); ideally AUD-005 |

---

# MEDIUM

---

## Issue 15 — [AUD-025] Define and enforce consumable IN semantics

| Field | Content |
|-------|---------|
| **Title** | [AUD-025] Product rule for consumable IN (allow vs block) |
| **Description** | Scanner allows IN for C/B while domain is issue-oriented. Operators may think consumables are “returned.” Needs an explicit product rule and enforcement. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–5 hours (after decision) |
| **Files Affected** | `scan.js`, `parser.js`, `consumables.html`, feature docs |
| **Acceptance Criteria** | • Written AS-BUILT rule approved by owner.<br>• Scanner enforces rule (block or restock workflow).<br>• Consumables page copy matches behavior. |
| **Dependencies** | Product owner decision |

---

## Issue 16 — [AUD-029] Link damage reports to custody ledger

| Field | Content |
|-------|---------|
| **Title** | [AUD-029] Damage workflow must update or flag custody state |
| **Description** | Damage reports are decoupled; damaged/lost tools can still show as held until a manual IN. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 6–10 hours |
| **Files Affected** | `damage.html`, `parser.js` and/or GAS, docs/workflows |
| **Acceptance Criteria** | • After damage submit, operator is guided to IN or tool gets explicit status flag.<br>• Dashboard/worker no longer treat write-offs as normal holdings without signal.<br>• Workflow doc updated AS-BUILT. |
| **Dependencies** | Product owner decision; prefer after Wave 0 parser fixes |

---

## Issue 17 — [AUD-017] Confirm OVERDUE_DAYS with operations

| Field | Content |
|-------|---------|
| **Title** | [AUD-017] Revisit `OVERDUE_DAYS` default (currently 1) |
| **Description** | One calendar day flags overnight jobs as overdue → alert fatigue. |
| **Priority** | Medium |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `config.js`, dashboard consumers, ops docs |
| **Acceptance Criteria** | • Operations confirms threshold (or makes it configurable).<br>• Dashboard overdue list matches agreed policy.<br>• Config/default documented. |
| **Dependencies** | Operations decision |

---

## Issue 18 — [AUD-027] Add automated parser/ScanEngine tests + CI

| Field | Content |
|-------|---------|
| **Title** | [AUD-027] Fixture tests for CustodyParser and ScanEngine in CI |
| **Description** | Docs have test cases but repo lacks executable tests; regressions like AUD-003/004 ship unnoticed. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 8–12 hours |
| **Files Affected** | new test files, `package.json` (if added), GitHub Actions workflow, `parser.js`/`scan.js` exportability as needed |
| **Acceptance Criteria** | • `npm test` (or equivalent) runs fixtures for inventory + worker parse + scan session rules.<br>• CI fails on regression.<br>• Covers double-hold and consumable worker path. |
| **Dependencies** | None (accelerates AUD-010) |

---

## Issue 19 — [AUD-022] Service Worker cache versioning and update UX

| Field | Content |
|-------|---------|
| **Title** | [AUD-022] Prevent stale PWA shell after releases |
| **Description** | If cache name is not bumped, field devices keep old JS after “fixed” deploys. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–5 hours |
| **Files Affected** | `sw.js`, `manifest.json`, optional update toast in `ui.js` |
| **Acceptance Criteria** | • Release checklist includes cache bump.<br>• Clients get new assets within one refresh cycle (skipWaiting + prompt or auto reload policy documented).<br>• Offline shell still works. |
| **Dependencies** | None |

---

## Issue 20 — [AUD-019] Harden GAS append locking under concurrency

| Field | Content |
|-------|---------|
| **Title** | [AUD-019] Improve sheet append race handling |
| **Description** | `LockService` wait (~5s) reduces but does not eliminate concurrent append risk under burst scanning. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–6 hours |
| **Files Affected** | `Code.gs.example` / deploy |
| **Acceptance Criteria** | • Lock failure returns explicit error to client (no silent drop).<br>• Documented behavior under contention.<br>• Burst test: N parallel syncs do not lose rows. |
| **Dependencies** | AUD-005 (client must surface nack) |

---

## Issue 21 — [AUD-020] Stop unbounded Column B full-column reads

| Field | Content |
|-------|---------|
| **Title** | [AUD-020] Constrain Column B duplicate/scan reads |
| **Description** | `getRange("B1:B")` scales poorly as the ledger grows → latency/timeouts. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–6 hours |
| **Files Affected** | `Code.gs.example` / deploy |
| **Acceptance Criteria** | • Reads limited to used range or indexed structure.<br>• Sync latency acceptable on large sheet (define baseline).<br>• Duplicate-detection semantics preserved if still required. |
| **Dependencies** | None |

---

## Issue 22 — [AUD-023] Add server-enforced role-based access

| Field | Content |
|-------|---------|
| **Title** | [AUD-023] Role-based access control (server enforced) |
| **Description** | Login is binary; any user can reach scanner, damage, dashboard. Need-to-know not enforced server-side. |
| **Priority** | Medium |
| **Estimated Difficulty** | Hard |
| **Estimated Time** | 12–20 hours |
| **Files Affected** | Credentials sheet/schema, `Code.gs.example`, `ui.js`, page gates |
| **Acceptance Criteria** | • Roles defined (e.g. scanner / supervisor / admin).<br>• GAS rejects unauthorized actions even if UI is bypassed.<br>• UI hides disallowed nav as UX only. |
| **Dependencies** | AUD-014 (session identity) |

---

## Issue 23 — [AUD-015] Wire or remove dead autoDirection / validationMode prefs

| Field | Content |
|-------|---------|
| **Title** | [AUD-015] Implement or remove unused scan preference settings |
| **Description** | `autoDirectionMode` and `validationMode` persist but `scan.js` ignores them — false operator confidence. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–6 hours |
| **Files Affected** | `config.js`, `scan.js`, `index.html`, feature docs |
| **Acceptance Criteria** | • Either prefs drive ScanEngine behavior with tests, or controls removed until implemented.<br>• Docs match AS-BUILT. |
| **Dependencies** | Product decision |

---

## Issue 24 — [AUD-016] Apply soundVolume preference to beeps

| Field | Content |
|-------|---------|
| **Title** | [AUD-016] Honor `soundVolume` in scanner audio |
| **Description** | Preference stored but Web Audio gain paths ignore it. |
| **Priority** | Medium |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1 hour |
| **Files Affected** | `index.html`, `config.js` |
| **Acceptance Criteria** | • Volume preference changes beep loudness.<br>• Mute/zero works.<br>• Or control removed if deliberately unused. |
| **Dependencies** | None |

---

## Issue 25 — [AUD-018] Fix theme control label text

| Field | Content |
|-------|---------|
| **Title** | [AUD-018] Correct theme toggle label updates |
| **Description** | `syncThemeControls` may assign incorrect/long `textContent` to theme controls. |
| **Priority** | Medium |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 0.5–1 hour |
| **Files Affected** | `config.js`, `ui.js` |
| **Acceptance Criteria** | • Theme button shows correct short label/icon state in light and dark.<br>• No leftover full-sentence label in the control. |
| **Dependencies** | None |

---

## Issue 26 — [AUD-021] Remove hardcoded default damage sheet ID from example

| Field | Content |
|-------|---------|
| **Title** | [AUD-021] Require DAMAGE_SHEET_ID via Script Property only |
| **Description** | `DEFAULT_DAMAGE_SHEET_ID` in example couples environments and risks wrong-sheet writes. |
| **Priority** | Medium |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `Code.gs.example`, deployment docs |
| **Acceptance Criteria** | • Example has empty/missing default; missing property fails loudly.<br>• Setup docs explain required property.<br>• No real sheet id required in git. |
| **Dependencies** | None |

---

## Issue 27 — [AUD-024] Complete PWA icon set vs manifest

| Field | Content |
|-------|---------|
| **Title** | [AUD-024] Supply all manifest icon sizes (incl. maskable) |
| **Description** | Manifest may reference sizes not fully present — weak install UX on some Android launchers. |
| **Priority** | Medium |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `manifest.json`, `icons/` |
| **Acceptance Criteria** | • Every manifest icon path exists.<br>• Maskable icon present if declared.<br>• Install on Android shows correct icon. |
| **Dependencies** | None |

---

## Issue 28 — [AUD-026] Plan server-side custody projection (strategic)

| Field | Content |
|-------|---------|
| **Title** | [AUD-026] Evaluate server-side custody projection |
| **Description** | All holder/overdue math is client-side; version skew can disagree on “truth.” Strategic hardening item. |
| **Priority** | Medium |
| **Estimated Difficulty** | Hard |
| **Estimated Time** | 20–40 hours (spike + implement); spike alone 4–8 hours |
| **Files Affected** | GAS, Sheets schema, `parser.js` consumers |
| **Acceptance Criteria** | • ADR written with recommend/defer.<br>• If implement: single server projection consumed by clients.<br>• If defer: explicit accept risk in audit/roadmap. |
| **Dependencies** | Wave 0–1 stability; AUD-027 helpful |

---

## Issue 29 — [AUD-028] Harden Credentials sheet (hashing + ACL)

| Field | Content |
|-------|---------|
| **Title** | [AUD-028] Verify password hashing and restrict Credentials sheet ACL |
| **Description** | Sheet-based credentials are a single point of failure; deployed hash quality must be verified; sheet sharing must be least-privilege. |
| **Priority** | Medium |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–6 hours |
| **Files Affected** | Deployed `Code.gs.txt`, Credentials sheet ACLs, `Code.gs.example`, security docs |
| **Acceptance Criteria** | • Deploy confirmed to use salted hashes (not plaintext).<br>• Credentials sheet limited to admin accounts.<br>• Security doc updated AS-BUILT. |
| **Dependencies** | Access to deploy environment |

---

## Issue 30 — [AUD-030] Accept public client; document threat model

| Field | Content |
|-------|---------|
| **Title** | [AUD-030] Document public Pages threat model (no false security) |
| **Description** | Entire client is public by design. Client checks are UX only; server must enforce. This issue tracks documentation/acceptance, not hiding the client. |
| **Priority** | Medium |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1–2 hours |
| **Files Affected** | `docs/security/*`, architecture ADR |
| **Acceptance Criteria** | • Threat model states hostile client assumption.<br>• Cross-links to AUD-001/002/014 as compensating controls.<br>• No claim that obscurity protects the API. |
| **Dependencies** | None |

---

# LOW

---

## Issue 31 — [AUD-041] Drop official file:// support

| Field | Content |
|-------|---------|
| **Title** | [AUD-041] Require https GitHub Pages only (drop file://) |
| **Description** | Legacy `file://` + no-cors assumptions keep unsafe auth/sync paths alive. |
| **Priority** | Low |
| **Estimated Difficulty** | Easy–Medium |
| **Estimated Time** | 2–4 hours |
| **Files Affected** | `config.js`, docs, comments in sync/login |
| **Acceptance Criteria** | • Product decision recorded.<br>• Code/docs no longer promise file:// mode.<br>• https-only path simplifies AUD-002/005. |
| **Dependencies** | Product decision; best with Wave 2 |

---

## Issue 32 — [AUD-031] Retire or document ABU-HASAN.html redirect

| Field | Content |
|-------|---------|
| **Title** | [AUD-031] Clean up legacy `ABU-HASAN.html` entry |
| **Description** | Harmless redirect stub adds maintenance noise. |
| **Priority** | Low |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 0.5 hour |
| **Files Affected** | `ABU-HASAN.html`, deploy notes |
| **Acceptance Criteria** | • Keep with clear comment **or** remove after confirming zero hits.<br>• Bookmarks/docs point to canonical `index.html` / login. |
| **Dependencies** | None |

---

## Issue 33 — [AUD-032] Unify operator UI language

| Field | Content |
|-------|---------|
| **Title** | [AUD-032] Choose primary locale and extract strings |
| **Description** | Mixed Arabic/English strings increase training friction. |
| **Priority** | Low |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 8–16 hours |
| **Files Affected** | Multiple HTML/JS, optional i18n module |
| **Acceptance Criteria** | • Primary locale chosen.<br>• User-facing strings consistent on scanner + dashboard path.<br>• Optional: string table for future second language. |
| **Dependencies** | Owner language decision |

---

## Issue 34 — [AUD-033] Vendor CDN assets into repository

| Field | Content |
|-------|---------|
| **Title** | [AUD-033] Self-host Bootstrap / html5-qrcode (CDN independence) |
| **Description** | Runtime CDN dependency can break scanner when CDN is blocked. |
| **Priority** | Low |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 3–5 hours |
| **Files Affected** | HTML heads, `vendor/` (new), `sw.js` cache list |
| **Acceptance Criteria** | • App runs with CDN blocked (after SW/vendor cache warm).<br>• License notices preserved.<br>• SW precaches local vendor files. |
| **Dependencies** | AUD-022 helpful |

---

## Issue 35 — [AUD-034] Sync root TODO.md with AS-BUILT docs

| Field | Content |
|-------|---------|
| **Title** | [AUD-034] Update root TODO to match shipped features |
| **Description** | Root `TODO.md` lags (e.g. PWA), confusing planning. |
| **Priority** | Low |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 0.5–1 hour |
| **Files Affected** | `TODO.md`, optionally roadmap links |
| **Acceptance Criteria** | • Completed items marked done.<br>• Open items match ROADMAP / audit waves.<br>• No contradiction with AS-BUILT feature docs. |
| **Dependencies** | None |

---

## Issue 36 — [AUD-035] Add Content-Security-Policy

| Field | Content |
|-------|---------|
| **Title** | [AUD-035] Add CSP to reduce XSS impact radius |
| **Description** | No CSP headers/meta; XSS sinks are higher severity. |
| **Priority** | Low |
| **Estimated Difficulty** | Hard |
| **Estimated Time** | 8–16 hours |
| **Files Affected** | All HTML, possible inline script refactor, hosting notes |
| **Acceptance Criteria** | • CSP meta/headers deployed without breaking scanner camera libs.<br>• Inline scripts minimized or nonce’d as feasible on Pages.<br>• AUD-012/013 still fixed independently. |
| **Dependencies** | AUD-012, AUD-013 first |

---

## Issue 37 — [AUD-036] Add sync failure metrics / ops logging

| Field | Content |
|-------|---------|
| **Title** | [AUD-036] Measure sync nack / queue depth for operations |
| **Description** | No structured metrics for silent sync loss — issues found only when tools go missing. |
| **Priority** | Low |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 6–10 hours |
| **Files Affected** | `index.html`, GAS optional logging sheet, ops docs |
| **Acceptance Criteria** | • Operator or admin can see pending count / recent sync failures.<br>• At least one durable signal (Sheet row or UI badge) for nacks. |
| **Dependencies** | AUD-005 |

---

## Issue 38 — [AUD-037] Improve scanner accessibility

| Field | Content |
|-------|---------|
| **Title** | [AUD-037] Keyboard/ARIA pass on scanner and conflict modal |
| **Description** | Conflict modal and scanner controls lack systematic a11y. |
| **Priority** | Low |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–8 hours |
| **Files Affected** | `index.html`, `app.css`, related modals |
| **Acceptance Criteria** | • Conflict modal operable via keyboard.<br>• Controls have accessible names.<br>• Focus not trapped incorrectly. |
| **Dependencies** | None |

---

## Issue 39 — [AUD-038] Extract monolithic inline page scripts (opportunistic)

| Field | Content |
|-------|---------|
| **Title** | [AUD-038] Gradual extract of inline HTML scripts to modules |
| **Description** | Large inline `<script>` blocks hurt review/test velocity. Opportunistic refactor only. |
| **Priority** | Low |
| **Estimated Difficulty** | Hard |
| **Estimated Time** | 16–30 hours (phased) |
| **Files Affected** | `index.html`, `damage.html`, other pages, new JS modules |
| **Acceptance Criteria** | • Behavior unchanged (regression tested).<br>• At least scanner or damage page extracted in a first slice.<br>• No drive-by refactors outside approved scope. |
| **Dependencies** | Prefer after Wave 0–1 |

---

## Issue 40 — [AUD-039] Optional plain-text parser log strings

| Field | Content |
|-------|---------|
| **Title** | [AUD-039] Make parser log emoji optional / plain-text mode |
| **Description** | Cosmetic consistency; emoji prefixes in parser warning strings. |
| **Priority** | Low |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 1 hour |
| **Files Affected** | `parser.js` |
| **Acceptance Criteria** | • Plain-text mode or removed emoji without breaking parsers.<br>• UI still clear. |
| **Dependencies** | None |

---

## Issue 41 — [AUD-040] Define privacy / retention for photos and attendance

| Field | Content |
|-------|---------|
| **Title** | [AUD-040] Data retention policy for Sheets + Drive photos |
| **Description** | Photos and attendance retained indefinitely; storage and privacy risk grow over time. |
| **Priority** | Low |
| **Estimated Difficulty** | Medium |
| **Estimated Time** | 4–8 hours (policy + light automation) |
| **Files Affected** | docs, optional GAS cleanup job, Drive folder |
| **Acceptance Criteria** | • Written retention policy approved.<br>• Cleanup job or manual quarterly procedure documented.<br>• Damage photo retention aligns with AUD-008. |
| **Dependencies** | Legal/ops decision; AUD-008 related |

---

## Issue 42 — [AUD-042] Review upload helper scripts for secrets/clutter

| Field | Content |
|-------|---------|
| **Title** | [AUD-042] Audit root `.bat`/`.ps1` upload helpers |
| **Description** | Convenience scripts may clutter repo; must never embed tokens. |
| **Priority** | Low |
| **Estimated Difficulty** | Easy |
| **Estimated Time** | 0.5–1 hour |
| **Files Affected** | `UPLOAD_NOW.bat`, `push_to_github.bat`, `upload_to_github.ps1`, related txt helpers |
| **Acceptance Criteria** | • No secrets in scripts.<br>• README points to official git workflow.<br>• Obsolete helpers removed or clearly marked optional. |
| **Dependencies** | None |

---

# Wave mapping (for GitHub milestones)

| Milestone | Issues (AUD) |
|-----------|----------------|
| **Wave 0 — Emergency** | 003, 004, 002 |
| **Wave 1 — Sync + XSS** | 012, 013, 005, 006, 009 |
| **Wave 2 — Security** | 001, 014, 007, 008, 041 |
| **Wave 3 — Custody rules** | 010, 025, 029, 017, 011 |
| **Wave 4 — Platform** | 027, 022, 019, 020, 023, 015, 016, 018, + residual Medium/Low as scheduled |
| **Package A (recommended first)** | 003, 004, 002, 012, 005, 006, 009 |

---

# Suggested GitHub issue body template

```markdown
## Summary
<paste Description>

## Priority
Critical | High | Medium | Low

## Difficulty / Time
<Difficulty> · <Estimated Time>

## Files
- path/...

## Acceptance Criteria
- [ ] ...

## Dependencies
- AUD-XXX / None

## Audit reference
docs/CODE_AUDIT_REPORT.md → AUD-XXX
```

---

*End of enterprise backlog — 42 issues — 2026-07-16*  
*No application source was modified.*
