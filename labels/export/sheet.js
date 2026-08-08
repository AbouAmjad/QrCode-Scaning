/**
 * Export rendered label sheets as PNG or multi-page PDF (browser only).
 * Reuses the same renderSheet path as preview/print — WYSIWYG preserved.
 */
import { renderSheet } from "../render/sheet.js";
import { ensureQrLibrary } from "../render/engine.js";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

async function sheetToCanvas(doc, items, { flip = false, scale = 2 } = {}) {
  await ensureQrLibrary();
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;pointer-events:none;opacity:0;z-index:-1;";
  document.body.appendChild(host);
  try {
    const sheet = await renderSheet(doc, items, {
      flip,
      mode: "print",
      applyCalibration: true
    });
    host.appendChild(sheet);
    // Force layout
    void host.offsetWidth;
    const pages = [...host.querySelectorAll(".lr-label")];
    const targets = pages.length ? pages : [sheet];
    const canvases = [];
    for (const node of targets.slice(0, 40)) {
      // Cap pages for browser memory; thermal batches export first 40 stickers
      const rect = node.getBoundingClientRect();
      const w = Math.max(1, Math.round((rect.width || 200) * scale));
      const h = Math.max(1, Math.round((rect.height || 120) * scale));
      const canvas = await domToCanvas(node, w, h, scale);
      if (canvas) canvases.push(canvas);
    }
    return canvases;
  } finally {
    host.remove();
  }
}

/**
 * Rasterize a DOM node via SVG foreignObject (no external lib).
 */
async function domToCanvas(node, width, height, scale) {
  const clone = node.cloneNode(true);
  const wMm = node.style.width || `${node.offsetWidth}px`;
  const hMm = node.style.height || `${node.offsetHeight}px`;
  const wrap = document.createElement("div");
  wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrap.style.cssText = `width:${wMm};height:${hMm};background:#fff;`;
  // Copy computed styles lightly via inline already on lr-* nodes
  wrap.appendChild(clone);
  const html = new XMLSerializer().serializeToString(wrap);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%" style="transform:scale(${scale});transform-origin:0 0">` +
    html +
    `</foreignObject></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("PNG rasterize failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export async function exportSheetPng(doc, items, opts = {}) {
  const canvases = await sheetToCanvas(doc, items, opts);
  if (!canvases.length) throw new Error("Nothing to export");
  // If multiple pages, zip is heavy — export first page + numbered extras
  for (let i = 0; i < canvases.length; i++) {
    const blob = await new Promise((resolve) =>
      canvases[i].toBlob(resolve, "image/png")
    );
    const name =
      canvases.length === 1
        ? `labels-${doc.labelW}x${doc.labelH}.png`
        : `labels-${doc.labelW}x${doc.labelH}-p${i + 1}.png`;
    downloadBlob(blob, name);
  }
  return { pages: canvases.length, format: "png" };
}

/**
 * Minimal PDF writer (one image page each) — no external dependency.
 * Produces a valid PDF 1.4 with embedded JPEG/PNG via image streams as JPEG.
 */
export async function exportSheetPdf(doc, items, opts = {}) {
  const canvases = await sheetToCanvas(doc, items, opts);
  if (!canvases.length) throw new Error("Nothing to export");
  const pages = [];
  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const jpeg = dataUrlToBytes(dataUrl);
    pages.push({
      w: canvas.width,
      h: canvas.height,
      jpeg
    });
  }
  const pdf = buildPdf(pages);
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `labels-${doc.labelW}x${doc.labelH}.pdf`);
  return { pages: pages.length, format: "pdf" };
}

function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(",")[1] || "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function buildPdf(pages) {
  // Very small PDF assembler
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let pos = 0;
  const push = (s) => {
    const bytes = typeof s === "string" ? encoder.encode(s) : s;
    chunks.push(bytes);
    pos += bytes.length;
  };
  push("%PDF-1.4\n");
  const objStarts = {};
  const startObj = (n) => {
    objStarts[n] = pos;
    push(`${n} 0 obj\n`);
  };
  const endObj = () => push("\nendobj\n");

  startObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  const pageIds = pages.map((_, i) => 3 + i * 3);
  const contentIds = pages.map((_, i) => 4 + i * 3);
  const imageIds = pages.map((_, i) => 5 + i * 3);

  startObj(2);
  push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );
  endObj();

  pages.forEach((p, i) => {
    const pageId = pageIds[i];
    const contentId = contentIds[i];
    const imageId = imageIds[i];
    // Use points ≈ px for screen export (72dpi-ish); visual fidelity for archive
    const wPt = (p.w * 72) / 96;
    const hPt = (p.h * 72) / 96;
    startObj(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] ` +
        `/Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> >>`
    );
    endObj();
    const stream = `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm /Im${i} Do Q`;
    startObj(contentId);
    push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    endObj();
    startObj(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`
    );
    push(p.jpeg);
    push("\nendstream");
    endObj();
  });

  const xrefPos = pos;
  const maxObj = imageIds[imageIds.length - 1] || 2;
  push(`xref\n0 ${maxObj + 1}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= maxObj; i++) {
    const off = String(objStarts[i] || 0).padStart(10, "0");
    push(`${off} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  // Concatenate
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
