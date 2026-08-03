/**
 * label-export.js — Export helpers (PNG sheet snapshot / JSON template).
 */
import { renderSheet, ensureQrLibrary } from "./label-renderer.js";
import { normalizeTemplate } from "./label-model.js";

export function downloadJson(template, filename = "label-template.json") {
  const blob = new Blob([JSON.stringify(normalizeTemplate(template), null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportSheetPng(template, items, filename = "labels.png") {
  await ensureQrLibrary();
  const sheet = await renderSheet(template, items, {
    mode: "preview",
    applyCalibration: false
  });
  // Offscreen mount
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-10000px;top:0;";
  wrap.appendChild(sheet);
  document.body.appendChild(wrap);
  try {
    const { width, height } = sheet.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    // html2canvas may not exist — fall back to SVG foreignObject when available
    if (typeof window.html2canvas === "function") {
      const c = await window.html2canvas(sheet, { backgroundColor: "#ffffff", scale });
      c.toBlob((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = filename;
        a.click();
      });
    } else {
      // Minimal fallback: open print preview guidance
      console.warn("[label-export] html2canvas not available — download JSON instead");
      downloadJson(template, filename.replace(/\.png$/i, ".json"));
    }
  } finally {
    wrap.remove();
  }
}

export function parseCodeLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return { code: parts[0] || "", name: parts.slice(1).join(" | ") || "" };
    })
    .filter((x) => x.code);
}

export function itemsToText(items) {
  return (items || [])
    .map((it) => (it.name ? `${it.code} | ${it.name}` : it.code))
    .join("\n");
}

export default {
  downloadJson,
  exportSheetPng,
  parseCodeLines,
  itemsToText
};
