# Deploy Notes — Trust + V2 Foundation (2026-07-16)

## Client (GitHub Pages)
Push/sync the repo. Hard-refresh devices (SW bumped to `toolcustody-v5`).

## Google Apps Script (required for new modules)
1. Copy updates from `Code.gs.example` into your deployed `Code.gs`.
2. **Rotate** Script Property `APP_TOKEN` to a new secret (old public token must die).
3. Set `DAMAGE_SHEET_ID` (no longer baked into example).
4. Optional: `APP_ROLE=admin`, `OPS_SHEET_ID` (defaults to main sheet).
5. Optional sheet tab **Credentials**: `User | Pass | Role` (`admin` / `store_keeper` / `supervisor` / `viewer`).
6. Deploy **New version** of the Web App.

## After deploy
- Everyone must **log in again** (no hardcoded token fallback).
- New nav: Receiving, Repair, Labels, Search, Reports, Alerts, Audit (role-filtered).
- First Receiving / Lifecycle / Audit calls auto-create tabs on the ops spreadsheet.

## Scanner protocol unchanged
**Person → Direction → Tools**
