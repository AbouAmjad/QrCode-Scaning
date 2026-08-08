/**
 * Node unit tests — no browser / DOM required.
 * Run: node labels/tests/run.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mmToPx, pxToMm, roundMm, clamp } from "../core/units.js";
import { createDocument, bindItem, cloneDocument } from "../core/document.js";
import { contentBox } from "../layout/box.js";
import { snapMm, snapPosition } from "../layout/snap.js";
import { alignLayers, distributeLayers } from "../layout/align.js";
import { mirrorLayers } from "../layout/mirror.js";
import { layoutAbsolute } from "../layout/index.js";
import { serializeDocument, deserializeDocument, parseServerTemplate } from "../data/serialize.js";
import { computeCalibration } from "../print/calibration-math.js";
import { createLayer, createDefaultLayers } from "../elements/create.js";
import { parseCodeLines, itemsToText } from "../data/codes.js";
import {
  encodeCode128B,
  barcodeToSvgDataUrl,
  contrastRatio,
  lowContrastWarning
} from "../render/barcode.js";
import { TEMPLATE_LIBRARY, buildLibraryTemplate } from "../data/presets.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log("  ✓", msg);
  } else {
    failed += 1;
    console.error("  ✗", msg);
  }
}

function almost(a, b, eps = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

console.log("\n[units]");
assert(almost(mmToPx(25.4, 96), 96), "mmToPx 25.4mm @96dpi = 96px");
assert(almost(pxToMm(96, 96), 25.4), "pxToMm inverse");
assert(almost(mmToPx(pxToMm(100, 300), 300), 100), "round-trip px↔mm @300");
assert(roundMm(1.23456, 2) === 1.23, "roundMm places");
assert(clamp(5, 0, 3) === 3, "clamp high");
assert(clamp(-1, 0, 3) === 0, "clamp low");

console.log("\n[document]");
const doc = createDocument({ labelW: 51, labelH: 25, page: "thermal" });
assert(doc.labelW === 51 && doc.labelH === 25, "label size");
assert(doc.layers.length >= 3, "default layers");
assert(doc.version === 2, "doc version");
const bound = bindItem(doc, { code: "I1001", name: "Hammer" });
const codeLy = bound.find((l) => l.role === "code");
const descLy = bound.find((l) => l.role === "desc");
const qrLy = bound.find((l) => l.type === "qr");
assert(codeLy?.text === "I1001", "bind code role");
assert(descLy?.text === "Hammer", "bind desc role");
assert(qrLy?.qrValue === "I1001", "bind qr value");
const clone = cloneDocument(doc);
clone.layers[0].x = 99;
assert(doc.layers[0].x !== 99, "clone is deep");

console.log("\n[layout box]");
const box = contentBox(doc);
assert(box.usableW > 0 && box.usableH > 0, "usable box");
assert(box.ox >= 0 && box.oy >= 0, "origin inset");

console.log("\n[snap]");
assert(snapMm(3.4, 1) === 3, "snapMm grid 1");
assert(snapMm(3.6, 1) === 4, "snapMm round up");
const sp = snapPosition(10.02, 5.01, 10, 10, box, [], { gridMm: 1, snapToGrid: true, snapToObjects: false });
assert(sp.x === 10 && sp.y === 5, "snapPosition grid");

console.log("\n[align / distribute]");
const layers = [
  createLayer("text", { id: "a", x: 0, y: 0, w: 10, h: 5 }),
  createLayer("text", { id: "b", x: 20, y: 8, w: 10, h: 5 }),
  createLayer("text", { id: "c", x: 40, y: 2, w: 10, h: 5 })
];
const left = alignLayers(layers, "left", box);
assert(left.every((l) => l.x === 0), "align left");
const dist = distributeLayers(layers, "h");
assert(almost(dist[1].x, 20), "distribute keeps middle spacing ends");

console.log("\n[mirror]");
const mir = mirrorLayers([{ type: "text", x: 0, y: 0, w: 10, h: 5, align: "left", unit: "mm" }], doc);
assert(almost(mir[0].x, box.usableW - 10), "mirror x");
assert(mir[0].align === "right", "mirror align swap");

console.log("\n[layoutAbsolute]");
const laid = layoutAbsolute(doc, doc.layers, { applyCalibration: false });
assert(laid.objects.length === doc.layers.filter((l) => l.visible !== false).length, "objects count");
assert(laid.objects.every((o) => o.absX != null && o.absW != null), "abs geometry");
const calLaid = layoutAbsolute(doc, doc.layers, {
  applyCalibration: true,
  calibration: { offsetXMm: 1, offsetYMm: 2, scale: 1.01, dpi: 300 }
});
assert(calLaid.shell.offsetXMm === 1 && calLaid.shell.scale === 1.01, "shell calibration only");
assert(
  almost(calLaid.objects[0].absX, laid.objects[0].absX),
  "calibration does not shift object absX"
);

console.log("\n[serialize]");
const json = serializeDocument(doc);
const back = deserializeDocument(json);
assert(back.labelW === doc.labelW && back.layers.length === doc.layers.length, "round-trip JSON");
const parsed = parseServerTemplate({ id: 1, name: "T", config: json });
assert(parsed.document.labelW === doc.labelW, "parseServerTemplate string config");
const parsedObj = parseServerTemplate({ id: 2, name: "T2", config: { labelW: 40, labelH: 20 } });
assert(parsedObj.document.labelW === 40, "parseServerTemplate object config");

console.log("\n[calibration]");
const cal = computeCalibration({
  expectedW: 50,
  expectedH: 30,
  measuredW: 51,
  measuredH: 30.6,
  measuredOffsetX: 0.5,
  measuredOffsetY: -0.2,
  base: { dpi: 203, printerName: "test" }
});
assert(cal.scale < 1 && cal.scale > 0.9, "scale compensates oversized print");
assert(cal.offsetXMm === -0.5, "offset X inverted");
assert(cal.offsetYMm === 0.2, "offset Y inverted");

console.log("\n[codes]");
const items = parseCodeLines("A1 | One\nB2\n\nC3 | Three");
assert(items.length === 3 && items[0].name === "One", "parseCodeLines");
assert(itemsToText(items).includes("A1 | One"), "itemsToText");

console.log("\n[elements]");
assert(createDefaultLayers().length >= 4, "default thermal layers");
assert(createLayer("qr").type === "qr", "createLayer qr");
assert(createLayer("barcode").type === "barcode", "createLayer barcode");

console.log("\n[barcode]");
const enc = encodeCode128B("I39-A");
assert(enc.codes[0] === 104 && enc.codes[enc.codes.length - 1] === 106, "Code128 start/stop");
const svgUrl = barcodeToSvgDataUrl({ value: "C12-B" });
assert(svgUrl.startsWith("data:image/svg+xml"), "barcode svg data url");
assert(contrastRatio("#000000", "#ffffff") > 20, "contrast black/white high");
assert(lowContrastWarning("#777777", "#888888").ok === false, "low contrast detected");

console.log("\n[presets]");
assert(TEMPLATE_LIBRARY.length >= 4, "starter library count");
const personTpl = buildLibraryTemplate("lib-person");
assert(personTpl.labelW === 51 && personTpl.labelH === 25, "person preset size");

console.log("\n[prod fixture regression]");
const here = dirname(fileURLToPath(import.meta.url));
let prod = [];
try {
  prod = JSON.parse(readFileSync(join(here, "fixtures/prod-templates.json"), "utf8"));
} catch {
  prod = [];
}
assert(Array.isArray(prod) && prod.length >= 1, "prod fixture loads");
for (const row of prod) {
  const parsed = parseServerTemplate(row);
  const d = parsed.document;
  assert(d.labelW > 0 && d.labelH > 0, `prod #${row.id} size`);
  assert(d.layers.length > 0, `prod #${row.id} layers`);
  const boundProd = bindItem(d, { code: "P144", name: "Test" });
  assert(boundProd.some((l) => l.type === "qr" && l.qrValue === "P144"), `prod #${row.id} bind qr`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
