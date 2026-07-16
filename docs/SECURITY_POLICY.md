# Security Policy

## 1. Scope

Security expectations for ToolCustody frontend, Apps Script backend, Google Sheets, and Drive photos.

## 2. Current security model (as-built)

| Control | Implementation | Grade |
|---------|----------------|-------|
| UI auth gate | `localStorage` token presence | Weak |
| API auth | Shared static token equality | Weak |
| Credentials storage | Script Properties (preferred) or constants | Medium if Properties used |
| Transport | HTTPS | Good |
| XSS | `escHtml` on most renders | Medium–Good |
| Secrets in git | `Code.gs.txt` gitignored | Good if honored |
| Photo access | Drive `ANYONE_WITH_LINK` | Weak |

## 3. Authentication

1. `login` compares username/password to configured values.  
2. On success, returns a **shared** session token (not per-user, not expiring).  
3. Client stores token under `AppConfig.TOKEN_KEY`.  
4. Protected pages call `requireAuth()`.  

### Known weaknesses

- Password sent as **GET query parameter**  
- Client may fall back to static `SESSION_TOKEN` without login (`getApiToken`)  
- Login CORS failure path may accept fallback token without verifying credentials  
- Token appears in URL query strings for API GETs  

## 4. Authorization

There is **no RBAC**. Any holder of the token can:

- Write scans  
- Read full history  
- Submit/read damage  

## 5. Data classification

| Data | Classification | Storage |
|------|----------------|---------|
| Worker/tool catalogs | Internal | Sheets |
| Scan ledger | Internal operational | Sheets |
| Damage photos | Sensitive / possibly personal | Drive |
| Credentials | Secret | Script Properties / local Code.gs.txt |
| Browser token | Secret-equivalent | localStorage |

## 6. XSS / injection

- Prefer `escHtml` for untrusted text in `innerHTML`  
- Do not insert raw API strings into HTML  
- Sheet cells can contain hostile text; treat as untrusted  
- Be aware of spreadsheet formula injection if exporting to Sheets consumers  

## 7. Offline queue security

`localStorage.offlineScans` is readable/modifiable by any script on the origin. Treat as untrusted until server ACK exists.

## 8. Required operator practices

1. Never commit `Code.gs.txt` or `.env`.  
2. Rotate `APP_TOKEN` if leaked.  
3. Prefer Script Properties over hardcoded USER/PASS.  
4. Limit Google account access to Sheets.  
5. Review Drive sharing on damage folder.  
6. Deploy GAS as “Anyone” only with strong token discipline (or tighten later).  

## 9. Target security baseline (roadmap)

1. Remove client token fallback & login no-cors success.  
2. Stop putting passwords/tokens in query strings (POST login).  
3. Per-session tokens with expiry.  
4. Role separation (scanner vs admin).  
5. Private photo links or authenticated image proxy.  
6. Confirmable sync to prevent forged local “sent” state.  

## 10. Incident response (lightweight)

1. Rotate APP_TOKEN / APP_PASS immediately.  
2. Redeploy Apps Script.  
3. Force logout (clear tokens) on all devices.  
4. Audit recent Sheet rows and Drive files.  
5. Update [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) / changelog.
