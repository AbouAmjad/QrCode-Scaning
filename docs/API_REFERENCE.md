# API Reference

Base URL is configured in `config.js` as `AppConfig.SCRIPT_URL` (Google Apps Script `/exec` deployment).

All responses are JSON text (`ContentService.MimeType.JSON`).

## Authentication

Most actions require `token` matching the configured Apps Script token (`APP_TOKEN` / default session token).

| Action | Auth |
|--------|------|
| `options` | None |
| `login` | Username/password |
| All others | `token` |

**Client helper:** `getApiToken()` sends stored token, currently falling back to a static session token if empty (security risk — see Known Issues).

## Transport notes

| Method | Used for |
|--------|----------|
| GET query params | Most actions, including login & scan sync |
| POST `application/x-www-form-urlencoded` | Damage with photo (fallback) |
| POST `text/plain` JSON body | Damage with large photo payload |

CORS: GitHub Pages → Apps Script relies on redirect follow and, for scans historically, `no-cors` mode.

---

## Actions

### `options`
**Request:** `?action=options`  
**Response:** `{ "ok": true }`  
**Purpose:** Connectivity / CORS probe.

### `login`
**Request:** `?action=login&user=...&pass=...`  
**Success:** `{ "success": true, "token": "<shared-token>" }`  
**Failure:** `{ "success": false }`  

### `getDesc`
**Auth:** token  
**Request:** `?action=getDesc&code=P101&token=...`  
**Response:** `{ "description": "..." }`  

### `scanData` (query param style)
**Auth:** token  
**Request:** `?scanData=E1-A&token=...`  
**Success:** `{ "status": "OK" }`  
**Busy:** `{ "error": "SERVER_BUSY" }`  
**Unauthorized:** `{ "error": "UNAUTHORIZED" }`  

Writes uppercased code into next empty cell of column B under script lock.

> Frontend `syncScan()` currently uses `mode: "no-cors"` and cannot read this JSON.

### `getDates`
**Auth:** token  
**Request:** `?action=getDates&token=...`  
**Response:** `["{16/07/2026}", ...]` unique dates from column H.

### `getData`
**Auth:** token  
**Request:** `?action=getData&date={16/07/2026}&token=...`  
**Response:** array of:

```json
{
  "toolCode": "E1-A",
  "toolDescription": "Hammer",
  "rowDate": "{16/07/2026}",
  "timestamp": "{16/07/2026} 09:41:02",
  "isTargetDay": true
}
```

Returns **full history**, with `isTargetDay` marking rows matching `date`.

### `getDamageDates`
**Auth:** token  
**Response:** string array of unique damage dates (newest first), or `{ "error": "..." }`.

### `getDamage`
**Auth:** token  
**Request:** `?action=getDamage&date=16/07/2026&token=...` (date optional / empty = all)  
**Response:** `{ "items": [ { date, code, name, image, damagedBy, count, remark }, ... ] }`

### `submitDamage`
**Auth:** token  
**Fields:** `toolCode`, `personCode`, `qty`, `remark`, optional `date`, optional `imageBase64`  
**Success:** `{ "success": true, "row": n, "item": {...} }`  
**Errors:** validation / sheet write errors as `{ "error": "..." }`

---

## Client wrappers (`config.js`)

| Function | Behavior |
|----------|----------|
| `apiGet(params)` | GET + parse JSON |
| `apiPostForm(fields)` | form POST |
| `apiPostPlain(body)` | JSON as text/plain |
| `apiSubmitDamage(...)` | GET without photo; POST with photo |
| `syncScan(code)` | no-cors GET scanData |
| `loginRequest(user, pass)` | login + hazardous no-cors fallback |
| `loadDateOptions` / `loadDamageDateOptions` | populate `<select>` |

## Error strings

| Value | Meaning |
|-------|---------|
| `UNAUTHORIZED` | Bad/missing token |
| `SERVER_BUSY` | Lock timeout on scan write |
| `NO ACTION SPECIFIED` | Unknown/missing action (often stale deploy) |
| `INVALID_JSON` | Bad POST body |

## Compatibility rules

- Do not rename action strings without coordinated frontend release.  
- Prefer additive fields over breaking response shape changes.  
- Keep `scanData` query-param write path until confirmable sync ships.
