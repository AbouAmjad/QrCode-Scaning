# QR Labels Redesign (v10)

Branch: `cursor/qr-labels-redesign-4f63`  
Cache bust: `labels/ui/app.js?v=10`, `labels/ui/styles.css?v=10`

## Isolation guarantees

- Changes are confined to `qr-labels.html` and `labels/**`.
- No breaking changes to API actions:
  `listLabelTemplates`, `saveLabelTemplate`, `deleteLabelTemplate`, `listPeople`, `getCatalogStock`.
- No schema changes to `label_templates`.
- Shared `config.js` / `ui.js` / `i18n.js` untouched.
- **Not deployed to production** until explicit approval after QA.

## What changed

### Page shell
- Wizard steps: Template → Size → Codes → Print
- Template thumbnails, search, double-click to mark default
- Starter library (tool / person / consumable / warning)
- Live mini-preview
- Code queue validation (duplicates / missing catalog codes)
- CSV import
- Autosave draft to `localStorage` (`tc_label_draft_v10`)
- Primary Print actions vs secondary Save/Export/Calibrate

### Design Studio
- Quick / Advanced mode toggle
- Barcode (Code128) element
- QR: logo URL, more dot styles, contrast warning
- Text: `dir` auto/ltr/rtl (Bidi), extra binding roles
- Inspector summary when nothing selected
- Calibration `computeCalibration` import fix

### Export
- PNG / PDF export via `labels/export/sheet.js` (same `renderSheet` path)
- Test print (first label only)
- Thermal B/W simulation toggle (preview only)

## Deferred (needs additive API / DB — ask before implementing)

| Feature | Why deferred |
|---------|----------------|
| Server print audit / monthly report | Needs new table or audit_log action |
| `labels.print` permission | Additive permission seed + role UI |
| Template versioning / sharing | Needs schema columns or side table |
| Multi-user conflict lock | Needs `updated_at` compare endpoint / ETag |
| Webhooks | New server surface |
| EAN barcode variant | Can add client-side later without API |

## Regression

Fixture: `labels/tests/fixtures/prod-templates.json` (snapshot of live `51x25mm All`).

```bash
node labels/tests/run.mjs
```

## Deploy checklist (when approved)

1. Copy `qr-labels.html` + entire `labels/` tree to `/var/www/toolcustody/`
2. Hard refresh (`Ctrl+Shift+R`)
3. Open saved template `51x25mm All` → Design Studio → Generate → Print
4. Calibrate → Calculate must not throw
5. Export PNG/PDF smoke
