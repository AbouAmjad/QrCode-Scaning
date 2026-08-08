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
    style: "rounded",
    color: "#0f172a",
    cornerColor: "#0f766e",
    bg: "#ffffff",
    quiet: 0,
    errorCorrection: "M",
    padding: 0
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

function defBarcode() {
  return baseLayer("barcode", {
    name: "Barcode",
    x: 2,
    y: 18,
    w: 30,
    h: 10,
    z: 5,
    format: "code128",
    color: "#0f172a",
    bg: "#ffffff",
    showText: true,
    padding: 0.2,
    text: "CODE"
  });
}

/** Register built-in element types once. */
export function registerBuiltins() {
  registerElement({ type: "qr", label: "QR Code", defaults: defQr });
  registerElement({ type: "barcode", label: "Barcode 1D", defaults: defBarcode });
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

export function createDefaultLayers() {
  return [
    normalizeLayer(defQr()),
    normalizeLayer(
      defText({
        id: "ly-brand",
        name: "Brand",
        role: "brand",
        x: 19,
        y: 1.2,
        w: 30,
        h: 4.8,
        z: 2,
        text: "AbouAmjad Store",
        font: 7,
        weight: 700,
        color: "#64748b",
        tracking: 0.04
      })
    ),
    normalizeLayer(
      defText({
        id: "ly-code",
        name: "Code",
        role: "code",
        x: 19,
        y: 7.2,
        w: 30,
        h: 9.6,
        z: 3,
        text: "I1001",
        font: 13,
        weight: 900
      })
    ),
    normalizeLayer(
      defText({
        id: "ly-desc",
        name: "Description",
        role: "desc",
        x: 19,
        y: 18,
        w: 30,
        h: 9.6,
        z: 4,
        text: "Sample tool",
        font: 9,
        weight: 600,
        color: "#334155"
      })
    ),
    normalizeLayer({
      ...defImage(),
      id: "ly-image",
      x: 36,
      y: 6,
      w: 13,
      h: 18,
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
