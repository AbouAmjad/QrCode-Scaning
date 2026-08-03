/**
 * label-layout-engine.js — Geometry in millimeters (ES module).
 * Positions are relative to the printable content origin
 * (top-left inside border + innerMargin). Zoom never mutates mm.
 */
import {
  MM_PER_INCH,
  roundMm,
  clamp,
  mmToPx,
  pxToMm
} from "./label-units.js";

export { MM_PER_INCH, roundMm, clamp, mmToPx, pxToMm };

/**
 * Printable content box inside the label.
 * Object (0,0) = top-left of this box.
 */
export function contentBox(spec) {
  const st = (spec && spec.style) || {};
  const labelW = Math.max(1, Number(spec.labelW) || 50);
  const labelH = Math.max(1, Number(spec.labelH) || 30);
  const border = Math.max(0, Number(st.borderWidth) || 0);
  const inset = Math.max(0, Number(spec.innerMargin) || 0);
  const usableW = Math.max(0.1, labelW - 2 * border - 2 * inset);
  const usableH = Math.max(0.1, labelH - 2 * border - 2 * inset);
  return {
    labelW,
    labelH,
    border,
    inset,
    // Absolute left:0 is already inside border (border-box) — only inset.
    ox: inset,
    oy: inset,
    usableW,
    usableH
  };
}

/** Convert legacy % layer → mm using current content box. */
export function migrateLayerToMm(ly, box) {
  if (!ly) return ly;
  if (ly.unit === "mm") {
    return {
      ...ly,
      x: roundMm(ly.x),
      y: roundMm(ly.y),
      w: roundMm(Math.max(0.5, ly.w)),
      h: roundMm(Math.max(0.5, ly.h)),
      rotation: Number(ly.rotation) || 0,
      unit: "mm"
    };
  }
  const x = Number(ly.x) || 0;
  const y = Number(ly.y) || 0;
  const w = Number(ly.w) || 10;
  const h = Number(ly.h) || 10;
  const looksMm = x > 100 || y > 100 || w > 100 || h > 100;
  if (looksMm) {
    return {
      ...ly,
      x: roundMm(x),
      y: roundMm(y),
      w: roundMm(Math.max(0.5, w)),
      h: roundMm(Math.max(0.5, h)),
      rotation: Number(ly.rotation) || 0,
      unit: "mm"
    };
  }
  return {
    ...ly,
    x: roundMm((x / 100) * box.usableW),
    y: roundMm((y / 100) * box.usableH),
    w: roundMm(Math.max(0.5, (w / 100) * box.usableW)),
    h: roundMm(Math.max(0.5, (h / 100) * box.usableH)),
    rotation: Number(ly.rotation) || 0,
    unit: "mm"
  };
}

export function migrateLayersToMm(layers, spec) {
  const box = contentBox(spec);
  return (layers || []).map((ly) => migrateLayerToMm(ly, box));
}

export function clampLayerMm(ly, box) {
  const w = clamp(Number(ly.w) || 1, 0.5, box.usableW);
  const h = clamp(Number(ly.h) || 1, 0.5, box.usableH);
  return {
    ...ly,
    x: clamp(roundMm(ly.x), 0, Math.max(0, box.usableW - w)),
    y: clamp(roundMm(ly.y), 0, Math.max(0, box.usableH - h)),
    w: roundMm(w),
    h: roundMm(h),
    rotation: Number(ly.rotation) || 0,
    unit: "mm"
  };
}

/**
 * Physical horizontal flip for duplex / alternate labels.
 * newX = usableW − w − oldX; swap text-align left↔right.
 */
export function mirrorLayers(layers, spec) {
  const box = contentBox(spec);
  return (layers || []).map((ly) => {
    const copy = { ...migrateLayerToMm(ly, box) };
    copy.x = roundMm(Math.max(0, box.usableW - copy.w - copy.x));
    if (copy.align === "left") copy.align = "right";
    else if (copy.align === "right") copy.align = "left";
    const rot = Number(copy.rotation) || 0;
    if (rot) copy.rotation = (360 - rot) % 360;
    copy.unit = "mm";
    return copy;
  });
}

/**
 * Absolute layout from label top-left (mm).
 * Calibration is applied as shell transform only (never shifts object x/y),
 * so L↔R flip stays symmetric.
 */
export function layout(spec, layersArr, options = {}) {
  const box = contentBox(spec);
  const cal = options.calibration || {
    dpi: 300,
    offsetXMm: 0,
    offsetYMm: 0,
    scale: 1,
    feedMm: 0
  };

  const layers = (layersArr || [])
    .map((ly) => clampLayerMm(migrateLayerToMm(ly, box), box))
    .filter((ly) => ly && ly.visible !== false)
    .sort((a, b) => (a.z || 0) - (b.z || 0));

  const objects = layers.map((ly) => ({
    ...ly,
    // Absolute from label TL = content origin + layer local
    absX: roundMm(box.ox + Number(ly.x)),
    absY: roundMm(box.oy + Number(ly.y)),
    absW: roundMm(Number(ly.w)),
    absH: roundMm(Number(ly.h))
  }));

  const scale = Number(cal.scale) || 1;
  const shell = options.applyCalibration
    ? {
        offsetXMm: Number(cal.offsetXMm) || 0,
        offsetYMm: Number(cal.offsetYMm) || 0,
        scale,
        dpi: Number(cal.dpi) || 300
      }
    : { offsetXMm: 0, offsetYMm: 0, scale: 1, dpi: Number(cal.dpi) || 300 };

  return { box, objects, shell, cal };
}

export function labelShellCss(spec, shell = {}) {
  const st = (spec && spec.style) || {};
  const bw = Math.max(0, Number(st.borderWidth) || 0);
  const br = Math.max(0, Number(st.borderRadius) || 0);
  const ox = Number(shell.offsetXMm) || 0;
  const oy = Number(shell.offsetYMm) || 0;
  const sc = Number(shell.scale) || 1;
  const tf =
    ox || oy || sc !== 1
      ? `transform:translate(${ox}mm,${oy}mm) scale(${sc});transform-origin:top left;`
      : "";
  return [
    `background:${st.bgColor || "#fff"}`,
    `border:${bw}mm solid ${st.borderColor || "#0f172a"}`,
    `border-radius:${br}mm`,
    "box-sizing:border-box",
    "position:relative",
    "overflow:hidden",
    "padding:0",
    "margin:0",
    `width:${Number(spec.labelW)}mm`,
    `height:${Number(spec.labelH)}mm`,
    tf
  ]
    .filter(Boolean)
    .join(";");
}

/** Absolute object CSS from label TL (mm). Shared by editor, preview, print. */
export function objectBoxCss(obj) {
  const tf = obj.rotation
    ? `transform:rotate(${obj.rotation}deg);transform-origin:center center;`
    : "";
  return [
    "position:absolute",
    `left:${obj.absX != null ? obj.absX : obj.x}mm`,
    `top:${obj.absY != null ? obj.absY : obj.y}mm`,
    `width:${obj.absW != null ? obj.absW : obj.w}mm`,
    `height:${obj.absH != null ? obj.absH : obj.h}mm`,
    "box-sizing:border-box",
    "margin:0",
    "padding:0",
    "overflow:hidden",
    tf
  ]
    .filter(Boolean)
    .join(";");
}

export function objectScreenRect(obj, pxPerMm) {
  const x = obj.absX != null ? obj.absX : obj.x;
  const y = obj.absY != null ? obj.absY : obj.y;
  const w = obj.absW != null ? obj.absW : obj.w;
  const h = obj.absH != null ? obj.absH : obj.h;
  return {
    left: x * pxPerMm,
    top: y * pxPerMm,
    width: w * pxPerMm,
    height: h * pxPerMm
  };
}

export function alignLayers(layers, mode, box) {
  if (!layers?.length) return layers;
  const xs = layers.map((l) => Number(l.x));
  const ys = layers.map((l) => Number(l.y));
  const rights = layers.map((l) => Number(l.x) + Number(l.w));
  const bottoms = layers.map((l) => Number(l.y) + Number(l.h));
  const minX = Math.min(...xs);
  const maxR = Math.max(...rights);
  const minY = Math.min(...ys);
  const maxB = Math.max(...bottoms);
  const cx = (minX + maxR) / 2;
  const cy = (minY + maxB) / 2;
  const usableW = box?.usableW ?? 50;
  const usableH = box?.usableH ?? 30;

  return layers.map((ly) => {
    const next = { ...ly };
    switch (mode) {
      case "left":
        next.x = minX;
        break;
      case "right":
        next.x = roundMm(maxR - Number(ly.w));
        break;
      case "top":
        next.y = minY;
        break;
      case "bottom":
        next.y = roundMm(maxB - Number(ly.h));
        break;
      case "centerH":
        next.x = roundMm(cx - Number(ly.w) / 2);
        break;
      case "centerV":
        next.y = roundMm(cy - Number(ly.h) / 2);
        break;
      case "centerLabelH":
        next.x = roundMm((usableW - Number(ly.w)) / 2);
        break;
      case "centerLabelV":
        next.y = roundMm((usableH - Number(ly.h)) / 2);
        break;
      default:
        break;
    }
    return next;
  });
}

export function distributeLayers(layers, axis = "h") {
  if (!layers || layers.length < 3) return layers;
  const sorted = [...layers].sort((a, b) =>
    axis === "h" ? Number(a.x) - Number(b.x) : Number(a.y) - Number(b.y)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (axis === "h") {
    const start = Number(first.x);
    const end = Number(last.x);
    const step = (end - start) / (sorted.length - 1);
    return sorted.map((ly, i) => ({ ...ly, x: roundMm(start + step * i) }));
  }
  const start = Number(first.y);
  const end = Number(last.y);
  const step = (end - start) / (sorted.length - 1);
  return sorted.map((ly, i) => ({ ...ly, y: roundMm(start + step * i) }));
}

/** Snap value to grid (mm). */
export function snapMm(n, gridMm) {
  const g = Number(gridMm) || 0;
  if (g <= 0) return roundMm(n);
  return roundMm(Math.round(Number(n) / g) * g);
}

const LabelLayoutEngine = {
  MM_PER_INCH,
  roundMm,
  clamp,
  mmToPx,
  pxToMm,
  contentBox,
  migrateLayerToMm,
  migrateLayersToMm,
  clampLayerMm,
  mirrorLayers,
  layout,
  labelShellCss,
  objectBoxCss,
  objectScreenRect,
  alignLayers,
  distributeLayers,
  snapMm
};

export default LabelLayoutEngine;

// Back-compat for non-module scripts
if (typeof window !== "undefined") {
  window.LabelLayoutEngine = LabelLayoutEngine;
}
