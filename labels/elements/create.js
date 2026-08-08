import { createId } from "../core/id.js";
import { roundMm, clamp } from "../core/units.js";
import { registerElement, getElementDef } from "./registry.js";

/** Shared geometry defaults for every layer. */
export function baseLayer(type, overrides = {}) {
  return {
    id: createId("ly"),
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    x: 2,
    y: 2,
    w: 15,
    h: 15,
    unit: "mm",
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    z: Date.now() % 100000,
    groupId: null,
    ...overrides
  };
}

export function normalizeLayer(ly) {
  if (!ly) return createLayer("text");
  return {
    ...ly,
    id: ly.id || createId("ly"),
    type: ly.type || "text",
    name: ly.name || "Layer",
    x: roundMm(Number(ly.x) || 0),
    y: roundMm(Number(ly.y) || 0),
    w: roundMm(Math.max(0.3, Number(ly.w) || 1)),
    h: roundMm(Math.max(0.5, Number(ly.h) || 1)),
    rotation: Number(ly.rotation) || 0,
    opacity: clamp(ly.opacity == null ? 1 : Number(ly.opacity), 0, 1),
    locked: !!ly.locked,
    visible: ly.visible !== false,
    z: Number(ly.z) || 0,
    unit: "mm"
  };
}

export function createLayer(type, overrides = {}) {
  const def = getElementDef(type);
  if (def?.defaults) return normalizeLayer({ ...def.defaults(), ...overrides, type });
  return normalizeLayer(baseLayer(type, overrides));
}

function defQr() {
  return baseLayer("qr", {
    name: "QR Code",
    x: 0,
    y: 0,
    w: 18,
    h: 30,
    z: 1,
    frame: "none",
    style: "square",
    color: "#0f172a",
    cornerColor: "#0f172a",
    bg: "#ffffff",
    quiet: 0,
    errorCorrection: "M",
    padding: 0
  });
}

function defBarcode() {
  return baseLayer("barcode", {
    name: "Barcode",
    x: 2,
    y: 20,
    w: 30,
    h: 10,
    z: 5,
    format: "CODE128",
    text: "I1001",
    displayValue: true,
    font: 7,
    color: "#0f172a",
    bg: "#ffffff",
    quiet: 2
  });
}

function defText(extra = {}) {
  return baseLayer("text", {
    name: "Text",
    h: 6,
    text: "Text",
    font: 10,
    weight: 700,
    align: "left",
    color: "#0f172a",
    tracking: 0,
    lineHeight: 1.2,
    wrap: true,
    padding: 0,
    ...extra
  });
}

function defImage() {
  return baseLayer("image", {
    name: "Picture",
    src: "",
    fit: "contain"
  });
}

function defShape() {
  return baseLayer("shape", {
    name: "Shape",
    shape: "rect",
    fill: "#e2e8f0",
    stroke: "#0f172a",
    strokeWidth: 0.2,
    radius: 0
  });
}

function defLine() {
  return baseLayer("line", {
    name: "Line",
    w: 20,
    h: 0.4,
    stroke: "#0f172a",
    strokeWidth: 0.35
  });
}

function defBackground() {
  return baseLayer("background", {
    name: "Background",
    x: 0,
    y: 0,
    w: 50,
    h: 30,
    fill: "#ffffff",
    z: -10
  });
}

/** Register built-in element types once. */
export function registerBuiltins() {
  registerElement({ type: "qr", label: "QR Code", defaults: defQr });
  registerElement({ type: "barcode", label: "Barcode", defaults: defBarcode });
  registerElement({
    type: "text",
    label: "Text",
    defaults: () => defText()
  });
  registerElement({ type: "image", label: "Image", defaults: defImage });
  registerElement({ type: "shape", label: "Shape", defaults: defShape });
  registerElement({ type: "line", label: "Line", defaults: defLine });
  registerElement({
    type: "background",
    label: "Background",
    defaults: defBackground
  });
}

registerBuiltins();

/**
 * Default thermal layout — brand-first hierarchy, thin divider, unified QR ink.
 * Tuned for ~50×30 mm; scales acceptably on nearby sizes.
 */
export function createDefaultLayers() {
  return [
    normalizeLayer({
      ...defQr(),
      id: "ly-qr",
      x: 1,
      y: 1,
      w: 16,
      h: 16,
      z: 1,
      style: "square",
      color: "#0f172a",
      cornerColor: "#0f172a"
    }),
    normalizeLayer(
      defText({
        id: "ly-brand",
        name: "Brand",
        role: "brand",
        x: 18.5,
        y: 1,
        w: 30.5,
        h: 6,
        z: 4,
        text: "AbouAmjad Store",
        font: 9.5,
        weight: 800,
        color: "#0f172a",
        tracking: 0.01
      })
    ),
    normalizeLayer({
      ...defLine(),
      id: "ly-rule",
      name: "Divider",
      x: 18.5,
      y: 7.4,
      w: 30.5,
      h: 0.25,
      z: 3,
      stroke: "#0f172a",
      strokeWidth: 0.18
    }),
    normalizeLayer(
      defText({
        id: "ly-code",
        name: "Code",
        role: "code",
        x: 18.5,
        y: 8,
        w: 30.5,
        h: 7,
        z: 5,
        text: "I1001",
        font: 12,
        weight: 800,
        color: "#0f172a"
      })
    ),
    normalizeLayer(
      defText({
        id: "ly-desc",
        name: "Description",
        role: "desc",
        x: 18.5,
        y: 15.2,
        w: 30.5,
        h: 5.5,
        z: 6,
        text: "Product name",
        font: 8,
        weight: 600,
        color: "#334155"
      })
    ),
    normalizeLayer(
      defText({
        id: "ly-footer",
        name: "Footer",
        role: "footer",
        x: 1,
        y: 25.2,
        w: 48,
        h: 3.8,
        z: 7,
        text: "aics.iskndr.com",
        font: 6.5,
        weight: 600,
        color: "#64748b",
        align: "left"
      })
    ),
    normalizeLayer({
      ...defImage(),
      id: "ly-image",
      x: 36,
      y: 8,
      w: 12,
      h: 12,
      z: 0,
      visible: false
    })
  ];
}

export function layoutPresets() {
  return {
    blank: () => [],
    thermal: () => createDefaultLayers(),
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
        text: "Product name",
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
        name: "QR Code",
        color: "#0f172a",
        cornerColor: "#0f172a",
        style: "square"
      })
    ],
    barcode: () => [
      createLayer("barcode", {
        id: "ly-barcode",
        x: 3,
        y: 8,
        w: 44,
        h: 14,
        z: 1,
        format: "CODE128",
        text: "I1001",
        displayValue: true
      }),
      createLayer("text", {
        id: "ly-brand",
        role: "brand",
        name: "Brand",
        x: 3,
        y: 1.5,
        w: 44,
        h: 5,
        font: 10,
        weight: 800,
        align: "center",
        text: "AbouAmjad Store",
        z: 2
      })
    ]
  };
}
