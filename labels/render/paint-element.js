/**
 * Paint individual elements into DOM nodes.
 * All sizes via CSS millimeters — shared by editor / preview / print.
 */
import { objectBoxCss } from "../layout/index.js";
import { renderQrDataUrl } from "./qr-bitmap.js";
import { barcodeToSvgDataUrl } from "./barcode.js";

function applyOpacity(el, obj) {
  el.style.opacity = String(obj.opacity == null ? 1 : obj.opacity);
}

export async function paintElement(obj, spec, { dpi = 192 } = {}) {
  switch (obj.type) {
    case "qr":
      return paintQr(obj, dpi);
    case "barcode":
      return paintBarcode(obj);
    case "text":
      return paintText(obj);
    case "image":
      return paintImage(obj);
    case "shape":
      return paintShape(obj);
    case "line":
      return paintLine(obj);
    case "background":
      return paintBackground(obj, spec);
    default:
      return paintText(obj);
  }
}

async function paintQr(obj, dpi) {
  const el = document.createElement("div");
  el.className = "lr-qr";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "qr";
  el.style.cssText = objectBoxCss(obj);
  applyOpacity(el, obj);
  el.style.display = "grid";
  el.style.placeItems = "center";
  el.style.background = obj.bg || "#ffffff";
  el.style.padding = `${Number(obj.padding) || 0}mm`;

  const value = obj.qrValue || obj.text || "QR";
  const url = await renderQrDataUrl(obj, value, dpi);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = value;
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    el.appendChild(img);
  } else {
    el.textContent = value;
    el.style.fontSize = "6pt";
    el.style.fontWeight = "800";
  }
  return el;
}

function paintBarcode(obj) {
  const el = document.createElement("div");
  el.className = "lr-barcode";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "barcode";
  el.style.cssText = objectBoxCss(obj);
  applyOpacity(el, obj);
  el.style.display = "grid";
  el.style.placeItems = "center";
  el.style.background = obj.bg || "#ffffff";
  el.style.padding = `${Number(obj.padding) || 0}mm`;
  const value = obj.barcodeValue || obj.text || "CODE";
  const url = barcodeToSvgDataUrl({
    value,
    heightPx: 96,
    color: obj.color || "#0f172a",
    bg: obj.bg || "#ffffff",
    showText: obj.showText !== false
  });
  const img = document.createElement("img");
  img.src = url;
  img.alt = value;
  img.draggable = false;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  el.appendChild(img);
  return el;
}

function paintText(obj) {
  const el = document.createElement("div");
  el.className = "lr-text";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "text";
  el.style.cssText = objectBoxCss(obj);
  applyOpacity(el, obj);
  el.style.display = "flex";
  el.style.alignItems = "flex-start";
  el.style.justifyContent =
    obj.align === "center" ? "center" : obj.align === "right" ? "flex-end" : "flex-start";
  el.style.color = obj.color || "#0f172a";
  // Label content font — distinct from UI chrome
  el.style.fontFamily =
    obj.fontFamily || '"IBM Plex Sans Arabic", "Noto Naskh Arabic", "Segoe UI", sans-serif';
  el.style.fontSize = `${Number(obj.font) || 10}pt`;
  el.style.fontWeight = String(obj.weight || 700);
  el.style.letterSpacing = `${Number(obj.tracking) || 0}em`;
  el.style.lineHeight = String(obj.lineHeight || 1.15);
  el.style.whiteSpace = obj.wrap === false ? "nowrap" : "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.overflow = "hidden";
  el.style.padding = `${Number(obj.padding) || 0}mm`;
  // RTL / Bidi: auto detects Arabic runs; align=right forces rtl base
  const dir = obj.dir || (obj.align === "right" ? "rtl" : "auto");
  el.dir = dir;
  el.style.unicodeBidi = "plaintext";
  el.style.textAlign =
    obj.align === "center" ? "center" : obj.align === "right" ? "right" : "start";
  el.textContent = String(obj.text ?? "");
  return el;
}

function paintImage(obj) {
  const el = document.createElement("div");
  el.className = "lr-image";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "image";
  el.style.cssText = objectBoxCss(obj);
  applyOpacity(el, obj);
  el.style.display = "grid";
  el.style.placeItems = "center";
  if (obj.src) {
    const img = document.createElement("img");
    img.src = obj.src;
    img.alt = "";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = obj.fit || "contain";
    el.appendChild(img);
  }
  return el;
}

function paintShape(obj) {
  const el = document.createElement("div");
  el.className = "lr-shape";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "shape";
  el.style.cssText = objectBoxCss(obj);
  applyOpacity(el, obj);
  el.style.background = obj.fill || "#e2e8f0";
  el.style.border = `${Number(obj.strokeWidth) || 0}mm solid ${obj.stroke || "#0f172a"}`;
  el.style.borderRadius =
    obj.shape === "ellipse" || obj.shape === "circle"
      ? "50%"
      : `${Number(obj.radius) || 0}mm`;
  return el;
}

function paintLine(obj) {
  const el = document.createElement("div");
  el.className = "lr-line";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "line";
  el.style.cssText = objectBoxCss(obj);
  applyOpacity(el, obj);
  el.style.background = obj.stroke || "#0f172a";
  el.style.height = `${Math.max(0.1, Number(obj.strokeWidth) || Number(obj.h) || 0.35)}mm`;
  return el;
}

function paintBackground(obj, spec) {
  const el = document.createElement("div");
  el.className = "lr-bg";
  el.dataset.layerId = obj.id || "";
  el.dataset.type = "background";
  el.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    `width:${spec.labelW}mm`,
    `height:${spec.labelH}mm`,
    `background:${obj.fill || "#ffffff"}`,
    `opacity:${obj.opacity == null ? 1 : obj.opacity}`,
    "pointer-events:none"
  ].join(";");
  return el;
}
