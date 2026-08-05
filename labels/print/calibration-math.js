/**
 * Pure calibration math — no DOM.
 */
import { roundMm } from "../core/units.js";

export function defaultCalibrationProfile() {
  return {
    printerName: "default",
    dpi: 300,
    offsetXMm: 0,
    offsetYMm: 0,
    scale: 1,
    feedMm: 0,
    rotationDeg: 0,
    labelGapMm: 0,
    paperOffsetMm: 0
  };
}

/**
 * Given expected vs measured physical sizes/offsets, compute a printer profile.
 * Offset errors are inverted so the profile compensates the drift.
 */
export function computeCalibration({
  expectedW,
  expectedH,
  measuredW,
  measuredH,
  measuredOffsetX = 0,
  measuredOffsetY = 0,
  base = null
}) {
  const prev = { ...defaultCalibrationProfile(), ...(base || {}) };
  const sx = measuredW > 0 ? expectedW / measuredW : 1;
  const sy = measuredH > 0 ? expectedH / measuredH : 1;
  const scale = roundMm((sx + sy) / 2, 4);
  return {
    ...prev,
    scale: Math.max(0.9, Math.min(1.1, scale)),
    offsetXMm: roundMm(-(Number(measuredOffsetX) || 0), 2),
    offsetYMm: roundMm(-(Number(measuredOffsetY) || 0), 2)
  };
}
