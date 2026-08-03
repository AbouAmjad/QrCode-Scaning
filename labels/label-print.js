/**
 * label-print.js — Print via the same LabelRenderer (no popup windows).
 *
 * Uses a hidden iframe so browsers do not block window.open().
 * Fallback: same-document print region if iframe construction fails.
 */
import { renderSheet, sharedPrintCss, ensureQrLibrary } from "./label-renderer.js";
import { loadCalibration } from "./label-storage.js";
import { normalizeTemplate } from "./label-model.js";

const IFRAME_ID = "tc-label-print-frame";

function waitForImages(doc) {
  const imgs = [...(doc.images || [])];
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = img.onerror = () => res();
          })
    )
  );
}

/**
 * Print HTML content without opening a popup.
 * @param {string} title
 * @param {string} css
 * @param {(doc: Document, body: HTMLElement) => Promise<void>|void} mountFn
 */
export async function printInFrame(title, css, mountFn) {
  let frame = document.getElementById(IFRAME_ID);
  if (frame) frame.remove();

  frame = document.createElement("iframe");
  frame.id = IFRAME_ID;
  frame.setAttribute("aria-hidden", "true");
  frame.title = title || "Print";
  // Off-screen but sized so layout/mm CSS still compute
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none"
  });
  document.body.appendChild(frame);

  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    throw new Error("Print frame unavailable");
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${String(title || "Print").replace(/</g, "")}</title>
<style>${css}</style>
</head><body></body></html>`);
  doc.close();

  await mountFn(doc, doc.body);
  await waitForImages(doc);
  await new Promise((r) => setTimeout(r, 80));

  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    throw new Error("Print window unavailable");
  }

  const cleanup = () => {
    setTimeout(() => {
      try {
        frame.remove();
      } catch {
        /* ignore */
      }
    }, 1000);
  };

  win.addEventListener("afterprint", cleanup);
  // Safari / some Chromium builds may not fire afterprint reliably
  setTimeout(cleanup, 60_000);

  win.focus();
  win.print();
}

export async function printLabels(template, items, { flip = false } = {}) {
  await ensureQrLibrary();
  const tpl = normalizeTemplate(template);
  const calibration = loadCalibration();
  const sheet = await renderSheet(tpl, items, {
    mode: "print",
    flip,
    applyCalibration: true,
    calibration,
    className: "lr-print-sheet"
  });

  const css = sharedPrintCss(tpl);
  try {
    await printInFrame("Print labels", css, (_doc, body) => {
      body.appendChild(sheet);
    });
  } catch (e) {
    // Last resort: inject into current page print region (no popup)
    await printInPlace(css, sheet);
  }
}

/** Same-tab fallback: temporary print root + window.print(). */
async function printInPlace(css, node) {
  const styleId = "tc-label-print-style";
  const rootId = "tc-label-print-root";
  document.getElementById(styleId)?.remove();
  document.getElementById(rootId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
${css}
@media screen {
  #${rootId} {
    position: fixed; left: -10000px; top: 0; width: auto; height: auto;
    overflow: hidden; opacity: 0; pointer-events: none;
  }
}
@media print {
  body > *:not(#${rootId}) { display: none !important; }
  #${rootId} {
    display: block !important;
    position: static !important;
    left: auto !important;
    opacity: 1 !important;
    width: auto !important;
    height: auto !important;
  }
}`;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = rootId;
  root.appendChild(node);
  document.body.appendChild(root);

  await waitForImages(document);
  await new Promise((r) => setTimeout(r, 80));

  const cleanup = () => {
    style.remove();
    root.remove();
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 60_000);
  window.print();
}

export default { printLabels, printInFrame };
