/**
 * label-renderer.js — THE single rendering engine.
 *
 * Template JSON  →  LabelRenderer  →  Editor | Preview | Print
 *
 * All dimensions are CSS millimeters. Zoom is applied only as a CSS
 * transform on a wrapper — never by mutating geometry.
 */
import {
  layout as computeLayout,
  labelShellCss,
  objectBoxCss,
  contentBox
} from "./label-layout-engine.js";
import { escHtml, roundMm } from "./label-units.js";
import { bindItemToLayers, normalizeTemplate } from "./label-model.js";

let qrLibPromise = null;

export function ensureQrLibrary() {
  if (typeof window !== "undefined" && typeof window.QRCodeStyling === "function") {
    return Promise.resolve(window.QRCodeStyling);
  }
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("qrLibScript");
    if (existing && typeof window.QRCodeStyling === "function") {
      resolve(window.QRCodeStyling);
      return;
    }
    const s = document.createElement("script");
    s.id = "qrLibScript";
    s.src = "labels/qr-code-styling.js";
    s.onload = () => {
      if (typeof window.QRCodeStyling === "function") resolve(window.QRCodeStyling);
      else reject(new Error("QRCodeStyling missing after load"));
    };
    s.onerror = () => reject(new Error("Failed to load qr-code-styling.js"));
    document.head.appendChild(s);
  });
  return qrLibPromise;
}

function qrDotType(style) {
  const s = String(style || "square").toLowerCase();
  if (s === "rounded" || s === "dots" || s === "classy") return "rounded";
  if (s === "extra-rounded") return "extra-rounded";
  if (s === "classy-rounded") return "classy-rounded";
  return "square";
}

/**
 * Build a QR as data-URL (or empty string on failure).
 * Size in px is derived once from mm × screen DPI.
 */
export async function renderQrDataUrl(ly, value, dpi = 192) {
  const wMm = Math.max(2, Number(ly.w) || 18);
  const hMm = Math.max(2, Number(ly.h) || 18);
  const sideMm = Math.min(wMm, hMm);
  const pad = Math.max(0, Number(ly.padding) || 0);
  const quiet = Math.max(0, Number(ly.quiet) || 0);
  const inset = pad + quiet;
  const paintMm = Math.max(2, sideMm - 2 * inset);
  const px = Math.max(64, Math.round((paintMm * dpi) / 25.4));

  try {
    const QRCodeStyling = await ensureQrLibrary();
    const qr = new QRCodeStyling({
      width: px,
      height: px,
      type: "svg",
      data: String(value || "QR"),
      margin: Math.max(0, Number(ly.quiet) || 0),
      qrOptions: { errorCorrectionLevel: ly.errorCorrection || "M" },
      dotsOptions: {
        color: ly.color || "#0f172a",
        type: qrDotType(ly.style)
      },
      cornersSquareOptions: {
        color: ly.cornerColor || ly.color || "#0f766e",
        type: qrDotType(ly.style) === "square" ? "square" : "extra-rounded"
      },
      cornersDotOptions: {
        color: ly.cornerColor || ly.color || "#0f766e"
      },
      backgroundOptions: { color: ly.bg || "#ffffff" }
    });
    const blob = await qr.getRawData("svg");
    if (!blob) return "";
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[LabelRenderer] QR render failed", e);
  }
  return "";
}

function resolveText(ly) {
  return String(ly.text ?? ly.qrValue ?? "");
}

function renderTextNode(obj) {
  const el = document.createElement("div");
  el.className = "lr-text";
  el.setAttribute("data-layer-id", obj.id || "");
  el.setAttribute("data-type", "text");
  el.style.cssText = objectBoxCss(obj);
  el.style.display = "flex";
  el.style.alignItems = "flex-start";
  el.style.justifyContent =
    obj.align === "center" ? "center" : obj.align === "right" ? "flex-end" : "flex-start";
  el.style.opacity = String(obj.opacity == null ? 1 : obj.opacity);
  el.style.color = obj.color || "#0f172a";
  el.style.fontFamily = obj.fontFamily || '"Plus Jakarta Sans", system-ui, sans-serif';
  el.style.fontSize = `${Number(obj.font) || 10}pt`;
  el.style.fontWeight = String(obj.weight || 700);
  el.style.letterSpacing = `${Number(obj.tracking) || 0}em`;
  el.style.lineHeight = String(obj.lineHeight || 1.15);
  el.style.whiteSpace = obj.wrap === false ? "nowrap" : "pre-wrap";
  el.style.wordBreak = "break-word";
  el.style.overflow = "hidden";
  el.style.padding = `${Number(obj.padding) || 0}mm`;
  el.textContent = resolveText(obj);
  return el;
}

function renderImageNode(obj) {
  const el = document.createElement("div");
  el.className = "lr-image";
  el.setAttribute("data-layer-id", obj.id || "");
  el.setAttribute("data-type", "image");
  el.style.cssText = objectBoxCss(obj);
  el.style.opacity = String(obj.opacity == null ? 1 : obj.opacity);
  el.style.display = "grid";
  el.style.placeItems = "center";
  if (obj.src) {
    const img = document.createElement("img");
    img.src = obj.src;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = obj.fit || "contain";
    img.draggable = false;
    el.appendChild(img);
  }
  return el;
}

function renderShapeNode(obj) {
  const el = document.createElement("div");
  el.className = "lr-shape";
  el.setAttribute("data-layer-id", obj.id || "");
  el.setAttribute("data-type", "shape");
  el.style.cssText = objectBoxCss(obj);
  el.style.opacity = String(obj.opacity == null ? 1 : obj.opacity);
  el.style.background = obj.fill || "#e2e8f0";
  el.style.border = `${Number(obj.strokeWidth) || 0}mm solid ${obj.stroke || "#0f172a"}`;
  el.style.borderRadius =
    obj.shape === "ellipse" || obj.shape === "circle"
      ? "50%"
      : `${Number(obj.radius) || 0}mm`;
  return el;
}

function renderLineNode(obj) {
  const el = document.createElement("div");
  el.className = "lr-line";
  el.setAttribute("data-layer-id", obj.id || "");
  el.setAttribute("data-type", "line");
  el.style.cssText = objectBoxCss(obj);
  el.style.opacity = String(obj.opacity == null ? 1 : obj.opacity);
  el.style.background = obj.stroke || "#0f172a";
  el.style.height = `${Math.max(0.1, Number(obj.strokeWidth) || Number(obj.h) || 0.35)}mm`;
  return el;
}

function renderBackgroundNode(obj, spec) {
  const el = document.createElement("div");
  el.className = "lr-bg";
  el.setAttribute("data-layer-id", obj.id || "");
  el.setAttribute("data-type", "background");
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

async function renderQrNode(obj, dpi) {
  const el = document.createElement("div");
  el.className = "lr-qr";
  el.setAttribute("data-layer-id", obj.id || "");
  el.setAttribute("data-type", "qr");
  el.style.cssText = objectBoxCss(obj);
  el.style.opacity = String(obj.opacity == null ? 1 : obj.opacity);
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
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.draggable = false;
    el.appendChild(img);
  } else {
    el.textContent = value;
    el.style.fontSize = "6pt";
    el.style.fontWeight = "800";
  }
  return el;
}

/**
 * Render one physical label into a DOM element.
 * @param {object} template  normalized template (mm)
 * @param {object} [item]    { code, name, imageUrl }
 * @param {object} [options]
 *   - mode: 'editor' | 'preview' | 'print'
 *   - applyCalibration: boolean (preview/print)
 *   - calibration: printer profile
 *   - flipped: mirror layers
 *   - interactive: add data attrs for editor hit-testing
 *   - className: extra class on root
 */
export async function renderLabel(template, item = null, options = {}) {
  const tpl = normalizeTemplate(template);
  const mode = options.mode || "preview";
  const applyCalibration = options.applyCalibration ?? mode !== "editor";
  let layers = tpl.layers;
  if (item) layers = bindItemToLayers(layers, item, tpl.brand);
  if (options.flipped) {
    const { mirrorLayers } = await import("./label-layout-engine.js");
    layers = mirrorLayers(layers, tpl);
  }

  const laid = computeLayout(tpl, layers, {
    applyCalibration,
    calibration: options.calibration
  });

  const root = document.createElement("div");
  root.className = ["lr-label", options.className || "", `lr-mode-${mode}`]
    .filter(Boolean)
    .join(" ");
  root.style.cssText = labelShellCss(tpl, laid.shell);
  root.setAttribute("data-label-w", String(tpl.labelW));
  root.setAttribute("data-label-h", String(tpl.labelH));
  if (item?.code) root.setAttribute("data-code", item.code);

  const dpi = options.dpi || laid.shell.dpi || 192;

  for (const obj of laid.objects) {
    // Map local layer coords already converted to abs in layout()
    const abs = {
      ...obj,
      absX: obj.absX,
      absY: obj.absY,
      absW: obj.absW,
      absH: obj.absH
    };
    let node;
    switch (obj.type) {
      case "qr":
        node = await renderQrNode(abs, dpi);
        break;
      case "text":
        node = renderTextNode(abs);
        break;
      case "image":
        node = renderImageNode(abs);
        break;
      case "shape":
      case "background":
        node =
          obj.type === "background"
            ? renderBackgroundNode(abs, tpl)
            : renderShapeNode(abs);
        break;
      case "line":
        node = renderLineNode(abs);
        break;
      default:
        node = renderTextNode(abs);
    }
    if (options.interactive) {
      node.style.pointerEvents = obj.locked ? "none" : "auto";
      node.classList.add("lr-interactive");
    } else {
      node.style.pointerEvents = "none";
    }
    root.appendChild(node);
  }

  return root;
}

/**
 * Render many labels into a sheet container (preview / print).
 * Uses the same renderLabel() — never a separate HTML path.
 */
export async function renderSheet(template, items, options = {}) {
  const tpl = normalizeTemplate(template);
  const sheet = document.createElement("div");
  sheet.className = ["lr-sheet", `lr-page-${tpl.page}`, options.className || ""]
    .filter(Boolean)
    .join(" ");

  const isThermal = tpl.page === "thermal";
  const flip = !!options.flip;
  const gapX = Number(tpl.gapX) || 0;
  const gapY = Number(tpl.gapY) || 0;
  const marginX = Number(tpl.marginX) || 0;
  const marginY = Number(tpl.marginY) || 0;

  if (isThermal) {
    sheet.style.cssText = [
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      `gap:${gapY}mm`,
      `padding:${marginY}mm ${marginX}mm`,
      "box-sizing:border-box",
      "background:#fff"
    ].join(";");
  } else {
    let pageW = Number(tpl.pageW) || (tpl.page === "a3" ? 297 : 210);
    let pageH = Number(tpl.pageH) || (tpl.page === "a3" ? 420 : 297);
    if (tpl.orientation === "landscape") [pageW, pageH] = [pageH, pageW];
    sheet.style.cssText = [
      `width:${pageW}mm`,
      `min-height:${pageH}mm`,
      "display:grid",
      `grid-template-columns:repeat(${Math.max(1, tpl.cols)}, ${tpl.labelW}mm)`,
      `grid-auto-rows:${tpl.labelH}mm`,
      `gap:${gapY}mm ${gapX}mm`,
      `padding:${marginY}mm ${marginX}mm`,
      "box-sizing:border-box",
      "background:#fff",
      "justify-content:start",
      "align-content:start"
    ].join(";");
  }

  const list = items?.length ? items : [{ code: "SAMPLE", name: "Preview" }];
  for (let i = 0; i < list.length; i++) {
    let flipped = false;
    if (flip) {
      if (isThermal) flipped = i % 2 === 1;
      else {
        const cols = Math.max(1, tpl.cols);
        const row = Math.floor(i / cols);
        flipped = row % 2 === 1;
      }
    }
    const label = await renderLabel(tpl, list[i], {
      ...options,
      mode: options.mode || "preview",
      flipped,
      applyCalibration: options.applyCalibration !== false
    });
    sheet.appendChild(label);
  }
  return sheet;
}

/** CSS shared by preview + print windows (exact mm). */
export function sharedPrintCss(template) {
  const tpl = normalizeTemplate(template);
  const isThermal = tpl.page === "thermal";
  let pageW = isThermal ? tpl.labelW : Number(tpl.pageW) || 210;
  let pageH = isThermal ? tpl.labelH : Number(tpl.pageH) || 297;
  if (!isThermal && tpl.orientation === "landscape") {
    [pageW, pageH] = [pageH, pageW];
  }
  const size = isThermal
    ? `${roundMm(tpl.labelW)}mm ${roundMm(tpl.labelH + (Number(tpl.gapY) || 0))}mm`
    : `${roundMm(pageW)}mm ${roundMm(pageH)}mm`;

  return `
@page { size: ${size}; margin: 0; }
html, body {
  margin: 0; padding: 0; background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
* { box-sizing: border-box; }
.lr-sheet { margin: 0 auto; }
.lr-label { break-inside: avoid; page-break-inside: avoid; }
${isThermal ? `.lr-label { page-break-after: always; } .lr-label:last-child { page-break-after: auto; }` : ""}
img { image-rendering: -webkit-optimize-contrast; }
`;
}

export function contentOrigin(template) {
  return contentBox(normalizeTemplate(template));
}

export default {
  renderLabel,
  renderSheet,
  sharedPrintCss,
  ensureQrLibrary,
  renderQrDataUrl,
  contentOrigin
};
