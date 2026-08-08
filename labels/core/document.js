/**
 * TemplateDocument — single source of truth for a label design.
 * Pure data + pure transforms. No DOM.
 */
import { roundMm, clamp } from "./units.js";
import {
  DOC_VERSION,
  PAGE_MODES,
  DEFAULT_STYLE,
  DEFAULT_PAGE_FRAME,
  BRAND_DEFAULT
} from "./types.js";
import { contentBox } from "../layout/box.js";
import { migrateLayersToMm, clampLayerMm } from "../layout/migrate.js";
import { createDefaultLayers, normalizeLayer, createLayer } from "../elements/create.js";

function pageDefaults(page) {
  return PAGE_MODES[page] || PAGE_MODES.thermal;
}

/**
 * Normalize any raw config (API / localStorage / legacy) into a Document.
 */
export function createDocument(partial = {}) {
  const page =
    partial.page === "a4" || partial.page === "a3" ? partial.page : "thermal";
  const mode = pageDefaults(page);
  const style = { ...DEFAULT_STYLE, ...(partial.style || {}) };
  const pfIn = partial.pageFrame && typeof partial.pageFrame === "object" ? partial.pageFrame : {};
  const pageFrame = {
    enabled: pfIn.enabled !== false,
    includeInPrint: !!pfIn.includeInPrint,
    strokeWidth: Math.max(0.05, Number(pfIn.strokeWidth) || DEFAULT_PAGE_FRAME.strokeWidth),
    color: pfIn.color || DEFAULT_PAGE_FRAME.color,
    dash: pfIn.dash !== false
  };

  const labelW = Math.max(1, Number(partial.labelW) || 50);
  const labelH = Math.max(1, Number(partial.labelH) || 30);
  const innerMargin = Math.max(0, Number(partial.innerMargin) || 0);

  const spec = { labelW, labelH, innerMargin, style };
  const box = contentBox(spec);

  let layers = Array.isArray(partial.layers) && partial.layers.length
    ? partial.layers
    : createDefaultLayers();

  layers = migrateLayersToMm(layers, box)
    .map((ly) => normalizeLayer(ly))
    .map((ly) => clampLayerMm(ly, box));

  return {
    version: DOC_VERSION,
    labelW,
    labelH,
    page,
    pageW: Number(partial.pageW) || mode.pageW,
    pageH: Number(partial.pageH) || mode.pageH,
    cols: Math.max(1, Number(partial.cols) || mode.cols),
    rows: Math.max(1, Number(partial.rows) || mode.rows),
    gapX: Math.max(0, Number(partial.gapX != null ? partial.gapX : partial.gap) || 0),
    gapY: Math.max(0, Number(partial.gapY != null ? partial.gapY : partial.gap) || 0),
    marginX: Math.max(
      0,
      Number(partial.marginX != null ? partial.marginX : partial.margin) || 0
    ),
    marginY: Math.max(
      0,
      Number(partial.marginY != null ? partial.marginY : partial.margin) || 0
    ),
    innerMargin,
    orientation: partial.orientation === "landscape" ? "landscape" : "portrait",
    thermal: page === "thermal",
    brand: partial.brand || BRAND_DEFAULT,
    style,
    pageFrame,
    layers,
    gridMm: Number(partial.gridMm) > 0 ? Number(partial.gridMm) : 1,
    snapToGrid: partial.snapToGrid !== false,
    snapToObjects: partial.snapToObjects !== false,
    showGuides: partial.showGuides !== false,
    showSafeArea: partial.showSafeArea !== false,
    safeMm: Math.max(0, Number(partial.safeMm) || 1),
    bleedMm: Math.max(0, Number(partial.bleedMm) || 0)
  };
}

export function cloneDocument(doc) {
  return createDocument(JSON.parse(JSON.stringify(doc)));
}

export function setPageMode(doc, page) {
  const mode = pageDefaults(page);
  return createDocument({
    ...doc,
    page,
    pageW: mode.pageW,
    pageH: mode.pageH,
    cols: mode.cols,
    rows: mode.rows,
    thermal: page === "thermal"
  });
}

export function updateLayers(doc, layers) {
  return createDocument({ ...doc, layers });
}

export function patchLayer(doc, id, patch) {
  const box = contentBox(doc);
  const layers = doc.layers.map((ly) => {
    if (ly.id !== id) return ly;
    return clampLayerMm(normalizeLayer({ ...ly, ...patch, unit: "mm" }), box);
  });
  return updateLayers(doc, layers);
}

export function addLayer(doc, type, overrides = {}) {
  const ly = createLayer(type, overrides);
  const box = contentBox(doc);
  return updateLayers(doc, [...doc.layers, clampLayerMm(ly, box)]);
}

export function removeLayers(doc, ids) {
  const ban = new Set(ids);
  return updateLayers(
    doc,
    doc.layers.filter((ly) => !ban.has(ly.id) || ly.locked)
  );
}

/** Bind one print item into layer copies (does not mutate the document). */
export function bindItem(doc, item) {
  const code = String(item?.code || item?.toolCode || "").trim();
  const name = String(item?.name || item?.description || item?.desc || "").trim();
  const imageUrl = item?.imageUrl || item?.image || "";

  return doc.layers.map((ly) => {
    const copy = { ...ly };
    if (ly.type === "qr") copy.qrValue = code || String(ly.text || "QR");
    if (ly.type === "barcode") {
      copy.barcodeValue = code || String(ly.text || "CODE");
      if (ly.role === "code" || !ly.text || ly.bindCode !== false) {
        copy.text = code || ly.text || "CODE";
      }
    }
    if (ly.type === "text") {
      if (ly.role === "brand") copy.text = doc.brand || ly.text;
      else if (ly.role === "code") copy.text = code || ly.text || "";
      else if (ly.role === "desc") copy.text = name || ly.text || "";
      else if (ly.role === "footer") copy.text = ly.text || "";
    }
    if (ly.type === "image" && imageUrl) copy.src = imageUrl;
    return copy;
  });
}

export function layerById(doc, id) {
  return doc.layers.find((ly) => ly.id === id) || null;
}

export function sortedLayers(doc, direction = "asc") {
  const arr = [...doc.layers];
  arr.sort((a, b) =>
    direction === "desc" ? (b.z || 0) - (a.z || 0) : (a.z || 0) - (b.z || 0)
  );
  return arr;
}

export { roundMm, clamp };
