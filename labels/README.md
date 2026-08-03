# QR Labels — Modular WYSIWYG Engine

## Architecture

```
Template JSON
      │
      ▼
Label Renderer  (labels/label-renderer.js)   ← single source of truth
      │
 ┌────┼─────────┐
 ▼    ▼         ▼
Editor Preview  Print
```

All geometry is stored in **millimeters**. Pixels are derived once at paint time (`mm × DPI / 25.4`). Editor zoom uses CSS `transform: scale()` only — it never mutates mm values.

## Modules (`labels/`)

| File | Responsibility |
|------|----------------|
| `label-units.js` | mm/px helpers |
| `label-layout-engine.js` | content box, clamp, mirror, align, snap |
| `label-model.js` | template/layer schema & defaults |
| `label-renderer.js` | **only** DOM renderer (editor/preview/print) |
| `label-editor.js` | Design Studio orchestrator |
| `label-history.js` | Undo / redo |
| `label-selection.js` | multi-select, resize, rotate, group |
| `label-guides.js` | rulers, grid, smart guides, safe area |
| `label-properties.js` | inspector panel |
| `label-toolbar.js` | add / align / zoom / presets |
| `label-preview.js` | preview modal |
| `label-print.js` | print window from same renderer |
| `label-calibration.js` | guided printer calibration wizard |
| `label-storage.js` | local prefs + printer profiles |
| `label-api.js` | template/catalog API |
| `label-shortcuts.js` | keyboard + ctrl-wheel zoom |
| `label-export.js` | JSON export + code parsing |
| `label-app.js` | page bootstrap |
| `label-app.css` | studio + page chrome |
| `qr-code-styling.js` | vendor QR library |

`qr-labels.html` is a thin shell (~300 lines) over these modules.

## WYSIWYG contract

1. `renderLabel(template, item, options)` builds one physical label.
2. `renderSheet(...)` composes many labels for preview/print.
3. Print CSS sets `@page { size: <exact mm>; margin: 0 }`.
4. Calibration offsets/scale apply only as a **shell transform**, never by shifting object x/y (keeps alternate flip symmetric).

## Deploy

Serve the `labels/` folder next to `qr-labels.html` (same origin). ES modules require HTTP(S).
