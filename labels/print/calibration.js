/**
 * Guided printer calibration — measure printed test → compute profile.
 */
import { createDocument } from "../core/document.js";
import { renderLabel, sharedPrintCss, ensureQrLibrary } from "../render/engine.js";
import { printInFrame } from "./frame.js";
import {
  loadCalibration,
  saveCalibration,
  listPrinterProfiles,
  setActivePrinter
} from "../data/storage.js";
import { computeCalibration } from "./calibration-math.js";

export { computeCalibration };

function testDocument(labelW = 50, labelH = 30) {
  return createDocument({
    labelW,
    labelH,
    page: "thermal",
    layers: [
      {
        id: "ly-frame",
        type: "shape",
        name: "Frame",
        x: 0.5,
        y: 0.5,
        w: labelW - 1,
        h: labelH - 1,
        unit: "mm",
        fill: "transparent",
        stroke: "#0f172a",
        strokeWidth: 0.35,
        visible: true,
        z: 1
      },
      {
        id: "ly-h",
        type: "line",
        name: "H",
        x: 2,
        y: labelH / 2,
        w: labelW - 4,
        h: 0.3,
        unit: "mm",
        stroke: "#0f766e",
        strokeWidth: 0.3,
        visible: true,
        z: 2
      },
      {
        id: "ly-v",
        type: "line",
        name: "V",
        x: labelW / 2,
        y: 2,
        w: 0.3,
        h: labelH - 4,
        unit: "mm",
        stroke: "#0f766e",
        strokeWidth: 0.3,
        visible: true,
        z: 3
      },
      {
        id: "ly-txt",
        type: "text",
        name: "Hint",
        role: "brand",
        x: 2,
        y: 2,
        w: labelW - 4,
        h: 6,
        unit: "mm",
        text: `${labelW}×${labelH} mm test`,
        font: 8,
        weight: 800,
        align: "left",
        color: "#0f172a",
        visible: true,
        z: 4
      }
    ]
  });
}

export async function printCalibrationPage(labelW = 50, labelH = 30) {
  await ensureQrLibrary();
  const doc = testDocument(labelW, labelH);
  const label = await renderLabel(doc, null, {
    mode: "print",
    applyCalibration: false
  });
  const css =
    sharedPrintCss(doc) +
    "\nbody{display:flex;align-items:center;justify-content:center;min-height:100vh}";
  await printInFrame("Calibration test", css, (_d, body) => {
    body.appendChild(label);
  });
}

export function mountCalibrationWizard(host, { labelW = 50, labelH = 30, onSaved } = {}) {
  const cal = loadCalibration();
  const profiles = listPrinterProfiles();
  host.innerHTML = `
    <div class="cal-wizard">
      <h3>Printer calibration</h3>
      <p class="hint">Print a test label, measure with a ruler, enter results — we compute offset &amp; scale.</p>
      <label>Printer profile
        <select id="calProfile">${Object.keys(profiles)
          .map(
            (n) =>
              `<option value="${n}" ${n === cal.printerName ? "selected" : ""}>${n}</option>`
          )
          .join("")}</select>
      </label>
      <label>New profile name <input id="calNewName" placeholder="e.g. ITPP130"></label>
      <div class="cal-steps">
        <button type="button" class="tc-btn tc-btn-primary" id="calPrint">1 · Print test page</button>
      </div>
      <div class="cal-grid">
        <label>Expected W mm <input id="calExpW" type="number" step="0.1" value="${labelW}"></label>
        <label>Expected H mm <input id="calExpH" type="number" step="0.1" value="${labelH}"></label>
        <label>Measured W mm <input id="calMeaW" type="number" step="0.1" value="${labelW}"></label>
        <label>Measured H mm <input id="calMeaH" type="number" step="0.1" value="${labelH}"></label>
        <label>Offset X error mm <input id="calOffX" type="number" step="0.1" value="0"></label>
        <label>Offset Y error mm <input id="calOffY" type="number" step="0.1" value="0"></label>
        <label>DPI <input id="calDpi" type="number" step="1" value="${cal.dpi}"></label>
      </div>
      <div class="cal-actions">
        <button type="button" class="tc-btn" id="calCompute">2 · Calculate</button>
        <button type="button" class="tc-btn tc-btn-primary" id="calSave">3 · Save profile</button>
      </div>
      <pre class="cal-result" id="calResult"></pre>
    </div>`;

  let pending = { ...cal };

  host.querySelector("#calPrint").onclick = () => {
    const w = Number(host.querySelector("#calExpW").value) || labelW;
    const h = Number(host.querySelector("#calExpH").value) || labelH;
    printCalibrationPage(w, h).catch((e) => alert(e.message || e));
  };

  host.querySelector("#calCompute").onclick = () => {
    pending = computeCalibration({
      expectedW: Number(host.querySelector("#calExpW").value),
      expectedH: Number(host.querySelector("#calExpH").value),
      measuredW: Number(host.querySelector("#calMeaW").value),
      measuredH: Number(host.querySelector("#calMeaH").value),
      measuredOffsetX: Number(host.querySelector("#calOffX").value),
      measuredOffsetY: Number(host.querySelector("#calOffY").value),
      base: { ...cal, dpi: Number(host.querySelector("#calDpi").value) || 300 }
    });
    host.querySelector("#calResult").textContent = JSON.stringify(pending, null, 2);
  };

  host.querySelector("#calSave").onclick = () => {
    const name =
      host.querySelector("#calNewName").value.trim() ||
      host.querySelector("#calProfile").value ||
      "default";
    pending.printerName = name;
    pending.dpi = Number(host.querySelector("#calDpi").value) || pending.dpi;
    const saved = saveCalibration(pending);
    setActivePrinter(name);
    host.querySelector("#calResult").textContent =
      "Saved:\n" + JSON.stringify(saved, null, 2);
    onSaved?.(saved);
  };
}
