# QR Labels Professional Edition

Commercial-grade label design engine for ToolCustody.

See **[REDESIGN.md](./REDESIGN.md)** for the v10 wizard redesign notes, isolation guarantees, and deferred API items.

## Architecture

```
labels/
  core/        Document model, store, units, types
  elements/    Extensible element registry (qr, barcode, text, image, shape, line…)
  layout/      Content box, snap, align, mirror, migrate
  render/      THE single renderer (engine + paint + sheet + print CSS + barcode)
  editor/      Design Studio (viewport, selection, guides, shortcuts)
  print/       Iframe print + calibration wizard
  export/      PNG / PDF sheet export
  data/        API, storage, serialize, code queue, starter presets
  ui/          Page bootstrap + preview + styles
  vendor/      QRCodeStyling
  tests/       Node unit tests (no DOM) + prod fixture regression
```

**Single source of truth:** `TemplateDocument` (`core/document.js`).

**Single renderer:** `renderLabel` / `renderSheet` (`render/engine.js`, `render/sheet.js`).
Editor, Preview, Print, and Export all call these — never duplicate paint logic.

**Geometry:** millimeters everywhere. Pixels = `mm × dpi / 25.4` once at paint time.

**Calibration:** shell transform only (`offsetX/Y` + `scale`) — never shifts object x/y
(keeps L↔R flip symmetric).

## WYSIWYG contract

Editor = Preview = Print. Always.

## Extensibility

Add a new element type by registering in `elements/` with `defaults()`.
The paint switch in `render/paint-element.js` gains one case — core layout/engine stay untouched.

## Tests

```bash
node labels/tests/run.mjs
```

## Page entry

`qr-labels.html` → `labels/ui/app.js` → studio / preview / print.
