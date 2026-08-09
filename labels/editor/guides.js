/**
 * editor/guides.js — rulers, optional in-label grid, smart guides.
 * Overlay painting only — never mutates document geometry.
 *
 * Permanent center crosshairs are intentionally omitted.
 * Alignment lines appear only while dragging (smartGuides).
 */
import { contentBox } from "../layout/index.js";

export class GuidesPainter {
  constructor() {
    this.smartGuides = [];
  }

  setSmartGuides(guides) {
    this.smartGuides = guides || [];
  }

  clearSmartGuides() {
    this.smartGuides = [];
  }

  paint(ctx, doc, pxPerMm) {
    const w = Number(doc.labelW) * pxPerMm;
    const h = Number(doc.labelH) * pxPerMm;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.canvas.width = Math.ceil(w);
    ctx.canvas.height = Math.ceil(h);

    const box = contentBox(doc);
    const gridMm = doc.gridMm || 1;

    // Grid stays inside the label page only (never outside the stage).
    if (doc.showGuides !== false && gridMm > 0) {
      ctx.strokeStyle = "rgba(15,23,42,0.045)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= doc.labelW + 0.001; x += gridMm) {
        const px = x * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let y = 0; y <= doc.labelH + 0.001; y += gridMm) {
        const py = y * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
    }

    // Optional printable inset — only with Grid on (keeps the page clean by default).
    if (doc.showGuides !== false && (box.ox > 0 || box.oy > 0)) {
      ctx.strokeStyle = "rgba(14,116,144,0.28)";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        box.ox * pxPerMm,
        box.oy * pxPerMm,
        box.usableW * pxPerMm,
        box.usableH * pxPerMm
      );
      ctx.setLineDash([]);
    }

    // Optional safe-area inset (off by default in document defaults going forward).
    if (doc.showSafeArea === true && doc.safeMm > 0) {
      const s = doc.safeMm;
      ctx.strokeStyle = "rgba(220,38,38,0.3)";
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(
        (box.ox + s) * pxPerMm,
        (box.oy + s) * pxPerMm,
        Math.max(0, box.usableW - 2 * s) * pxPerMm,
        Math.max(0, box.usableH - 2 * s) * pxPerMm
      );
      ctx.setLineDash([]);
    }

    // Temporary smart alignment guides (drag only).
    const seen = new Set();
    for (const g of this.smartGuides) {
      const key = `${g.axis}:${g.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ctx.save();
      ctx.strokeStyle = "rgba(219,39,119,0.92)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);
      ctx.beginPath();
      if (g.axis === "x") {
        const px = (box.ox + g.value) * pxPerMm;
        ctx.moveTo(px + 0.5, 0);
        ctx.lineTo(px + 0.5, h);
      } else {
        const py = (box.oy + g.value) * pxPerMm;
        ctx.moveTo(0, py + 0.5);
        ctx.lineTo(w, py + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  paintRulers(hHost, vHost, doc, pxPerMm) {
    if (!hHost || !vHost) return;
    const step = (doc.gridMm || 1) >= 1 ? 5 : 1;
    hHost.innerHTML = "";
    vHost.innerHTML = "";
    const hc = document.createElement("canvas");
    const vc = document.createElement("canvas");
    hc.width = Math.ceil(doc.labelW * pxPerMm) + 40;
    hc.height = 20;
    vc.width = 20;
    vc.height = Math.ceil(doc.labelH * pxPerMm) + 40;
    const hctx = hc.getContext("2d");
    const vctx = vc.getContext("2d");
    hctx.fillStyle = "#e2e8f0";
    hctx.fillRect(0, 0, hc.width, 20);
    vctx.fillStyle = "#e2e8f0";
    vctx.fillRect(0, 0, 20, vc.height);
    hctx.fillStyle = vctx.fillStyle = "#64748b";
    hctx.font = vctx.font = "10px system-ui";
    for (let mm = 0; mm <= doc.labelW; mm += step) {
      const x = mm * pxPerMm;
      hctx.beginPath();
      hctx.moveTo(x, mm % 10 === 0 ? 8 : 12);
      hctx.lineTo(x, 20);
      hctx.strokeStyle = "#94a3b8";
      hctx.stroke();
      if (mm % 10 === 0) hctx.fillText(String(mm), x + 2, 10);
    }
    for (let mm = 0; mm <= doc.labelH; mm += step) {
      const y = mm * pxPerMm;
      vctx.beginPath();
      vctx.moveTo(mm % 10 === 0 ? 8 : 12, y);
      vctx.lineTo(20, y);
      vctx.strokeStyle = "#94a3b8";
      vctx.stroke();
    }
    hHost.appendChild(hc);
    vHost.appendChild(vc);
  }
}

/** @deprecated alias — prefer GuidesPainter */
export const GuideOverlay = GuidesPainter;
