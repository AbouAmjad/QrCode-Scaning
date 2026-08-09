import { roundMm, clamp } from "../core/units.js";
import { contentBox } from "./box.js";

/** Convert legacy % layer → mm. */
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

export function migrateLayersToMm(layers, boxOrSpec) {
  const box = boxOrSpec.usableW != null ? boxOrSpec : contentBox(boxOrSpec);
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
