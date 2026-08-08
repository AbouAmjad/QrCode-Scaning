/**
 * Pure Code128-B barcode encoder → SVG data URL.
 * No DOM / no external lib. GS1-friendly for alphanumeric codes.
 */

const START_B = 104;
const STOP = 106;

/** Code128 patterns (bars widths) indexed 0–106. */
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"
];

function charValue(ch) {
  const c = ch.charCodeAt(0);
  if (c < 32 || c > 127) return 0; // fallback NUL-ish → space via Code B
  return c - 32;
}

/**
 * Encode text as Code128-B.
 * @returns {{ codes: number[], text: string }}
 */
export function encodeCode128B(text) {
  const raw = String(text || "").replace(/[^\x20-\x7F]/g, "?");
  const data = raw.length ? raw : "?";
  const codes = [START_B];
  let checksum = START_B;
  for (let i = 0; i < data.length; i++) {
    const v = charValue(data[i]);
    codes.push(v);
    checksum += v * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);
  return { codes, text: data };
}

/**
 * Build an SVG data URL for a Code128 barcode.
 * @param {object} opts
 * @param {string} opts.value
 * @param {number} [opts.heightPx=80]
 * @param {string} [opts.color="#0f172a"]
 * @param {string} [opts.bg="#ffffff"]
 * @param {boolean} [opts.showText=true]
 */
export function barcodeToSvgDataUrl({
  value,
  heightPx = 80,
  color = "#0f172a",
  bg = "#ffffff",
  showText = true
} = {}) {
  const { codes, text } = encodeCode128B(value);
  let modules = 0;
  const bars = [];
  for (const code of codes) {
    const pat = PATTERNS[code] || PATTERNS[0];
    for (let i = 0; i < pat.length; i++) {
      const w = Number(pat[i]);
      bars.push({ black: i % 2 === 0, w });
      modules += w;
    }
  }
  const moduleW = 2;
  const width = modules * moduleW;
  const barH = showText ? heightPx - 18 : heightPx;
  let x = 0;
  let rects = "";
  for (const b of bars) {
    if (b.black) {
      rects += `<rect x="${x}" y="0" width="${b.w * moduleW}" height="${barH}" fill="${color}"/>`;
    }
    x += b.w * moduleW;
  }
  const textEl = showText
    ? `<text x="${width / 2}" y="${heightPx - 4}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" fill="${color}">${escapeXml(text)}</text>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${heightPx}" viewBox="0 0 ${width} ${heightPx}">` +
    `<rect width="100%" height="100%" fill="${bg}"/>${rects}${textEl}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Relative luminance for WCAG contrast (sRGB 0–255 channels). */
export function contrastRatio(hexA, hexB) {
  const L = (hex) => {
    const h = String(hex || "#000").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
    const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const a = L(hexA);
  const b = L(hexB);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** Warn when QR/barcode fg/bg contrast is weak for scanners. */
export function lowContrastWarning(fg, bg, minRatio = 3) {
  const ratio = contrastRatio(fg || "#000", bg || "#fff");
  if (ratio < minRatio) {
    return {
      ok: false,
      ratio,
      message: `Low contrast (${ratio.toFixed(1)}:1). Scanners may fail — use dark on light.`
    };
  }
  return { ok: true, ratio };
}
