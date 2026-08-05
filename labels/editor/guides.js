/**
 * editor/guides.js — rulers, grid, printable/safe areas, smart guides.
 * Overlay painting only — never mutates document geometry.
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

    if (doc.showGuides !== false && gridMm > 0) {
      ctx.strokeStyle = "rgba(15,23,42,0.08)";
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

    // Printable / content area
    ctx.strokeStyle = "rgba(14,116,144,0.35)";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      box.ox * pxPerMm,
      box.oy * pxPerMm,
      box.usableW * pxPerMm,
      box.usableH * pxPerMm
    );
    ctx.setLineDash([]);

    // Safe area
    if (doc.showSafeArea !== false && doc.safeMm > 0) {
      const s = doc.safeMm;
      ctx.strokeStyle = "rgba(220,38,38,0.35)";
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(
        (box.ox + s) * pxPerMm,
        (box.oy + s) * pxPerMm,
        Math.max(0, box.usableW - 2 * s) * pxPerMm,
        Math.max(0, box.usableH - 2 * s) * pxPerMm
      );
      ctx.setLineDash([]);
    }

    // Bleed outline (outside label edge hint)
    if (doc.bleedMm > 0) {
      const b = doc.bleedMm;
      ctx.strokeStyle = "rgba(234,179,8,0.4)";
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-b * pxPerMm, -b * pxPerMm, (doc.labelW + 2 * b) * pxPerMm, (doc.labelH + 2 * b) * pxPerMm);
      ctx.setLineDash([]);
    }

    // Center lines
    ctx.strokeStyle = "rgba(15,118,110,0.45)";
    ctx.setLineDash([6, 4]);
    const cx = (box.ox + box.usableW / 2) * pxPerMm;
    const cy = (box.oy + box.usableH / 2) * pxPerMm;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const g of this.smartGuides) {
      ctx.strokeStyle = "rgba(236,72,153,0.85)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      if (g.axis === "x") {
        const px = (box.ox + g.value) * pxPerMm;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      } else {
        const py = (box.oy + g.value) * pxPerMm;
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();
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
    hctx.fillStyle = "#0f172a";
    hctx.fillRect(0, 0, hc.width, 20);
    vctx.fillStyle = "#0f172a";
    vctx.fillRect(0, 0, 20, vc.height);
    hctx.fillStyle = vctx.fillStyle = "#94a3b8";
    hctx.font = vctx.font = "10px system-ui";
    for (let mm = 0; mm <= doc.labelW; mm += step) {
      const x = mm * pxPerMm;
      hctx.beginPath();
      hctx.moveTo(x, mm % 10 === 0 ? 8 : 12);
      hctx.lineTo(x, 20);
      hctx.strokeStyle = "#64748b";
      hctx.stroke();
      if (mm % 10 === 0) hctx.fillText(String(mm), x + 2, 10);
    }
    for (let mm = 0; mm <= doc.labelH; mm += step) {
      const y = mm * pxPerMm;
      vctx.beginPath();
      vctx.moveTo(mm % 10 === 0 ? 8 : 12, y);
      vctx.lineTo(20, y);
      vctx.strokeStyle = "#64748b";
      vctx.stroke();
    }
    hHost.appendChild(hc);
    vHost.appendChild(vc);
  }
}

/** @deprecated alias — prefer GuidesPainter */
export const GuideOverlay = GuidesPainter;
