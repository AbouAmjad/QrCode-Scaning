/**
 * Absolute layout from label top-left (mm).
 * Calibration applies as shell transform only — never shifts object x/y
 * (keeps L↔R flip symmetric).
 */
import { roundMm } from "../core/units.js";
import { contentBox } from "./box.js";
import { migrateLayerToMm, clampLayerMm } from "./migrate.js";

export function layoutAbsolute(spec, layersArr, options = {}) {
  const box = contentBox(spec);
  const cal = options.calibration || {
    dpi: 300,
    offsetXMm: 0,
    offsetYMm: 0,
    scale: 1
  };

  const layers = (layersArr || [])
    .map((ly) => clampLayerMm(migrateLayerToMm(ly, box), box))
    .filter((ly) => ly && ly.visible !== false)
    .sort((a, b) => (a.z || 0) - (b.z || 0));

  const objects = layers.map((ly) => ({
    ...ly,
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

export function objectBoxCss(obj) {
  const x = obj.absX != null ? obj.absX : obj.x;
  const y = obj.absY != null ? obj.absY : obj.y;
  const w = obj.absW != null ? obj.absW : obj.w;
  const h = obj.absH != null ? obj.absH : obj.h;
  const tf = obj.rotation
    ? `transform:rotate(${obj.rotation}deg);transform-origin:center center;`
    : "";
  return [
    "position:absolute",
    `left:${x}mm`,
    `top:${y}mm`,
    `width:${w}mm`,
    `height:${h}mm`,
    "box-sizing:border-box",
    "margin:0",
    "padding:0",
    "overflow:hidden",
    tf
  ]
    .filter(Boolean)
    .join(";");
}

export { contentBox } from "./box.js";
export { snapMm, snapPosition } from "./snap.js";
export { alignLayers, distributeLayers } from "./align.js";
export { mirrorLayers } from "./mirror.js";
export { migrateLayersToMm, clampLayerMm } from "./migrate.js";
