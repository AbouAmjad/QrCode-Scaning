# Database Design (Google Sheets)

ToolCustody does **not** use a traditional SQL database.  
Persistent storage is **Google Sheets** (+ Drive for damage images).

## 1. Design principles

1. **Append-oriented ledger** for scans (event log).  
2. **Catalog sheets** for code → description.  
3. **Derived custody** computed in the browser (`parser.js`).  
4. **Separate Damage spreadsheet/tab** for incident records.

## 2. Workbooks / IDs

Configured in Apps Script (`MAIN_SHEET_ID`, `SPREADSHEET_MAP`, `DAMAGE_SHEET_ID` / Script Properties).

| Store | Purpose |
|-------|---------|
| Main ledger spreadsheet | Chronological scan codes |
| P / I / E / C / B spreadsheets | Catalogs by prefix |
| Damage spreadsheet | Damage incidents + photos URL |

## 3. Main ledger sheet

### 3.1 Write path
Apps Script `scanData` writes the scanned code (uppercased) into **column B**, choosing the next empty cell in B (starting row 2).

### 3.2 Read path
`getData` / `getDates` read columns **A–H** (display values).

| Column | Usage in app |
|--------|----------------|
| A | Reserved / unused by scanner write |
| **B** | **QR / scan code** (authoritative event) |
| C–G | Not required by current parser |
| **H** | **Timestamp / date cell** used to derive `rowDate` |

### 3.3 Date extraction
`extractDate_` prefers a `{dd/MM/yyyy}` token inside the timestamp cell; otherwise uses the trimmed cell string.

### 3.4 Logical event row (API projection)

```json
{
  "toolCode": "E1-A",
  "toolDescription": "Hammer",
  "rowDate": "{16/07/2026}",
  "timestamp": "{16/07/2026} 09:41:02",
  "isTargetDay": true
}
```

> Descriptions are **not stored on the ledger**; they are joined at read time via catalog lookup.

## 4. Catalog sheets (`SPREADSHEET_MAP`)

Each prefix maps to a spreadsheet ID and description column letter (default **E**).

| Prefix | Entity |
|--------|--------|
| P | Persons / workers |
| I | Tools (I-series) |
| E | Tools (E-series) |
| C | Consumables |
| B | Bags / B-series assets |

### Lookup algorithm (`internalGetDescription`)
1. Take first character of code.  
2. Open mapped spreadsheet active sheet.  
3. Find row where **column A** equals code (case-insensitive).  
4. Return value from configured description column.  

Possible results: description text, `DESCRIPTION NOT FOUND`, `UNKNOWN CODE TYPE`, `ERROR FETCHING`, etc.

## 5. Damage store

### 5.1 Tab
Sheet name: **`Damage`** (auto-created with headers if missing).

### 5.2 Columns

| Col | Header | Content |
|-----|--------|---------|
| A | Date | `dd/MM/yyyy` or provided date |
| B | Code | Tool code |
| C | Name | Resolved tool description |
| D | ImageURL | Drive view URL or empty |
| E | DamagedBy | Person code (`P…`) |
| F | Count | Quantity ≥ 1 |
| G | Remark | Free text |

### 5.3 Photos
Optional base64 upload → Drive folder `ToolCustody-Damage-Photos` (or `DAMAGE_DRIVE_FOLDER_ID`) → public view link.

## 6. Client-derived structures (not persisted)

### Inventory item (durable tool)
```
{
  code, description, holdersList[], actionsToday[],
  scannedToday, hasWarning
}
```

### Consumable item
```
{
  code, description, isConsumable: true,
  issuedToday, actionsToday[], hasWarning
}
```

### Worker (overview)
```
{ code, name, toolsHeld[], actionsToday[] }
```

## 7. Integrity rules

| Rule | Enforcement |
|------|-------------|
| Event order matters | Sheet append order + parser replay |
| Person clears direction | Parser + ScanEngine |
| Consumables don’t hold custody | `isConsumable` branches |
| Damage requires P + tool prefix | GAS `internalSubmitDamage_` |

## 8. Risks & recommendations

| Risk | Recommendation |
|------|----------------|
| Manual sheet edits break history | Lock ranges; train operators |
| Empty holes in column B | Prefer appendRow / lastRow+1 strategy |
| Full-history reads | Add date filters / snapshots |
| Name-based holder matching | Prefer person code keys |
| Public Drive links | Restrict sharing policy |

## 9. Backup

Operational backup = Google Drive version history of spreadsheets.  
Documented restore procedure: see FEATURES/021 and Deployment Guide.
