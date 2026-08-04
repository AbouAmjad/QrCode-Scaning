/**
 * QR bitmap generation — isolated so the paint engine stays thin.
 */
let qrLibPromise = null;

export function ensureQrLibrary() {
  if (typeof window !== "undefined" && typeof window.QRCodeStyling === "function") {
    return Promise.resolve(window.QRCodeStyling);
  }
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "labels/vendor/qr-code-styling.js";
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

export async function renderQrDataUrl(ly, value, dpi = 192) {
  const wMm = Math.max(2, Number(ly.w) || 18);
  const hMm = Math.max(2, Number(ly.h) || 18);
  const sideMm = Math.min(wMm, hMm);
  const pad = Math.max(0, Number(ly.padding) || 0);
  const quiet = Math.max(0, Number(ly.quiet) || 0);
  const paintMm = Math.max(2, sideMm - 2 * (pad + quiet));
  const px = Math.max(64, Math.round((paintMm * dpi) / 25.4));

  try {
    const QRCodeStyling = await ensureQrLibrary();
    const qr = new QRCodeStyling({
      width: px,
      height: px,
      type: "canvas",
      data: String(value || "QR"),
      margin: quiet,
      qrOptions: { errorCorrectionLevel: ly.errorCorrection || "M" },
      dotsOptions: { color: ly.color || "#0f172a", type: qrDotType(ly.style) },
      cornersSquareOptions: {
        color: ly.cornerColor || ly.color || "#0f766e",
        type: qrDotType(ly.style) === "square" ? "square" : "extra-rounded"
      },
      cornersDotOptions: { color: ly.cornerColor || ly.color || "#0f766e" },
      backgroundOptions: { color: ly.bg || "#ffffff" }
    });
    const blob = await Promise.race([
      qr.getRawData("png"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("QR render timeout")), 8000)
      )
    ]);
    if (!blob) return "";
    if (typeof blob === "string") return blob;
    if (blob instanceof Blob) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    // Some builds return ArrayBuffer / Uint8Array
    const bytes = blob instanceof ArrayBuffer ? new Uint8Array(blob) : blob;
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch (e) {
    console.warn("[qr-bitmap] render failed", e);
    return "";
  }
}
