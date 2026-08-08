/**
 * Barcode bitmap generation (Code128 / EAN-13) via JsBarcode.
 */
let barcodeLibPromise = null;

export function ensureBarcodeLibrary() {
  if (typeof window !== "undefined" && typeof window.JsBarcode === "function") {
    return Promise.resolve(window.JsBarcode);
  }
  if (barcodeLibPromise) return barcodeLibPromise;
  barcodeLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "labels/vendor/jsbarcode.min.js";
    s.onload = () => {
      if (typeof window.JsBarcode === "function") resolve(window.JsBarcode);
      else reject(new Error("JsBarcode missing after load"));
    };
    s.onerror = () => reject(new Error("Failed to load jsbarcode.min.js"));
    document.head.appendChild(s);
  });
  return barcodeLibPromise;
}

/**
 * @param {object} ly  barcode layer
 * @param {string} value
 * @param {number} dpi
 * @returns {Promise<string>} data URL
 */
export async function renderBarcodeDataUrl(ly, value, dpi = 192) {
  const wMm = Math.max(4, Number(ly.w) || 30);
  const hMm = Math.max(4, Number(ly.h) || 12);
  const widthPx = Math.max(80, Math.round((wMm * dpi) / 25.4));
  const heightPx = Math.max(40, Math.round((hMm * dpi) / 25.4));
  const format = String(ly.format || "CODE128").toUpperCase();
  const raw = String(value || ly.text || "CODE").trim() || "CODE";

  try {
    const JsBarcode = await ensureBarcodeLibrary();
    const canvas = document.createElement("canvas");
    const opts = {
      format: format === "EAN13" || format === "EAN-13" ? "EAN13" : "CODE128",
      width: Math.max(1, Math.round(widthPx / 100)),
      height: Math.max(20, heightPx - (ly.displayValue === false ? 0 : 18)),
      displayValue: ly.displayValue !== false,
      fontSize: Math.max(10, Math.round((Number(ly.font) || 8) * (dpi / 72))),
      margin: Math.max(0, Number(ly.quiet) || 4),
      lineColor: ly.color || "#0f172a",
      background: ly.bg || "#ffffff",
      textMargin: 2,
      valid: () => {}
    };
    // EAN-13 needs 12/13 digits — fall back to CODE128 if invalid
    try {
      JsBarcode(canvas, raw, opts);
    } catch {
      JsBarcode(canvas, raw, { ...opts, format: "CODE128" });
    }
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[barcode-bitmap] render failed", e);
    return "";
  }
}
