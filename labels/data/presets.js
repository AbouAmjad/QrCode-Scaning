/**
 * Ready-made template documents by use-case.
 * Pure data — opened via createDocument() so geometry stays compatible.
 */
import { createDocument } from "../core/document.js";
import { createLayer } from "../elements/create.js";

function thermalBase(w, h, layers, brand) {
  return createDocument({
    page: "thermal",
    labelW: w,
    labelH: h,
    brand: brand || "AbouAmjad Store",
    layers
  });
}

export const TEMPLATE_LIBRARY = [
  {
    id: "lib-tool",
    name: "Tool · 50×30",
    kind: "tool",
    blurb: "QR + code + description",
    build: () =>
      thermalBase(50, 30, [
        createLayer("qr", { x: 1, y: 1, w: 18, h: 28, z: 1 }),
        createLayer("text", {
          role: "brand",
          name: "Brand",
          x: 21,
          y: 2,
          w: 27,
          h: 5,
          font: 7,
          weight: 800,
          text: "AbouAmjad Store",
          z: 2
        }),
        createLayer("text", {
          role: "code",
          name: "Code",
          x: 21,
          y: 9,
          w: 27,
          h: 8,
          font: 12,
          weight: 800,
          text: "I000",
          z: 3
        }),
        createLayer("text", {
          role: "desc",
          name: "Description",
          x: 21,
          y: 18,
          w: 27,
          h: 10,
          font: 8,
          weight: 600,
          text: "Tool name",
          z: 4
        })
      ])
  },
  {
    id: "lib-person",
    name: "Person · 51×25",
    kind: "person",
    blurb: "Badge-style person sticker",
    build: () =>
      thermalBase(51, 25, [
        createLayer("qr", { x: 1, y: 1, w: 16, h: 23, z: 1 }),
        createLayer("text", {
          role: "code",
          name: "Code",
          x: 19,
          y: 3,
          w: 30,
          h: 7,
          font: 14,
          weight: 800,
          text: "P000",
          z: 2
        }),
        createLayer("text", {
          role: "desc",
          name: "Name",
          x: 19,
          y: 12,
          w: 30,
          h: 10,
          font: 9,
          weight: 700,
          text: "Full name",
          dir: "auto",
          z: 3
        })
      ])
  },
  {
    id: "lib-consumable",
    name: "Consumable · barcode",
    kind: "consumable",
    blurb: "Code128 + short name",
    build: () =>
      thermalBase(50, 30, [
        createLayer("barcode", { x: 2, y: 2, w: 46, h: 14, z: 1, showText: true }),
        createLayer("text", {
          role: "desc",
          name: "Description",
          x: 2,
          y: 18,
          w: 46,
          h: 10,
          font: 9,
          weight: 700,
          align: "center",
          text: "Consumable",
          z: 2
        })
      ])
  },
  {
    id: "lib-warning",
    name: "Warning · high contrast",
    kind: "warning",
    blurb: "Black frame + bold code",
    build: () =>
      thermalBase(50, 30, [
        createLayer("background", { fill: "#fff7ed", z: -10, w: 50, h: 30 }),
        createLayer("shape", {
          x: 1,
          y: 1,
          w: 48,
          h: 28,
          fill: "transparent",
          stroke: "#9a3412",
          strokeWidth: 0.5,
          z: 0
        }),
        createLayer("qr", {
          x: 3,
          y: 4,
          w: 16,
          h: 22,
          color: "#0f172a",
          bg: "#ffffff",
          z: 1
        }),
        createLayer("text", {
          role: "code",
          name: "Code",
          x: 22,
          y: 6,
          w: 25,
          h: 10,
          font: 13,
          weight: 800,
          color: "#9a3412",
          text: "CODE",
          z: 2
        }),
        createLayer("text", {
          role: "desc",
          name: "Hint",
          x: 22,
          y: 18,
          w: 25,
          h: 8,
          font: 8,
          weight: 700,
          color: "#7c2d12",
          text: "HANDLE WITH CARE",
          z: 3
        })
      ])
  }
];

export function buildLibraryTemplate(id) {
  const hit = TEMPLATE_LIBRARY.find((t) => t.id === id);
  return hit ? hit.build() : createDocument();
}
