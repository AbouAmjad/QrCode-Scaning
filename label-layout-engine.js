/**
 * LabelLayoutEngine — single source of truth for QR label geometry.
 * All positions/sizes are millimeters relative to the printable content origin
 * (top-left inside border; after innerMargin). Zoom/pan never change these values.
 */
(function (global) {
  "use strict";

  var MM_PER_INCH = 25.4;
  var STORAGE_CAL = "abouamjad_printer_calibration_v1";

  function roundMm(n, places) {
    var p = places == null ? 3 : places;
    var f = Math.pow(10, p);
    return Math.round(Number(n) * f) / f;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  /** pixels = (mm × DPI) / 25.4 */
  function mmToPx(mm, dpi) {
    return (Number(mm) * Number(dpi || 96)) / MM_PER_INCH;
  }

  function pxToMm(px, dpi) {
    return (Number(px) * MM_PER_INCH) / Number(dpi || 96);
  }

  var _memCal = null;

  function loadCalibration() {
    try {
      if (typeof localStorage === "undefined") {
        return Object.assign(defaultCalibration(), _memCal || {});
      }
      var raw = localStorage.getItem(STORAGE_CAL);
      if (!raw) return Object.assign(defaultCalibration(), _memCal || {});
      return Object.assign(defaultCalibration(), JSON.parse(raw));
    } catch (e) {
      return Object.assign(defaultCalibration(), _memCal || {});
    }
  }

  function defaultCalibration() {
    return {
      printerName: "default",
      dpi: 300,
      offsetXMm: 0,
      offsetYMm: 0,
      scale: 1,
      feedMm: 0
    };
  }

  function saveCalibration(cal) {
    var next = Object.assign(defaultCalibration(), cal || {});
    _memCal = next;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_CAL, JSON.stringify(next));
      }
    } catch (e) { /* ignore */ }
    return next;
  }

  /**
   * Printable content box inside the label.
   * Object (0,0) = top-left of this box. Zero border + zero margin ⇒ full label.
   */
  function contentBox(spec) {
    var st = (spec && spec.style) || {};
    var labelW = Math.max(1, Number(spec.labelW) || 50);
    var labelH = Math.max(1, Number(spec.labelH) || 30);
    var border = Math.max(0, Number(st.borderWidth) || 0);
    var inset = Math.max(0, Number(spec.innerMargin) || 0);
    var usableW = Math.max(0.1, labelW - 2 * border - 2 * inset);
    var usableH = Math.max(0.1, labelH - 2 * border - 2 * inset);
    return {
      labelW: labelW,
      labelH: labelH,
      border: border,
      inset: inset,
      /**
       * Offset from the CSS padding-box origin (inside border) to content.
       * Print/studio use box-sizing:border-box, so absolute left:0 is already
       * inside the border — do NOT add border into ox or objects double-inset.
       */
      ox: inset,
      oy: inset,
      usableW: usableW,
      usableH: usableH
    };
  }

  /** Convert legacy % layer → mm using current content box. */
  function migrateLayerToMm(ly, box) {
    if (!ly) return ly;
    if (ly.unit === "mm") {
      return Object.assign({}, ly, {
        x: roundMm(ly.x),
        y: roundMm(ly.y),
        w: roundMm(Math.max(0.5, ly.w)),
        h: roundMm(Math.max(0.5, ly.h)),
        rotation: Number(ly.rotation) || 0,
        unit: "mm"
      });
    }
    var x = Number(ly.x) || 0;
    var y = Number(ly.y) || 0;
    var w = Number(ly.w) || 10;
    var h = Number(ly.h) || 10;
    // Heuristic: values already look like mm (any dimension > 100, or clearly larger than %)
    var looksMm = x > 100 || y > 100 || w > 100 || h > 100;
    if (looksMm) {
      return Object.assign({}, ly, {
        x: roundMm(x),
        y: roundMm(y),
        w: roundMm(Math.max(0.5, w)),
        h: roundMm(Math.max(0.5, h)),
        rotation: Number(ly.rotation) || 0,
        unit: "mm"
      });
    }
    return Object.assign({}, ly, {
      x: roundMm((x / 100) * box.usableW),
      y: roundMm((y / 100) * box.usableH),
      w: roundMm(Math.max(0.5, (w / 100) * box.usableW)),
      h: roundMm(Math.max(0.5, (h / 100) * box.usableH)),
      rotation: Number(ly.rotation) || 0,
      unit: "mm"
    });
  }

  function migrateLayersToMm(layers, spec) {
    var box = contentBox(spec);
    return (layers || []).map(function (ly) {
      return migrateLayerToMm(ly, box);
    });
  }

  function clampLayerMm(ly, box) {
    var w = clamp(Number(ly.w) || 1, 0.5, box.usableW);
    var h = clamp(Number(ly.h) || 1, 0.5, box.usableH);
    return Object.assign({}, ly, {
      x: clamp(roundMm(ly.x), 0, Math.max(0, box.usableW - w)),
      y: clamp(roundMm(ly.y), 0, Math.max(0, box.usableH - h)),
      w: roundMm(w),
      h: roundMm(h),
      rotation: Number(ly.rotation) || 0,
      unit: "mm"
    });
  }

  /**
   * Physical horizontal flip for duplex / alternate labels.
   * Content-relative: newX = usableW − w − oldX
   * Also swap text-align left↔right so glyphs sit against the outer edge
   * the same way after the box moves (left-align on the left ⇒ right-align on the right).
   * Without the align swap, long left-aligned text overflows into the label edge
   * on flipped stickers — exactly the print defect on alternate labels.
   */
  function mirrorLayers(layers, spec) {
    var box = contentBox(spec);
    return (layers || []).map(function (ly) {
      var copy = Object.assign({}, migrateLayerToMm(ly, box));
      copy.x = roundMm(Math.max(0, box.usableW - copy.w - copy.x));
      if (copy.align === "left") copy.align = "right";
      else if (copy.align === "right") copy.align = "left";
      var rot = Number(copy.rotation) || 0;
      if (rot) copy.rotation = (360 - rot) % 360;
      copy.unit = "mm";
      return copy;
    });
  }

  /**
   * Build absolute layout from label TL (mm).
   * Studio: applyCalibration=false.
   * Print/preview: applyCalibration=true — calibration is returned as `shell`
   * (offset/scale on the label wrapper) so L↔R flip stays symmetric.
   * Object x/y are NEVER shifted by offsetX/offsetY (that broke alternate flip).
   */
  function layout(spec, layersArr, options) {
    options = options || {};
    var box = contentBox(spec);
    var cal = options.applyCalibration ? loadCalibration() : defaultCalibration();
    if (options.calibration) cal = Object.assign(defaultCalibration(), options.calibration);

    var layers = (layersArr || [])
      .map(function (ly) {
        return clampLayerMm(migrateLayerToMm(ly, box), box);
      })
      .filter(function (ly) {
        return ly && ly.visible !== false;
      })
      .sort(function (a, b) {
        return (a.z || 0) - (b.z || 0);
      });

    var objects = layers.map(function (ly) {
      var x = roundMm(box.ox + ly.x);
      var y = roundMm(box.oy + ly.y);
      var w = roundMm(ly.w);
      var h = roundMm(ly.h);
      return {
        id: ly.id,
        type: ly.type,
        name: ly.name,
        layer: ly,
        /** absolute mm from label TL (geometry only — no printer offset) */
        x: x,
        y: y,
        w: w,
        h: h,
        rotation: Number(ly.rotation) || 0
      };
    });

    var shell = {
      offsetXMm: 0,
      offsetYMm: 0,
      scale: 1
    };
    if (options.applyCalibration) {
      shell.offsetXMm = Number(cal.offsetXMm) || 0;
      shell.offsetYMm = Number(cal.offsetYMm) || 0;
      var sc = Number(cal.scale);
      shell.scale = sc && sc > 0 ? sc : 1;
    }

    return {
      box: box,
      calibration: cal,
      shell: shell,
      objects: objects,
      dpi: options.dpi || cal.dpi || 300
    };
  }

  /** Max |Δ| between two layouts' object corners (mm). */
  function maxPosDelta(layoutA, layoutB) {
    var map = {};
    (layoutB.objects || []).forEach(function (o) {
      map[o.id] = o;
    });
    var max = 0;
    (layoutA.objects || []).forEach(function (a) {
      var b = map[a.id];
      if (!b) return;
      max = Math.max(
        max,
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.w - b.w),
        Math.abs(a.h - b.h)
      );
    });
    return roundMm(max, 4);
  }

  function validate(spec, layers, thresholdMm) {
    var thr = thresholdMm == null ? 0.1 : thresholdMm;
    var studio = layout(spec, layers, { applyCalibration: false });
    var again = layout(spec, layers, { applyCalibration: false });
    var delta = maxPosDelta(studio, again);
    var oob = [];
    studio.objects.forEach(function (o) {
      if (
        o.x < -0.05 ||
        o.y < -0.05 ||
        o.x + o.w > studio.box.labelW + 0.05 ||
        o.y + o.h > studio.box.labelH + 0.05
      ) {
        oob.push(o.id);
      }
    });
    // Content-box overflow (relative to usable area)
    layers.forEach(function (ly) {
      if (!ly || ly.visible === false) return;
      var m = migrateLayerToMm(ly, studio.box);
      if (m.x < -0.05 || m.y < -0.05 || m.x + m.w > studio.box.usableW + 0.05 || m.y + m.h > studio.box.usableH + 0.05) {
        if (oob.indexOf(ly.id) < 0) oob.push(ly.id);
      }
    });
    return {
      ok: delta <= thr && oob.length === 0,
      deltaMm: delta,
      thresholdMm: thr,
      outOfBounds: oob,
      studio: studio,
      box: studio.box,
      dpi: studio.dpi,
      calibration: loadCalibration()
    };
  }

  /** CSS for the label shell (mm). Optional shell = { offsetXMm, offsetYMm, scale }. */
  function labelShellCss(spec, shell) {
    var st = (spec && spec.style) || {};
    var bw = Math.max(0, Number(st.borderWidth) || 0);
    var br = Math.max(0, Number(st.borderRadius) || 0);
    shell = shell || {};
    var ox = Number(shell.offsetXMm) || 0;
    var oy = Number(shell.offsetYMm) || 0;
    var sc = Number(shell.scale);
    if (!sc || sc <= 0) sc = 1;
    var tf = "";
    if (ox || oy || sc !== 1) {
      // Whole-label transform keeps L↔R flip margins equal (unlike per-object offset).
      tf =
        "transform:translate(" +
        ox +
        "mm," +
        oy +
        "mm) scale(" +
        sc +
        ");transform-origin:center center;";
    }
    return (
      "background:" +
      (st.bgColor || "#fff") +
      ";border:" +
      bw +
      "mm solid " +
      (st.borderColor || "#0f172a") +
      ";border-radius:" +
      br +
      "mm;box-sizing:border-box;position:relative;overflow:hidden;padding:0;margin:0;width:" +
      Number(spec.labelW) +
      "mm;height:" +
      Number(spec.labelH) +
      "mm;" +
      tf
    );
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  /**
   * Absolute object CSS from layout object (mm from label TL).
   * Shared by preview + print + SVG.
   */
  function objectBoxCss(obj) {
    var tf = obj.rotation
      ? "transform:rotate(" + obj.rotation + "deg);transform-origin:center center;"
      : "";
    return (
      "position:absolute;left:" +
      obj.x +
      "mm;top:" +
      obj.y +
      "mm;width:" +
      obj.w +
      "mm;height:" +
      obj.h +
      "mm;box-sizing:border-box;margin:0;padding:0;overflow:hidden;" +
      tf
    );
  }

  /** Screen px rect for studio (zoom never mutates mm data). */
  function objectScreenRect(obj, pxPerMm) {
    return {
      left: obj.x * pxPerMm,
      top: obj.y * pxPerMm,
      width: obj.w * pxPerMm,
      height: obj.h * pxPerMm
    };
  }

  global.LabelLayoutEngine = {
    MM_PER_INCH: MM_PER_INCH,
    roundMm: roundMm,
    clamp: clamp,
    mmToPx: mmToPx,
    pxToMm: pxToMm,
    contentBox: contentBox,
    migrateLayerToMm: migrateLayerToMm,
    migrateLayersToMm: migrateLayersToMm,
    clampLayerMm: clampLayerMm,
    mirrorLayers: mirrorLayers,
    layout: layout,
    validate: validate,
    maxPosDelta: maxPosDelta,
    labelShellCss: labelShellCss,
    objectBoxCss: objectBoxCss,
    objectScreenRect: objectScreenRect,
    loadCalibration: loadCalibration,
    saveCalibration: saveCalibration,
    defaultCalibration: defaultCalibration,
    esc: esc
  };
})(typeof window !== "undefined" ? window : globalThis);
