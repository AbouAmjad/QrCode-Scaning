# Deployment Guide

## 1. Overview

ToolCustody has two deployable surfaces:

1. **Frontend** — static files on GitHub Pages
2. **Backend** — Google Apps Script web app bound to Sheets

They must stay compatible (API actions + token).

## 2. Frontend (GitHub Pages)

### Repository
- Remote: https://github.com/AbouAmjad/QrCode-Scaning
- Branch: `main`
- Site: https://abouamjad.github.io/QrCode-Scaning/

### Deploy steps
1. Ensure secrets are not staged (`Code.gs.txt` is gitignored).
2. Commit changes on `main`.
3. Push to `origin/main`.
4. Wait for Pages rebuild.
5. Hard refresh clients (Ctrl+F5).
6. If PWA is stale, bump `CACHE` in `sw.js` and redeploy.

### Helper
`sync_to_github.py` stages an allowlist and pushes. Always review `git status` first.

## 3. Backend (Google Apps Script)

1. Copy `Code.gs.example` into the Apps Script project (or sync from local `Code.gs.txt`).
2. Configure Script Properties: `APP_USER`, `APP_PASS`, `APP_TOKEN`, `DAMAGE_SHEET_ID`, optional `DAMAGE_DRIVE_FOLDER_ID`, optional `B_SHEET_ID`.
3. Set spreadsheet IDs in code or properties.
4. Deploy Web App (Execute as Me, Who has access: Anyone).
5. Put the `/exec` URL into `config.js` `SCRIPT_URL`.

### Every backend change
Edit → Deploy → **New version**. Forgetting this causes `NO ACTION SPECIFIED`.

## 4. Sheets checklist

- Main ledger writable
- Catalogs P/I/E/C/B readable
- Damage spreadsheet + tab `Damage`
- Ledger: column B = codes, column H = timestamps
- Catalogs: column A = code, column E = description

## 5. Post-deploy verification

Login → scan P/OUT/tool → Overview load → Damage submit → SW registers.

## 6. Rollback

Frontend: revert git commit. Backend: previous Apps Script version. Data: Sheets version history.
