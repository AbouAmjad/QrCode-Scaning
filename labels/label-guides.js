/**
 * label-guides.js — Rulers, grid, smart guides, safe/bleed overlays.
 */
import { mmToPx, roundMm } from "./label-units.js";
import { contentBox } from "./label-layout-engine.js";

export class GuidesController {
  constructor(opts = {}) {
    this.gridMm = opts.gridMm ?? 1;
    this.snapToGrid = opts.snapToGrid !== false;
    this.snapToObjects = opts.snapToObjects !== false;
    this.showGrid = opts.showGrid !== false;
    this.showRulers = opts.showRulers !== false;
    this.showSafeArea = opts.showSafeArea !== false;
    this.showCenter = opts.showCenter !== false;
    this.safeMm = opts.safeMm ?? 1;
    this.bleedMm = opts.bleedMm ?? 0;
    this.smartGuides = [];
  }

  setGrid(mm) {
    this.gridMm = Number(mm) || 1;
  }

  /**
   * Draw overlays into a canvas sized to the label (screen px).
   * Does not affect mm geometry.
   */
  paint(ctx, template, pxPerMm, selectedLayers = []) {
    const w = Number(template.labelW) * pxPerMm;
    const h = Number(template.labelH) * pxPerMm;
    ctx.clearRect(0, 0, w, h);
    const box = contentBox(template);

    if (this.showGrid && this.gridMm > 0) {
      ctx.strokeStyle = "rgba(15,23,42,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= template.labelW + 0.001; x += this.gridMm) {
        const px = x * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let y = 0; y <= template.labelH + 0.001; y += this.gridMm) {
        const py = y * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
    }

    // Content / printable area
    ctx.strokeStyle = "rgba(14,116,144,0.35)";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      box.ox * pxPerMm,
      box.oy * pxPerMm,
      box.usableW * pxPerMm,
      box.usableH * pxPerMm
    );
    ctx.setLineDash([]);

    if (this.showSafeArea && this.safeMm > 0) {
      ctx.strokeStyle = "rgba(220,38,38,0.35)";
      ctx.setLineDash([2, 2]);
      const s = this.safeMm;
      ctx.strokeRect(
        (box.ox + s) * pxPerMm,
        (box.oy + s) * pxPerMm,
        Math.max(0, box.usableW - 2 * s) * pxPerMm,
        Math.max(0, box.usableH - 2 * s) * pxPerMm
      );
      ctx.setLineDash([]);
    }

    if (this.bleedMm > 0) {
      ctx.strokeStyle = "rgba(217,119,6,0.4)";
      ctx.strokeRect(
        -this.bleedMm * pxPerMm,
        -this.bleedMm * pxPerMm,
        (template.labelW + 2 * this.bleedMm) * pxPerMm,
        (template.labelH + 2 * this.bleedMm) * pxPerMm
      );
    }

    if (this.showCenter) {
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
    }

    // Smart guides from last snap
    for (const g of this.smartGuides) {
      ctx.strokeStyle = "rgba(236,72,153,0.85)";
      ctx.lineWidth = 1;
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

    void selectedLayers;
    void mmToPx;
  }

  /**
   * Snap a proposed layer position against grid + other objects.
   * Returns { x, y, guides[] }.
   */
  snapPosition(x, y, w, h, template, others = []) {
    const box = contentBox(template);
    const guides = [];
    let nx = x;
    let ny = y;
    const threshold = Math.max(0.15, (this.gridMm || 1) * 0.35);

    if (this.snapToGrid && this.gridMm > 0) {
      nx = snapTo(nx, this.gridMm);
      ny = snapTo(ny, this.gridMm);
    }

    if (this.snapToObjects) {
      const targetsX = [0, box.usableW / 2, box.usableW];
      const targetsY = [0, box.usableH / 2, box.usableH];
      for (const o of others) {
        targetsX.push(Number(o.x), Number(o.x) + Number(o.w) / 2, Number(o.x) + Number(o.w));
        targetsY.push(Number(o.y), Number(o.y) + Number(o.h) / 2, Number(o.y) + Number(o.h));
      }
      const candX = [nx, nx + w / 2, nx + w];
      for (const c of candX) {
        for (const t of targetsX) {
          if (Math.abs(c - t) <= threshold) {
            nx += t - c;
            guides.push({ axis: "x", value: roundMm(t) });
            break;
          }
        }
      }
      const candY = [ny, ny + h / 2, ny + h];
      for (const c of candY) {
        for (const t of targetsY) {
          if (Math.abs(c - t) <= threshold) {
            ny += t - c;
            guides.push({ axis: "y", value: roundMm(t) });
            break;
          }
        }
      }
    }

    this.smartGuides = guides;
    return { x: roundMm(nx), y: roundMm(ny), guides };
  }

  renderRulers(hHost, vHost, template, pxPerMm, scrollLeft = 0, scrollTop = 0) {
    if (!this.showRulers) return;
    if (hHost) {
      hHost.innerHTML = "";
      hHost.style.height = "20px";
      const canvas = document.createElement("canvas");
      const w = Math.ceil(Number(template.labelW) * pxPerMm) + 40;
      canvas.width = w;
      canvas.height = 20;
      canvas.style.transform = `translateX(${-scrollLeft}px)`;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, w, 20);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      const step = this.gridMm >= 1 ? 5 : 1;
      for (let mm = 0; mm <= template.labelW; mm += step) {
        const x = mm * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(x, mm % 10 === 0 ? 8 : 12);
        ctx.lineTo(x, 20);
        ctx.strokeStyle = "#94a3b8";
        ctx.stroke();
        if (mm % 10 === 0) ctx.fillText(String(mm), x + 2, 10);
      }
      hHost.appendChild(canvas);
    }
    if (vHost) {
      vHost.innerHTML = "";
      vHost.style.width = "20px";
      const canvas = document.createElement("canvas");
      const h = Math.ceil(Number(template.labelH) * pxPerMm) + 40;
      canvas.width = 20;
      canvas.height = h;
      canvas.style.transform = `translateY(${-scrollTop}px)`;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, 20, h);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      const step = this.gridMm >= 1 ? 5 : 1;
      for (let mm = 0; mm <= template.labelH; mm += step) {
        const y = mm * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(mm % 10 === 0 ? 8 : 12, y);
        ctx.lineTo(20, y);
        ctx.strokeStyle = "#94a3b8";
        ctx.stroke();
        if (mm % 10 === 0) {
          ctx.save();
          ctx.translate(9, y + 8);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(mm), 0, 0);
          ctx.restore();
        }
      }
      vHost.appendChild(canvas);
    }
  }
}

function snapTo(n, g) {
  return Math.round(Number(n) / g) * g;
}

export default GuidesController;
