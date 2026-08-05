/**
 * editor/viewport.js — zoom + pan. Never mutates mm geometry.
 */
import { ZOOM_STEPS } from "../core/types.js";
import { MM_PER_INCH, cssMmToPxFactor } from "../core/units.js";

export class Viewport {
  constructor({ zoom = 1, panX = 0, panY = 0, tool = "select" } = {}) {
    this.zoom = zoom;
    this.panX = panX;
    this.panY = panY;
    this.tool = tool; // 'select' | 'hand'
  }

  /** CSS-px per mm for current zoom (fit computed by caller). */
  pxPerMm(fitPxPerMm = null) {
    if (this.zoom === "fit") return fitPxPerMm || cssMmToPxFactor(96);
    return ((Number(this.zoom) || 1) * 96) / MM_PER_INCH;
  }

  /** Scale factor applied to a CSS-mm label root. */
  labelScale(pxPerMm) {
    return pxPerMm / cssMmToPxFactor(96);
  }

  setZoom(value) {
    this.zoom = value === "fit" ? "fit" : Number(value) || 1;
  }

  nudgeZoom(dir) {
    let cur = this.zoom === "fit" ? 1 : Number(this.zoom) || 1;
    let idx = ZOOM_STEPS.findIndex((s) => s >= cur - 0.001);
    if (idx < 0) idx = 3;
    idx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + (dir > 0 ? 1 : -1)));
    this.zoom = ZOOM_STEPS[idx];
    return this.zoom;
  }

  /**
   * Zoom toward a client point inside the stage wrapper.
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} factor  >1 zoom in, <1 zoom out
   * @param {DOMRect} wrapRect
   */
  zoomAt(clientX, clientY, factor, wrapRect) {
    const prev = this.zoom === "fit" ? 1 : Number(this.zoom) || 1;
    const next = Math.max(0.1, Math.min(16, prev * factor));
    const cx = clientX - (wrapRect?.left || 0) - wrapRect.width / 2;
    const cy = clientY - (wrapRect?.top || 0) - wrapRect.height / 2;
    // Keep point under cursor stable relative to pan.
    this.panX = cx - ((cx - this.panX) * next) / prev;
    this.panY = cy - ((cy - this.panY) * next) / prev;
    this.zoom = next;
    return this.zoom;
  }

  /**
   * Fit label (mm) into stage (px) with padding.
   */
  fit(stageW, stageH, labelWMm, labelHMm, pad = 48) {
    const availW = Math.max(40, stageW - pad * 2);
    const availH = Math.max(40, stageH - pad * 2);
    const cssFactor = cssMmToPxFactor(96);
    const labelWPx = labelWMm * cssFactor;
    const labelHPx = labelHMm * cssFactor;
    const sx = availW / labelWPx;
    const sy = availH / labelHPx;
    this.zoom = Math.max(0.15, Math.min(4, Math.min(sx, sy)));
    this.panX = 0;
    this.panY = 0;
    return this.zoom;
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  resetPan() {
    this.panX = 0;
    this.panY = 0;
  }

  /** CSS transform string for the world/stage node. */
  cssTransform() {
    const z = this.zoom === "fit" ? 1 : Number(this.zoom) || 1;
    return `translate(${this.panX}px, ${this.panY}px) scale(${z})`;
  }

  zoomPercent() {
    const z = this.zoom === "fit" ? 1 : Number(this.zoom) || 1;
    return Math.round(z * 100);
  }
}
