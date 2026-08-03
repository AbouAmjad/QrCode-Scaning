/**
 * label-model.js — Template / layer schema, defaults, normalization.
 * All geometry fields are millimeters.
 */
import { uid, roundMm, clamp } from "./label-units.js";
import { contentBox, migrateLayersToMm, clampLayerMm } from "./label-layout-engine.js";

export const PAGE_MODES = Object.freeze({
  thermal: { id: "thermal", pageW: null, pageH: null, cols: 1, rows: 1 },
  a4: { id: "a4", pageW: 210, pageH: 297, cols: 4, rows: 6 },
  a3: { id: "a3", pageW: 297, pageH: 420, cols: 5, rows: 8 }
});

export function defaultStyle() {
  return {
    borderWidth: 0,
    borderColor: "#0f172a",
    borderRadius: 0,
    bgColor: "#ffffff"
  };
}

/** Default thermal layout: QR left, brand/code/desc right. */
export function defaultLayers() {
  return [
    {
      id: "ly-qr",
      type: "qr",
      name: "QR Code",
      x: 0,
      y: 0,
      w: 18,
      h: 30,
      unit: "mm",
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      z: 1,
      frame: "none",
      style: "rounded",
      color: "#0f172a",
      cornerColor: "#0f766e",
      bg: "#ffffff",
      quiet: 0,
      errorCorrection: "M",
      padding: 0
    },
    {
      id: "ly-brand",
      type: "text",
      name: "Brand",
      role: "brand",
      x: 19,
      y: 1.2,
      w: 30,
      h: 4.8,
      unit: "mm",
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      z: 2,
      text: "AbouAmjad Store",
      font: 7,
      weight: 700,
      align: "left",
      color: "#64748b",
      tracking: 0.04,
      lineHeight: 1.15,
      wrap: true
    },
    {
      id: "ly-code",
      type: "text",
      name: "Code",
      role: "code",
      x: 19,
      y: 7.2,
      w: 30,
      h: 9.6,
      unit: "mm",
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      z: 3,
      text: "I1001",
      font: 13,
      weight: 900,
      align: "left",
      color: "#0f172a",
      tracking: 0,
      lineHeight: 1.1,
      wrap: false
    },
    {
      id: "ly-desc",
      type: "text",
      name: "Description",
      role: "desc",
      x: 19,
      y: 18,
      w: 30,
      h: 9.6,
      unit: "mm",
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      z: 4,
      text: "Sample tool",
      font: 9,
      weight: 600,
      align: "left",
      color: "#334155",
      tracking: 0,
      lineHeight: 1.2,
      wrap: true
    },
    {
      id: "ly-image",
      type: "image",
      name: "Picture",
      x: 36,
      y: 6,
      w: 13,
      h: 18,
      unit: "mm",
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: false,
      z: 0,
      src: "",
      fit: "contain"
    }
  ];
}

export function createLayer(type, overrides = {}) {
  const base = {
    id: uid("ly"),
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    x: 2,
    y: 2,
    w: type === "line" ? 20 : 15,
    h: type === "line" ? 0.4 : 15,
    unit: "mm",
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    z: Date.now() % 100000,
    groupId: null
  };
  if (type === "qr") {
    Object.assign(base, {
      name: "QR Code",
      style: "rounded",
      color: "#0f172a",
      cornerColor: "#0f766e",
      bg: "#ffffff",
      quiet: 0,
      errorCorrection: "M",
      padding: 0,
      frame: "none"
    });
  } else if (type === "text") {
    Object.assign(base, {
      name: "Text",
      text: "Text",
      font: 10,
      weight: 700,
      align: "left",
      color: "#0f172a",
      tracking: 0,
      lineHeight: 1.2,
      wrap: true,
      h: 6
    });
  } else if (type === "image") {
    Object.assign(base, { name: "Image", src: "", fit: "contain" });
  } else if (type === "shape") {
    Object.assign(base, {
      name: "Shape",
      shape: "rect",
      fill: "#e2e8f0",
      stroke: "#0f172a",
      strokeWidth: 0.2,
      radius: 0
    });
  } else if (type === "line") {
    Object.assign(base, {
      name: "Line",
      stroke: "#0f172a",
      strokeWidth: 0.35
    });
  } else if (type === "background") {
    Object.assign(base, {
      name: "Background",
      x: 0,
      y: 0,
      w: 50,
      h: 30,
      fill: "#ffffff",
      z: -10
    });
  }
  return { ...base, ...overrides, unit: "mm" };
}

export function createTemplate(partial = {}) {
  const page = partial.page || "thermal";
  const mode = PAGE_MODES[page] || PAGE_MODES.thermal;
  return normalizeTemplate({
    labelW: 50,
    labelH: 30,
    page,
    pageW: mode.pageW,
    pageH: mode.pageH,
    cols: mode.cols,
    rows: mode.rows,
    gapX: 0,
    gapY: 0,
    marginX: 0,
    marginY: 0,
    innerMargin: 0,
    orientation: "portrait",
    thermal: page === "thermal",
    brand: "AbouAmjad Store",
    style: defaultStyle(),
    layers: defaultLayers(),
    showGuides: true,
    gridMm: 1,
    snapToGrid: true,
    snapToObjects: true,
    ...partial
  });
}

export function normalizeLayer(ly) {
  if (!ly) return createLayer("text");
  return {
    ...ly,
    id: ly.id || uid("ly"),
    type: ly.type || "text",
    name: ly.name || "Layer",
    x: roundMm(Number(ly.x) || 0),
    y: roundMm(Number(ly.y) || 0),
    w: roundMm(Math.max(0.3, Number(ly.w) || 1)),
    h: roundMm(Math.max(0.3, Number(ly.h) || 1)),
    rotation: Number(ly.rotation) || 0,
    opacity: clamp(ly.opacity == null ? 1 : Number(ly.opacity), 0, 1),
    locked: !!ly.locked,
    visible: ly.visible !== false,
    z: Number(ly.z) || 0,
    unit: "mm"
  };
}

export function normalizeTemplate(cfg = {}) {
  const page = cfg.page === "a4" || cfg.page === "a3" ? cfg.page : "thermal";
  const style = { ...defaultStyle(), ...(cfg.style || {}) };
  const spec = {
    labelW: Math.max(1, Number(cfg.labelW) || 50),
    labelH: Math.max(1, Number(cfg.labelH) || 30),
    innerMargin: Math.max(0, Number(cfg.innerMargin) || 0),
    style
  };
  let layers = Array.isArray(cfg.layers) && cfg.layers.length
    ? cfg.layers
    : Array.isArray(cfg.elements)
      ? elementsToLayers(cfg.elements)
      : defaultLayers();
  layers = migrateLayersToMm(layers, spec).map((ly) =>
    normalizeLayer(clampLayerMm(ly, contentBox(spec)))
  );

  const mode = PAGE_MODES[page];
  return {
    labelW: spec.labelW,
    labelH: spec.labelH,
    page,
    pageW: Number(cfg.pageW) || mode.pageW,
    pageH: Number(cfg.pageH) || mode.pageH,
    cols: Math.max(1, Number(cfg.cols) || mode.cols),
    rows: Math.max(1, Number(cfg.rows) || mode.rows),
    gapX: Math.max(0, Number(cfg.gapX != null ? cfg.gapX : cfg.gap) || 0),
    gapY: Math.max(0, Number(cfg.gapY != null ? cfg.gapY : cfg.gap) || 0),
    marginX: Math.max(0, Number(cfg.marginX != null ? cfg.marginX : cfg.margin) || 0),
    marginY: Math.max(0, Number(cfg.marginY != null ? cfg.marginY : cfg.margin) || 0),
    innerMargin: spec.innerMargin,
    orientation: cfg.orientation === "landscape" ? "landscape" : "portrait",
    thermal: page === "thermal",
    brand: cfg.brand || "AbouAmjad Store",
    style,
    layers,
    showGuides: cfg.showGuides !== false,
    gridMm: Number(cfg.gridMm) || 1,
    snapToGrid: cfg.snapToGrid !== false,
    snapToObjects: cfg.snapToObjects !== false
  };
}

/** Legacy elements map → layers array. */
function elementsToLayers(elements) {
  if (Array.isArray(elements)) return elements;
  const out = [];
  let z = 1;
  const map = {
    qr: "qr",
    brand: "text",
    code: "text",
    desc: "text",
    image: "image"
  };
  for (const [key, type] of Object.entries(map)) {
    const el = elements[key];
    if (!el) continue;
    out.push(
      normalizeLayer({
        ...el,
        id: el.id || `ly-${key}`,
        type,
        role: type === "text" ? key : undefined,
        name: key,
        z: z++,
        visible: el.visible !== false
      })
    );
  }
  return out;
}

/** Bind dynamic label data into layer copies for one item. */
export function bindItemToLayers(layers, item, brand) {
  const code = String(item?.code || item?.toolCode || "").trim();
  const name = String(item?.name || item?.description || item?.desc || "").trim();
  return (layers || []).map((ly) => {
    const copy = { ...ly };
    if (ly.type === "qr") {
      copy.qrValue = code || String(ly.text || "QR");
    }
    if (ly.type === "text") {
      if (ly.role === "brand") copy.text = brand || ly.text || "AbouAmjad Store";
      else if (ly.role === "code") copy.text = code || ly.text || "";
      else if (ly.role === "desc") copy.text = name || ly.text || "";
    }
    if (ly.type === "image" && item?.imageUrl) {
      copy.src = item.imageUrl;
    }
    return copy;
  });
}

export function cloneLayers(layers) {
  return JSON.parse(JSON.stringify(layers || []));
}

export function layoutPresets() {
  return {
    blank: () => [],
    thermal: () => defaultLayers(),
    stacked: () => [
      createLayer("qr", { id: "ly-qr", x: 16, y: 1, w: 18, h: 18, z: 1 }),
      createLayer("text", {
        id: "ly-code",
        role: "code",
        name: "Code",
        x: 2,
        y: 20,
        w: 46,
        h: 5,
        font: 11,
        weight: 900,
        align: "center",
        text: "I1001",
        z: 2
      }),
      createLayer("text", {
        id: "ly-desc",
        role: "desc",
        name: "Description",
        x: 2,
        y: 25,
        w: 46,
        h: 4,
        font: 8,
        weight: 600,
        align: "center",
        text: "Sample",
        z: 3
      })
    ],
    qrOnly: () => [
      createLayer("qr", {
        id: "ly-qr",
        x: 0,
        y: 0,
        w: 50,
        h: 30,
        z: 1,
        name: "QR Code"
      })
    ]
  };
}
